"""Serve Cursor-exported PrizePicks board snapshots when live sync is empty.

Local Cursor often has a warm PropLine cache; Render free-tier can be rate-limited
with a cold warehouse. Seed JSON under ``data-platform/seed/`` keeps the member
board looking like the Cursor desk until live lines resume.

When a seed is served we also materialize rows into Postgres so player desks,
odds comparison, and Research Hub resolve the same live platform lines + ESPN
gamelogs (never synthesize chart bars on the client).
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

SEED_DIR = Path(__file__).resolve().parents[2] / "seed"

_LEAGUE_FILE = {
    "WNBA": "wnba_prizepicks_board.json",
    "NBA": "nba_prizepicks_board.json",
    "NFL": "nfl_prizepicks_board.json",
    "MLB": "mlb_prizepicks_board.json",
    "NHL": "nhl_prizepicks_board.json",
    "ATP": "atp_prizepicks_board.json",
    "WTA": "wta_prizepicks_board.json",
    "SOCCER": "soccer_prizepicks_board.json",
}


def load_cursor_board_seed(league: str, platform: str = "prizepicks") -> Optional[dict[str, Any]]:
    """Return a board payload from seed JSON, or None if missing/unusable."""
    app = (platform or "prizepicks").strip().lower()
    if app not in ("prizepicks", "pp"):
        return None
    code = (league or "").strip().upper()
    filename = _LEAGUE_FILE.get(code)
    if not filename:
        return None
    path = SEED_DIR / filename
    if not path.is_file():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        log.warning("cursor seed read failed %s: %s", path.name, exc)
        return None
    props = raw.get("props") or []
    from app.ingestion.platform_board import filter_live_betting_site_props

    # Reject research-warehouse exports (NBA/NHL seeds were never live pick'em).
    props = filter_live_betting_site_props(list(props))
    if not props:
        return None
    players = raw.get("players") or []
    # Keep player cards aligned to live props only
    live_player_ids = {
        str(p.get("playerId") or p.get("playerExternalId") or p.get("id") or "")
        for p in props
    }
    if players:
        players = [
            c
            for c in players
            if str(c.get("id") or c.get("playerId") or "") in live_player_ids
        ]
    label = raw.get("platformLabel") or "PrizePicks"
    return {
        "ok": True,
        "league": raw.get("league") or code,
        "platform": "prizepicks",
        "platformLabel": label,
        "props": props,
        "players": players,
        "count": len(props),
        "teams": raw.get("teams"),
        "markets": raw.get("markets"),
        "live": True,
        "cached": True,
        "fallback": True,
        "fallbackSource": "cursor-seed",
        "source": "cursor-seed",
        "dataSource": "cursor-seed",
        "rateLimited": False,
        "requiresApiKey": False,
        "error": None,
        "note": None,
        "disclaimer": raw.get("disclaimer"),
        "updatedAt": _newest_line_updated(props),
        "propsUpdatedAt": _newest_line_updated(props),
    }


def _newest_line_updated(props: list[dict[str, Any]]) -> Optional[str]:
    stamps: list[str] = []
    for p in props:
        v = p.get("lineUpdatedAt") or p.get("linesUpdatedAt")
        if v:
            stamps.append(str(v))
    return max(stamps) if stamps else None


def _parse_hits(raw: Any) -> tuple[int, int, float]:
    text = str(raw or "")
    if "/" not in text:
        return 0, 0, 0.0
    left, _, right = text.partition("/")
    try:
        hits = int(left.strip())
        samples = int(right.strip())
    except ValueError:
        return 0, 0, 0.0
    rate = (hits / samples) if samples else 0.0
    return hits, samples, rate


def _parse_ts(raw: Any) -> datetime:
    if isinstance(raw, datetime):
        return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
    text = str(raw or "").strip()
    if text:
        try:
            dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return datetime.now(timezone.utc)


def materialize_cursor_seed_to_warehouse(
    db: Session,
    *,
    league: str,
    platform: str = "prizepicks",
) -> Optional[dict[str, Any]]:
    """Upsert seed board rows into Postgres so desks / comparison resolve live.

    Does not invent sportsbook lines — only the pick'em platform line from the
    Cursor snapshot, plus Seraphim analytics already on the seed row. Gamelogs
    hydrate lazily on player-profile load.
    """
    from app.db.models import Odds, Prop, PropAnalytics
    from app.ingestion.pickem_platform_sync import _ensure_platform_player
    from app.ingestion.warehouse import insert_odds
    from app.providers.base import NormalizedOddsQuote
    from app.providers.propline.markets import normalize_league

    seed = load_cursor_board_seed(league, platform)
    if not seed:
        return None

    code = normalize_league(str(seed.get("league") or league))
    app = "prizepicks"
    label = str(seed.get("platformLabel") or "PrizePicks")
    props = list(seed.get("props") or [])
    if not props:
        return seed

    written = 0
    try:
        for row in props:
            prop_id = str(row.get("id") or "").strip()
            name = str(row.get("player") or "").strip()
            market = str(row.get("market") or "").strip()
            if not prop_id or not name or not market:
                continue

            player = _ensure_platform_player(db, code, name, app)
            # Prefer ESPN / provider id from the seed so profile URLs + gamelogs match.
            ext = str(row.get("playerExternalId") or row.get("playerId") or "").strip()
            if ext and not ext.startswith("pickem:"):
                try:
                    if not player.external_id or str(player.external_id).startswith("pickem:"):
                        player.external_id = ext
                        db.flush()
                except Exception:  # noqa: BLE001
                    db.rollback()
                    player = _ensure_platform_player(db, code, name, app)

            side = "Under" if str(row.get("side") or "").lower() == "under" else "Over"
            line = float(row.get("platformLine") or row.get("line") or 0)
            prop = db.get(Prop, prop_id)
            if not prop:
                prop = Prop(id=prop_id, league=code, market=market, side=side, line=line)
                db.add(prop)
            prop.league = code
            prop.player_id = player.id
            prop.market = market
            prop.side = side
            prop.line = line
            prop.status = "open"
            prop.updated_at = datetime.now(timezone.utc)
            db.flush()

            captured = _parse_ts(row.get("lineUpdatedAt") or row.get("linesUpdatedAt"))
            # Avoid duplicate odds spam — skip insert if a fresh platform quote exists.
            existing_odds = (
                db.execute(
                    select(Odds)
                    .where(Odds.prop_id == prop.id, Odds.is_mock.is_(False))
                    .order_by(Odds.captured_at.desc())
                    .limit(1)
                )
                .scalar_one_or_none()
            )
            need_odds = existing_odds is None or abs(float(existing_odds.line) - line) > 1e-6
            if need_odds:
                for side_name, odds_key in (("Over", "overOdds"), ("Under", "underOdds")):
                    american = int(row.get(odds_key) or row.get("americanOdds") or 100)
                    insert_odds(
                        db,
                        NormalizedOddsQuote(
                            league=code,
                            player_external_id=str(player.external_id or ""),
                            player_name=name,
                            market=market,
                            side=side_name,
                            line=line,
                            american_odds=american,
                            sportsbook_slug=str(row.get("platformSlug") or app),
                            sportsbook_name=str(row.get("platformName") or label),
                            captured_at=captured,
                            is_mock=False,
                            source_provider=str(row.get("sourceProvider") or "cursor-seed"),
                        ),
                        prop.id,
                        provider_name=str(row.get("sourceProvider") or "cursor-seed"),
                    )

            analytics = db.execute(
                select(PropAnalytics).where(PropAnalytics.prop_id == prop.id)
            ).scalar_one_or_none()
            if not analytics:
                analytics = PropAnalytics(id=str(uuid.uuid4()), prop_id=prop.id, league=code)
                db.add(analytics)
            analytics.league = code
            projected = row.get("projectedValue")
            analytics.projected_value = float(projected) if projected is not None else None
            analytics.comparison_line = line
            analytics.edge_vs_line = (
                float(row["edgeVsLine"]) if row.get("edgeVsLine") is not None else None
            )
            no_vig = float(row.get("noVigProb") or 0.5)
            if side == "Over":
                over_p, under_p = no_vig, max(0.0, 1.0 - no_vig)
            else:
                under_p, over_p = no_vig, max(0.0, 1.0 - no_vig)
            analytics.over_probability = over_p
            analytics.under_probability = under_p
            analytics.no_vig_prob = no_vig
            analytics.ev_percent = float(row.get("evPercent") or 0)
            analytics.confidence_score = int(row.get("confidence") or 0)
            analytics.research_score = int(row.get("researchScore") or 0)
            analytics.data_quality_score = 55
            analytics.explain_bullets = (
                list(row["explanation"]) if isinstance(row.get("explanation"), list) else []
            )
            analytics.matchup_note = str(row.get("game") or "")
            analytics.is_model_estimate = bool(row.get("isModelEstimate"))
            analytics.odds_are_mock = False
            analytics.computed_at = captured
            for key, field in (
                ("l5", "l5"),
                ("l10", "l10"),
                ("l20", "l20"),
                ("season", "season"),
            ):
                hits, samples, rate = _parse_hits(row.get(key))
                setattr(analytics, f"{field}_hits", hits)
                setattr(analytics, f"{field}_samples", samples)
                setattr(analytics, f"{field}_rate", rate)
            written += 1

        db.commit()
        log.info("materialized cursor seed league=%s props=%s", code, written)
    except Exception as exc:  # noqa: BLE001
        log.warning("cursor seed materialize failed league=%s: %s", code, exc)
        try:
            db.rollback()
        except Exception:  # noqa: BLE001
            pass
        return seed

    seed["materialized"] = True
    seed["materializedCount"] = written
    return seed
