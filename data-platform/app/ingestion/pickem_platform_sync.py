"""Live pick'em platform boards — multi-API fallthrough, then model.

Workflow (required):
  platform selection → live pick'em quotes (PropLine → SharpAPI → Odds API) →
  upsert props from those lines only → run Projection Engine vs the platform
  line → return board.

Short-circuits on the first provider that returns non-empty pick'em quotes so
one exhausted daily quota does not blank every board. Never invents lines.
Never substitutes sportsbook odds for pick'em lines. Players not on the
selected app are excluded.
"""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from statistics import mean
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.engine import expected_value, home_away_split, rest_days, streak
from app.analytics.factors.base import PredictionContext
from app.analytics.prediction import model_edge_percent, predict_prop
from app.config import get_settings
from app.db.models import Game, Injury, Player, PlayerGameLog, Prop, PropAnalytics
from app.ingestion.generic_board import market_values_from_logs
from app.ingestion.nba_pipeline import _market_values as _nba_market_values
from app.ingestion.platform_board import (
    PICKEM_APP_LABELS,
    normalize_pickem_app,
    slugs_for_app,
)
from app.ingestion.slate_times import enrich_and_filter_upcoming_props
from app.ingestion.warehouse import insert_odds, upsert_gamelog, upsert_player
from app.providers.base import NormalizedOddsQuote, NormalizedPlayer, run_provider_job
from app.providers.line_aggregation.factory import get_pickem_aggregator
from app.providers.propline import rate_limit as propline_rate_limit
from app.providers.propline.markets import normalize_league

log = logging.getLogger(__name__)

# Serve cached platform board if last sync is newer than this.
# Keep longer to avoid burning PropLine free-tier quota on every page load.
PLATFORM_CACHE_TTL = timedelta(minutes=30)

MIN_LOGS_FOR_MODEL = 3
# Cap per-request remodel so board loads stay responsive while stubs hydrate.
REMODEL_PENDING_LIMIT = 40

# PropLine / board market label → PlayerGameLog.raw JSON key (None = column / nba helper)
MARKET_RAW_KEYS: dict[str, Optional[str]] = {
    "Points": None,
    "Rebounds": None,
    "Assists": None,
    "Threes": None,
    "Steals": None,
    "Blocks": None,
    "Hits": "hits",
    "Home Runs": "homeRuns",
    "RBIs": "rbi",
    "Total Bases": "totalBases",
    "Stolen Bases": "stolenBases",
    "Walks": "baseOnBalls",
    "Runs": "runs",
    "Strikeouts": "strikeOuts",
    "Earned Runs": "earnedRuns",
    "Hits Allowed": "hitsAllowed",
    "Outs": "outs",
    "Goals": "goals",
    "Shots": "shots",
    "Saves": "saves",
    "Blocked Shots": "blockedShots",
    "Aces": "aces",
    "Double Faults": "double_faults",
    "Games Won": "games_won",
    "Break Points Won": "break_points_won",
    "Fantasy Score": "fantasy_score",
    "Total Games": "total_games",
    "Sets Won": "sets_won",
}


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:48] or "player"


def _find_player_by_name(db: Session, league: str, name: str) -> Optional[Player]:
    code = normalize_league(league)
    target = name.lower().strip()
    rows = list(db.execute(select(Player).where(Player.league == code)).scalars().all())

    def rank(p: Player) -> tuple[int, int]:
        has_logs = 1 if db.execute(
            select(PlayerGameLog.id).where(PlayerGameLog.player_id == p.id).limit(1)
        ).first() else 0
        is_stub = 1 if (p.external_id or "").startswith("pickem:") else 0
        return (has_logs, -is_stub)

    exact = [p for p in rows if (p.full_name or "").lower().strip() == target]
    if exact:
        exact.sort(key=rank, reverse=True)
        return exact[0]
    parts = target.split()
    if len(parts) >= 2:
        last, first = parts[-1], parts[0][0]
        soft = [
            p
            for p in rows
            if len((p.full_name or "").lower().split()) >= 2
            and (p.full_name or "").lower().split()[-1] == last
            and (p.full_name or "").lower().split()[0].startswith(first)
        ]
        if soft:
            soft.sort(key=rank, reverse=True)
            return soft[0]
    return None


def _ensure_platform_player(db: Session, league: str, name: str, platform: str) -> Player:
    existing = _find_player_by_name(db, league, name)
    if existing:
        # Prefer a non-stub peer when both exist
        if (existing.external_id or "").startswith("pickem:"):
            real_id = _lookup_provider_external_id(db, league=league, name=name)
            if real_id:
                real = db.execute(
                    select(Player).where(
                        Player.league == normalize_league(league),
                        Player.external_id == real_id,
                    )
                ).scalar_one_or_none()
                if real:
                    return real
                # Upgrade stub in place when safe
                try:
                    existing.external_id = real_id
                    db.flush()
                except Exception:  # noqa: BLE001
                    db.rollback()
        return existing
    code = normalize_league(league)
    # Prefer ESPN / MLB provider ids so gamelogs (and profiles) work immediately
    real_id = _lookup_provider_external_id(db, league=code, name=name)
    if real_id:
        real = db.execute(
            select(Player).where(Player.league == code, Player.external_id == real_id)
        ).scalar_one_or_none()
        if real:
            return real
        return upsert_player(
            db,
            NormalizedPlayer(
                external_id=real_id,
                league=code,
                full_name=name,
                short_name=name.split()[-1] if name.split() else name,
                position=None,
                team_external_id=None,
            ),
        )
    ext = f"pickem:{platform}:{_slugify(name)}"
    return upsert_player(
        db,
        NormalizedPlayer(
            external_id=ext,
            league=code,
            full_name=name,
            short_name=name.split()[-1] if name.split() else name,
            position=None,
            team_external_id=None,
        ),
    )


# Process-local cache so one board sync does not re-hit ESPN search per market.
_espn_name_cache: dict[tuple[str, str], Optional[str]] = {}


def _lookup_provider_external_id(db: Session, *, league: str, name: str) -> Optional[str]:
    """Resolve a display name to a real provider id (does not mutate Player rows)."""
    code = normalize_league(league)
    q = (name or "").strip()
    if not q:
        return None
    try:
        if code == "MLB":
            from app.providers.mlb.statsapi import MlbStatsApiProvider

            found = MlbStatsApiProvider().search_player(q)
            return found.external_id if found else None
        if code in {"NBA", "WNBA"}:
            peers = [
                p
                for p in db.execute(select(Player).where(Player.league == code)).scalars().all()
                if (p.full_name or "").lower().strip() == q.lower()
                and p.external_id
                and not str(p.external_id).startswith("pickem:")
            ]
            if peers:
                peers.sort(
                    key=lambda p: 1
                    if db.execute(
                        select(PlayerGameLog.id).where(PlayerGameLog.player_id == p.id).limit(1)
                    ).first()
                    else 0,
                    reverse=True,
                )
                return str(peers[0].external_id)
            cache_key = (code, q.lower())
            if cache_key in _espn_name_cache:
                return _espn_name_cache[cache_key]
            from app.providers.espn.search import search_espn_athlete

            found = search_espn_athlete(q, league=code)
            ext = found.external_id if found else None
            _espn_name_cache[cache_key] = ext
            return ext
    except Exception as exc:  # noqa: BLE001
        log.debug("lookup external id %s/%s: %s", code, q, exc)
    return None


def _resolve_stub_external_id(db: Session, *, league: str, player: Player) -> Optional[str]:
    """Attach a real provider id to pick'em stub players when safe; return id to hydrate with."""
    code = normalize_league(league)
    ext = str(player.external_id or "")
    if ext and not ext.startswith("pickem:"):
        return ext
    found_id = _lookup_provider_external_id(db, league=code, name=player.full_name or "")
    if not found_id:
        return None
    existing = db.execute(
        select(Player).where(Player.league == code, Player.external_id == found_id)
    ).scalar_one_or_none()
    if existing and existing.id != player.id:
        # Another warehouse row already owns this provider id — re-link props to it
        # and hydrate that row instead of violating the unique constraint.
        for prop in (
            db.execute(select(Prop).where(Prop.player_id == player.id)).scalars().all()
        ):
            prop.player_id = existing.id
        db.flush()
        return str(existing.external_id)
    try:
        player.external_id = found_id
        db.flush()
    except Exception as exc:  # noqa: BLE001
        log.debug("resolve stub assign %s/%s: %s", code, player.full_name, exc)
        db.rollback()
        return found_id
    return found_id


def _hydrate_player_logs(db: Session, *, league: str, player: Player) -> Player:
    """Fetch gamelogs when missing so the model can project vs live pick'em lines.

    Returns the player row to use for modeling (may switch to a real warehouse
    player when a stub collides on external_id).
    """
    code = normalize_league(league)
    # If stub resolves to an existing real player, model that one instead
    ext = str(player.external_id or "")
    if ext.startswith("pickem:") or not ext:
        found_id = _lookup_provider_external_id(db, league=code, name=player.full_name or "")
        if found_id:
            existing = db.execute(
                select(Player).where(Player.league == code, Player.external_id == found_id)
            ).scalar_one_or_none()
            if existing and existing.id != player.id:
                for prop in (
                    db.execute(select(Prop).where(Prop.player_id == player.id)).scalars().all()
                ):
                    prop.player_id = existing.id
                db.flush()
                player = existing
            else:
                try:
                    player.external_id = found_id
                    db.flush()
                except Exception:  # noqa: BLE001
                    db.rollback()

    if db.execute(
        select(PlayerGameLog.id).where(PlayerGameLog.player_id == player.id).limit(1)
    ).first():
        return player

    ext = player.external_id
    hydrate_ext = str(ext) if ext and not str(ext).startswith("pickem:") else None
    if not hydrate_ext:
        hydrate_ext = _lookup_provider_external_id(
            db, league=code, name=player.full_name or ""
        )
    if not hydrate_ext:
        return player
    try:
        if code == "MLB":
            from app.providers.mlb.statsapi import MlbStatsApiProvider

            for gl in MlbStatsApiProvider().fetch_gamelog("MLB", str(hydrate_ext)):
                upsert_gamelog(db, gl, player.id)
            db.flush()
        elif code in {"NBA", "WNBA"}:
            from app.providers.registry import get_nba_providers, get_wnba_providers

            providers = get_wnba_providers() if code == "WNBA" else get_nba_providers()
            if providers.gamelog:
                for gl in providers.gamelog.fetch_gamelog(code, str(hydrate_ext)):
                    upsert_gamelog(db, gl, player.id)
                db.flush()
    except Exception as exc:  # noqa: BLE001
        log.debug("hydrate logs %s/%s: %s", code, player.full_name, exc)
    return player


def _market_samples(logs: list[PlayerGameLog], market: str) -> list[float]:
    raw_key = MARKET_RAW_KEYS.get(market)
    if raw_key is not None:
        return market_values_from_logs(logs, market, raw_stat_key=raw_key)
    if market in {
        "Points",
        "Rebounds",
        "Assists",
        "Threes",
        "Steals",
        "Blocks",
        "Turnovers",
        "PRA",
        "PR",
        "PA",
        "RA",
        "Pts+Rebs",
        "Pts+Asts",
        "Rebs+Asts",
        "Pts+Rebs+Asts",
        "Steals+Blocks",
        "Blocks+Rebs",
        "Asts+TOs",
        "Fantasy Score",
        "Fantasy Points",
        "Double Double",
        "Triple Double",
        "3-PT Made",
        "3-Pointers Made",
    }:
        return _nba_market_values(logs, market)
    return market_values_from_logs(logs, market, raw_stat_key=None)


def _group_platform_quotes(
    quotes: list[NormalizedOddsQuote],
) -> list[dict[str, Any]]:
    """Collapse Over/Under sides into one board row per player+market+line."""
    buckets: dict[tuple[str, str, float], dict[str, Any]] = {}
    for q in quotes:
        key = (q.player_name.lower().strip(), q.market.lower().strip(), float(q.line))
        bucket = buckets.setdefault(
            key,
            {
                "player_name": q.player_name,
                "market": q.market,
                "line": float(q.line),
                "league": q.league,
                "game_external_id": q.game_external_id,
                "home_team": q.home_team,
                "away_team": q.away_team,
                "sport_key": q.sport_key,
                "sportsbook_slug": q.sportsbook_slug,
                "sportsbook_name": q.sportsbook_name,
                "source_provider": q.source_provider,
                "captured_at": q.captured_at,
                "over": None,
                "under": None,
                "projection_ids": [],
                "commence_time": (q.raw or {}).get("commence_time"),
            },
        )
        if q.side == "Over":
            bucket["over"] = q
        elif q.side == "Under":
            bucket["under"] = q
        if q.quote_external_id:
            bucket["projection_ids"].append(q.quote_external_id)
        if q.captured_at and (
            bucket["captured_at"] is None or q.captured_at > bucket["captured_at"]
        ):
            bucket["captured_at"] = q.captured_at
        if not bucket.get("home_team") and q.home_team:
            bucket["home_team"] = q.home_team
            bucket["away_team"] = q.away_team
        tip = (q.raw or {}).get("commence_time")
        if tip and not bucket.get("commence_time"):
            bucket["commence_time"] = tip
    return list(buckets.values())


def _board_player_ids(player: Optional[Player]) -> tuple[str, Optional[str], Optional[str]]:
    """Return (linkId, externalId, warehouseId) for board cards / profile URLs.

    Prefer a short ESPN/MLB provider id so client routes never need colon-heavy
    warehouse keys like ``wnba:player:pickem:…``.
    """
    if player is None:
        return ("", None, None)
    warehouse = player.id
    ext = str(player.external_id or "").strip() or None
    if ext and not ext.startswith("pickem:"):
        return (ext, ext, warehouse)
    return (warehouse or ext or "", ext, warehouse)


def _game_label(row: dict[str, Any]) -> str:
    home = row.get("home_team")
    away = row.get("away_team")
    if home and away:
        return f"{away} @ {home}"
    return "TBD"


def _opponent_guess(row: dict[str, Any], team_hint: Optional[str]) -> tuple[str, str]:
    """Return (team, opponent) best-effort from event labels."""
    home = row.get("home_team") or ""
    away = row.get("away_team") or ""
    if not home and not away:
        return ("—", "TBD")
    if team_hint:
        th = team_hint.lower()
        if th in home.lower():
            return (home, away or "TBD")
        if th in away.lower():
            return (away, home or "TBD")
    return (away or home, home if away else "TBD")


def _team_opponent_from_matchup_note(
    note: Optional[str], team_hint: Optional[str] = None
) -> tuple[str, str]:
    """Parse ``Away @ Home`` matchup notes into (team, opponent) for cards."""
    raw = (note or "").strip()
    if not raw or raw.upper() == "TBD":
        return ("—", "TBD")
    if " @ " in raw:
        away, home = raw.split(" @ ", 1)
        return _opponent_guess(
            {"home_team": home.strip(), "away_team": away.strip()}, team_hint
        )
    if " vs " in raw.lower():
        parts = raw.replace(" VS ", " vs ").split(" vs ", 1)
        if len(parts) == 2:
            return (parts[0].strip() or "—", parts[1].strip() or "TBD")
    return ("—", raw)


def _build_prediction_for_player(
    db: Session,
    *,
    league: str,
    player: Player,
    market: str,
    platform_line: float,
) -> tuple[Optional[Any], list[float], list[bool], list, list, Player]:
    player = _hydrate_player_logs(db, league=league, player=player)
    logs = (
        db.execute(
            select(PlayerGameLog)
            .where(PlayerGameLog.player_id == player.id)
            .order_by(PlayerGameLog.played_at.desc())
            .limit(40)
        )
        .scalars()
        .all()
    )
    values = _market_samples(logs, market)
    if len(values) < MIN_LOGS_FOR_MODEL:
        return None, values, [], [], [], player

    homes = [bool(r.home) for r in logs[: len(values)]]
    minutes = [r.minutes for r in logs[: len(values)]]
    played_at = [r.played_at for r in logs[: len(values)]]
    injury = "None"
    inj = (
        db.execute(
            select(Injury)
            .where(Injury.player_id == player.id)
            .order_by(Injury.reported_at.desc())
            .limit(1)
        )
        .scalar_one_or_none()
    )
    if inj:
        injury = inj.status or "None"

    mins_clean = [m for m in minutes if m is not None and m > 0]
    expected_minutes = mean(mins_clean[:5]) if len(mins_clean) >= 3 else (mean(mins_clean) if mins_clean else None)

    ctx = PredictionContext(
        league=normalize_league(league),
        market=market,
        values=values,
        homes=homes if len(homes) == len(values) else [True] * len(values),
        played_at=played_at
        if len(played_at) == len(values)
        else [datetime.now(timezone.utc)] * len(values),
        minutes=minutes,
        injury_status=injury,
        is_home=True,
        opponent_abbr=None,
        tipoff_at=None,
        expected_minutes=expected_minutes,
        vs_opponent_values=[],
    )
    prediction = predict_prop(ctx, comparison_line=platform_line)
    return prediction, values, homes, minutes, played_at, player


def _upsert_platform_prop(
    db: Session,
    *,
    league: str,
    platform: str,
    player: Player,
    market: str,
    side: str,
    line: float,
    game_id: Optional[str],
) -> Prop:
    """Stable prop id keyed by platform + player + market (line updates in place)."""
    pid = (
        f"{normalize_league(league).lower()}:pickem:{platform}:"
        f"{(player.id or 'x').split(':')[-1]}:{market.lower().replace(' ', '')}"
    )
    row = db.get(Prop, pid)
    if not row:
        row = Prop(id=pid, league=normalize_league(league), market=market, side=side, line=line)
        db.add(row)
    row.game_id = game_id
    row.player_id = player.id
    row.market = market
    row.side = side
    row.line = line
    row.status = "open"
    row.updated_at = datetime.now(timezone.utc)
    return row


def sync_pickem_platform_board(
    db: Session,
    *,
    league: str,
    platform: str,
    force: bool = False,
) -> dict[str, Any]:
    """Fetch live pick'em lines for ``platform`` and build the research board.

    Tries PropLine → SharpAPI → The Odds API (short-circuit). Returns props +
    players + updatedAt. Empty props when no keyed provider has lines for that
    app — never fabricates.
    """
    app = normalize_pickem_app(platform)
    label = PICKEM_APP_LABELS.get(app or "", platform)
    code = normalize_league(league)
    settings = get_settings()

    if not app:
        return {
            "ok": False,
            "league": code,
            "platform": None,
            "platformLabel": None,
            "props": [],
            "players": [],
            "count": 0,
            "updatedAt": None,
            "propsUpdatedAt": None,
            "dataSource": None,
            "requiresApiKey": False,
            "note": "Select a pick'em app to load that platform's live board.",
        }

    if app == "other":
        return {
            "ok": False,
            "league": code,
            "platform": app,
            "platformLabel": label,
            "props": [],
            "players": [],
            "count": 0,
            "updatedAt": None,
            "propsUpdatedAt": None,
            "dataSource": f"pickem:{app}",
            "requiresApiKey": False,
            "note": (
                "Other pick'em platforms (ParlayPlay, Dabble, …) are not available "
                "via the live PropLine feed yet. Choose PrizePicks, Underdog, or Sleeper."
            ),
            "unavailable": True,
        }

    keyed = [
        ("PROPLINE_API_KEY", bool(settings.propline_api_key)),
        ("SHARPAPI_API_KEY", bool(settings.sharpapi_api_key)),
        ("ODDS_API_KEY", bool(settings.odds_api_key)),
    ]
    if not any(configured for _, configured in keyed):
        return {
            "ok": False,
            "league": code,
            "platform": app,
            "platformLabel": label,
            "props": [],
            "players": [],
            "count": 0,
            "updatedAt": None,
            "propsUpdatedAt": None,
            "dataSource": f"pickem:{app}",
            "requiresApiKey": True,
            "envVar": "PROPLINE_API_KEY",
            "requiresAdditionalKeys": ["SHARPAPI_API_KEY", "ODDS_API_KEY"],
            # Member-facing copy only — never expose env var / vendor limit details.
            "note": (
                f"{label} lines for {code} aren’t available right now. "
                "Check back shortly — we only show live platform lines."
            ),
        }

    slugs = slugs_for_app(app)
    # Cache hit: recent platform odds already in warehouse for this league
    if not force:
        cached = _list_cached_platform_board(
            db, league=code, platform=app, slugs=slugs, allow_stale=False
        )
        if cached is not None:
            return cached

    def _stale_or_rate_limit_empty(
        exc: BaseException | str,
        *,
        rate_limited: bool = False,
        attempts: Optional[list[dict[str, Any]]] = None,
    ) -> dict[str, Any]:
        msg = str(exc)
        limited = rate_limited or (
            "429" in msg
            or "daily limit" in msg.lower()
            or "daily_limit" in msg.lower()
            or "rate limit" in msg.lower()
            or propline_rate_limit.is_blocked()
        )
        stale = _list_cached_platform_board(
            db,
            league=code,
            platform=app,
            slugs=slugs,
            allow_stale=True,
            max_age=timedelta(days=2),
        )
        until = propline_rate_limit.blocked_until()
        missing = [name for name, ok in keyed if not ok]
        # Ops-only detail (logs / refreshError). Never put vendor limits in `note`.
        ops_detail = (
            f"provider refresh blocked until "
            f"{until.strftime('%Y-%m-%d %H:%M UTC') if until else 'reset'}; "
            f"missing fallbacks: {', '.join(missing) if missing else 'none'}"
        )
        member_note = (
            f"Showing the latest saved {label} lines while tonight’s feed refreshes. "
            "Projections are Seraphim estimates vs those lines."
            if limited
            else f"Showing the latest saved {label} lines. Projections are Seraphim estimates vs those lines."
        )
        member_empty = (
            f"{label} lines for {code} aren’t loaded yet. "
            "Check back shortly — we only show players currently listed on the app."
        )
        if stale is not None:
            stale["note"] = member_note
            stale["cached"] = True
            stale["refreshError"] = f"{msg}; {ops_detail}"
            stale["rateLimited"] = limited
            if attempts is not None:
                stale["pickemAttempts"] = attempts
            return stale
        # Prefer the Cursor-exported PrizePicks snapshot over a blank board.
        from app.ingestion.cursor_board_seed import load_cursor_board_seed

        seed = load_cursor_board_seed(code, app)
        if seed is not None:
            seed["refreshError"] = f"{msg}; {ops_detail}"
            if attempts is not None:
                seed["pickemAttempts"] = attempts
            return seed
        return {
            "ok": False,
            "league": code,
            "platform": app,
            "platformLabel": label,
            "props": [],
            "players": [],
            "count": 0,
            "updatedAt": None,
            "propsUpdatedAt": None,
            "dataSource": f"pickem:{app}",
            "error": None,
            "refreshError": f"{msg}; {ops_detail}",
            "rateLimited": limited,
            "requiresAdditionalKeys": missing or None,
            "pickemAttempts": attempts,
            "note": member_empty,
        }

    aggregator = get_pickem_aggregator()
    with run_provider_job(db, provider="pickem-aggregator", league=code, job=f"sync_{app}") as job:
        try:
            # Upcoming slate window (today + tomorrow) so Jul 17 PrizePicks tips
            # appear when browsing on Jul 16. Aggregator short-circuits on first
            # non-empty pick'em batch so we do not burn every API quota.
            fetch = aggregator.fetch(
                code,
                platforms=set(slugs),
                max_events=24,
                horizon_hours=48,
            )
            quotes = fetch.quotes
            attempt_meta = [
                {
                    "source": a.source,
                    "status": a.status,
                    "quotes": a.quotes,
                    "detail": a.detail,
                }
                for a in fetch.attempts
            ]
        except Exception as exc:  # noqa: BLE001
            log.exception("pickem sync %s/%s failed", app, code)
            job.error = str(exc)
            return _stale_or_rate_limit_empty(exc)

        if not quotes:
            all_limited = bool(fetch.attempts) and all(
                a.status in {"rate_limited", "cooldown", "skipped"} for a in fetch.attempts
            )
            any_limited = any(
                a.status in {"rate_limited", "cooldown"} for a in fetch.attempts
            )
            reason = (
                f"No live {label} player props for {code} from configured providers "
                f"({', '.join(a.source for a in fetch.attempts) or 'none'})."
            )
            job.rows_written = 0
            db.commit()
            if all_limited or any_limited or propline_rate_limit.is_blocked():
                return _stale_or_rate_limit_empty(
                    reason,
                    rate_limited=True,
                    attempts=attempt_meta,
                )
            stale = _list_cached_platform_board(
                db,
                league=code,
                platform=app,
                slugs=slugs,
                allow_stale=True,
                max_age=timedelta(days=2),
            )
            if stale is not None:
                stale["note"] = (
                    f"{reason} Showing last warehouse {label} lines until a feed recovers."
                )
                stale["cached"] = True
                stale["pickemAttempts"] = attempt_meta
                return stale
            missing = [name for name, ok in keyed if not ok]
            return {
                "ok": True,
                "league": code,
                "platform": app,
                "platformLabel": label,
                "props": [],
                "players": [],
                "count": 0,
                "updatedAt": datetime.now(timezone.utc).isoformat(),
                "propsUpdatedAt": None,
                "dataSource": f"pickem:{app}",
                "live": True,
                "pickemAttempts": attempt_meta,
                "requiresAdditionalKeys": missing or None,
                "note": (
                    f"{reason} Only players currently listed on {label} are shown — "
                    "we never invent lines or pull from a generic projection DB."
                    + (
                        f" Configure {', '.join(missing)} for fallthrough capacity."
                        if missing
                        else ""
                    )
                ),
            }

        groups = _group_platform_quotes(quotes)
        board_rows: list[dict[str, Any]] = []
        seen_prop_ids: set[str] = set()
        latest_capture: Optional[datetime] = None

        for g in groups:
            player = _ensure_platform_player(db, code, g["player_name"], app)
            db.flush()
            platform_line = float(g["line"])
            over_q: Optional[NormalizedOddsQuote] = g.get("over")
            under_q: Optional[NormalizedOddsQuote] = g.get("under")
            # Need at least one side from the live feed
            seed = over_q or under_q
            if seed is None:
                continue

            prediction, values, homes, minutes, played_at, player = _build_prediction_for_player(
                db,
                league=code,
                player=player,
                market=g["market"],
                platform_line=platform_line,
            )

            if prediction is not None:
                side = "Over" if prediction.projected_value >= platform_line else "Under"
                projected = float(prediction.projected_value)
                edge = float(prediction.edge_vs_line) if prediction.edge_vs_line is not None else round(
                    projected - platform_line, 2
                )
                over_p = float(prediction.over_probability)
                under_p = float(prediction.under_probability)
                edge_pct = model_edge_percent(
                    projected=projected,
                    line=platform_line,
                    over_probability=over_p,
                    under_probability=under_p,
                    side=side,
                )
                confidence = int(prediction.confidence_score)
                research = int(prediction.research_score)
                explain = list(prediction.explanation)
                influential = list(prediction.influential_factors or [])
                model_version = prediction.model_version
                l5, l10, l20, season = prediction.l5, prediction.l10, prediction.l20, prediction.season
                ev = expected_value(
                    over_p if side == "Over" else under_p,
                    (over_q.american_odds if over_q else 100)
                    if side == "Over"
                    else (under_q.american_odds if under_q else 100),
                )
            else:
                # Live platform line only — model withheld until enough gamelogs
                side = "Over"
                projected = None
                edge = None
                edge_pct = None
                confidence = 0
                research = 0
                over_p = 0.5
                under_p = 0.5
                explain = [
                    f"Live {label} line {platform_line}.",
                    "Seraphim model pending — not enough warehouse gamelog samples for this player/stat yet.",
                ]
                influential = []
                model_version = None
                l5 = l10 = l20 = season = None
                ev = 0.0

            game_row = None
            if g.get("game_external_id"):
                # Prefer existing game rows; do not invent schedule rows
                game_row = db.execute(
                    select(Game).where(Game.external_id == str(g["game_external_id"]))
                ).scalar_one_or_none()
                if game_row is None:
                    # Try prefixed ids used by ESPN warehouse
                    for prefix in (f"{code.lower()}:game:", "nba:game:", "wnba:game:", ""):
                        game_row = db.get(Game, f"{prefix}{g['game_external_id']}")
                        if game_row:
                            break

            prop = _upsert_platform_prop(
                db,
                league=code,
                platform=app,
                player=player,
                market=g["market"],
                side=side,
                line=platform_line,
                game_id=game_row.id if game_row else None,
            )
            db.flush()
            seen_prop_ids.add(prop.id)

            for q in (over_q, under_q):
                if q is not None:
                    insert_odds(db, q, prop.id, provider_name=q.source_provider or "propline")

            analytics = db.execute(
                select(PropAnalytics).where(PropAnalytics.prop_id == prop.id)
            ).scalar_one_or_none()
            if not analytics:
                analytics = PropAnalytics(id=str(uuid.uuid4()), prop_id=prop.id, league=code)
                db.add(analytics)
            analytics.league = code
            analytics.projected_value = projected
            analytics.comparison_line = platform_line
            analytics.edge_vs_line = edge
            analytics.over_probability = over_p
            analytics.under_probability = under_p
            analytics.no_vig_prob = over_p if side == "Over" else under_p
            analytics.ev_percent = round(ev, 2) if prediction else 0.0
            analytics.confidence_score = confidence
            analytics.research_score = research
            analytics.data_quality_score = (
                prediction.data_quality_score if prediction else 20
            )
            analytics.model_version = model_version
            analytics.explain_bullets = explain
            analytics.influential_factors = influential
            analytics.matchup_note = _game_label(g)
            analytics.is_model_estimate = prediction is not None
            analytics.odds_are_mock = False
            analytics.disclaimer = settings.model_disclaimer
            analytics.computed_at = datetime.now(timezone.utc)
            if prediction and l5 and l10 and l20 and season:
                analytics.l5_hits, analytics.l5_samples, analytics.l5_rate = (
                    l5.hits,
                    l5.samples,
                    l5.rate,
                )
                analytics.l10_hits, analytics.l10_samples, analytics.l10_rate = (
                    l10.hits,
                    l10.samples,
                    l10.rate,
                )
                analytics.l20_hits, analytics.l20_samples, analytics.l20_rate = (
                    l20.hits,
                    l20.samples,
                    l20.rate,
                )
                analytics.season_hits, analytics.season_samples, analytics.season_rate = (
                    season.hits,
                    season.samples,
                    season.rate,
                )
                if values and homes:
                    analytics.home_rate, analytics.away_rate = home_away_split(
                        values, homes, platform_line, side
                    )
                    analytics.rest_days = rest_days(played_at) if played_at else None
                    analytics.streak = streak(values, platform_line, side)

            team, opponent = _opponent_guess(g, None)
            if team == "—" and opponent == "TBD" and analytics.matchup_note:
                team, opponent = _team_opponent_from_matchup_note(analytics.matchup_note)
            captured = g.get("captured_at") or datetime.now(timezone.utc)
            if latest_capture is None or captured > latest_capture:
                latest_capture = captured

            board_rows.append(
                {
                    "id": prop.id,
                    "playerId": _board_player_ids(player)[0],
                    "playerExternalId": _board_player_ids(player)[1],
                    "playerWarehouseId": _board_player_ids(player)[2],
                    "player": player.full_name,
                    "team": team,
                    "opponent": opponent,
                    "position": player.position or "",
                    "market": g["market"],
                    "stat": g["market"],
                    "side": side,
                    "line": platform_line,
                    "platformLine": platform_line,
                    "overLine": platform_line,
                    "underLine": platform_line,
                    "overOdds": over_q.american_odds if over_q else 100,
                    "underOdds": under_q.american_odds if under_q else 100,
                    "americanOdds": (
                        over_q.american_odds
                        if side == "Over" and over_q
                        else under_q.american_odds
                        if under_q
                        else 100
                    ),
                    "projectedValue": projected,
                    "edgeVsLine": edge,
                    "edgePercent": edge_pct,
                    "confidence": confidence,
                    "researchScore": research,
                    "evPercent": round(ev, 2) if prediction else 0.0,
                    "noVigProb": over_p if side == "Over" else under_p,
                    "l5": f"{l5.hits}/{l5.samples}" if l5 else "—",
                    "l10": f"{l10.hits}/{l10.samples}" if l10 else "—",
                    "l20": f"{l20.hits}/{l20.samples}" if l20 else "—",
                    "season": f"{season.hits}/{season.samples}" if season else "—",
                    "game": _game_label(g),
                    "sport": code,
                    "league": code,
                    "projectionId": (g.get("projection_ids") or [None])[0],
                    "projectionIds": g.get("projection_ids") or [],
                    "platform": app,
                    "platformSlug": g["sportsbook_slug"],
                    "platformName": g["sportsbook_name"] or label,
                    "sourceProvider": g.get("source_provider") or "propline",
                    "oddsAreMock": False,
                    "oddsRole": "platform-live",
                    "isModelEstimate": prediction is not None,
                    "modelPending": prediction is None,
                    "explanation": explain,
                    "tipTime": (
                        game_row.tipoff_at.isoformat()
                        if game_row
                        else (g.get("commence_time") or None)
                    ),
                    "commenceTime": g.get("commence_time"),
                    "injury": "None",
                    "projectedMinutes": (
                        mean([m for m in minutes if m is not None][:5])
                        if minutes and any(m is not None for m in minutes)
                        else None
                    ),
                    "lineUpdatedAt": captured.isoformat()
                    if hasattr(captured, "isoformat")
                    else str(captured),
                    "headshot": player.headshot_url,
                }
            )

        # Close platform props that disappeared from the live feed
        stale = (
            db.execute(
                select(Prop).where(
                    Prop.league == code,
                    Prop.status == "open",
                    Prop.id.like(f"{code.lower()}:pickem:{app}:%"),
                )
            )
            .scalars()
            .all()
        )
        for prop in stale:
            if prop.id not in seen_prop_ids:
                prop.status = "closed"

        job.rows_written = len(board_rows)
        db.commit()

    if code in {"ATP", "WTA"} and board_rows:
        _mirror_tennis_sibling_board(db, source_league=code, platform=app, board_rows=board_rows)

    updated = (latest_capture or datetime.now(timezone.utc)).isoformat()
    source = fetch.source or "pickem-aggregator"
    source_labels = {
        "propline": "PropLine",
        "sharpapi": "SharpAPI",
        "the-odds-api": "The Odds API",
    }
    source_label = source_labels.get(source, source)
    result = _finalize_platform_board(
        db,
        league=code,
        platform=app,
        label=label,
        board_rows=board_rows,
        updated=updated,
        syncedAt=datetime.now(timezone.utc).isoformat(),
        source=source,
        note=None if board_rows else f"No current {label} props for {code} after sync.",
        disclaimer=(
            f"Lines are live {label} props via {source_label}. "
            "Projections are Seraphim model estimates vs those lines — not invented lines."
        ),
    )
    result["pickemSource"] = source
    result["pickemAttempts"] = attempt_meta
    missing = [name for name, ok in keyed if not ok]
    if missing:
        result["requiresAdditionalKeys"] = missing
    return result


def _mirror_tennis_sibling_board(
    db: Session,
    *,
    source_league: str,
    platform: str,
    board_rows: list[dict[str, Any]],
) -> None:
    """PropLine uses one `tennis` sport key — mirror live lines to the other tour board."""
    sibling = "WTA" if source_league == "ATP" else "ATP" if source_league == "WTA" else None
    if not sibling or not board_rows:
        return
    mirrored = 0
    for row in board_rows:
        player = db.get(Player, row.get("playerWarehouseId")) if row.get("playerWarehouseId") else None
        if player is None:
            # Resolve by external id
            ext = row.get("playerId")
            if ext:
                player = db.execute(
                    select(Player).where(Player.external_id == str(ext))
                ).scalar_one_or_none()
        if player is None:
            continue
        prop = _upsert_platform_prop(
            db,
            league=sibling,
            platform=platform,
            player=player,
            market=str(row.get("market") or "Aces"),
            side=str(row.get("side") or "Over"),
            line=float(row.get("line") or 0),
            game_id=None,
        )
        db.flush()
        analytics = db.execute(
            select(PropAnalytics).where(PropAnalytics.prop_id == prop.id)
        ).scalar_one_or_none()
        if not analytics:
            analytics = PropAnalytics(id=str(uuid.uuid4()), prop_id=prop.id, league=sibling)
            db.add(analytics)
        analytics.league = sibling
        analytics.projected_value = row.get("projectedValue")
        analytics.comparison_line = float(row.get("line") or 0)
        analytics.edge_vs_line = row.get("edgeVsLine")
        analytics.confidence_score = int(row.get("confidence") or 0)
        analytics.research_score = int(row.get("researchScore") or 0)
        analytics.ev_percent = float(row.get("evPercent") or 0)
        analytics.no_vig_prob = float(row.get("noVigProb") or 0.5)
        analytics.matchup_note = row.get("game")
        analytics.is_model_estimate = bool(row.get("isModelEstimate"))
        analytics.odds_are_mock = False
        analytics.computed_at = datetime.now(timezone.utc)
        # Copy odds so sibling board cache can resolve platform quotes
        from app.providers.base import NormalizedOddsQuote

        for side_name, odds_key in (("Over", "overOdds"), ("Under", "underOdds")):
            american = row.get(odds_key)
            if american is None:
                continue
            q = NormalizedOddsQuote(
                league=sibling,
                player_external_id=str(player.external_id or player.id),
                player_name=str(row.get("player") or player.full_name),
                market=str(row.get("market") or ""),
                side=side_name,
                line=float(row.get("line") or 0),
                american_odds=int(american),
                sportsbook_slug=str(row.get("platformSlug") or platform),
                sportsbook_name=str(row.get("platformName") or platform),
                game_external_id=None,
                captured_at=datetime.now(timezone.utc),
                is_mock=False,
                source_provider=str(row.get("sourceProvider") or "propline"),
                home_team=None,
                away_team=None,
                raw={"commence_time": row.get("commenceTime") or row.get("tipTime")},
            )
            insert_odds(db, q, prop.id, provider_name=q.source_provider or "propline")
        mirrored += 1
    if mirrored:
        db.commit()
        log.info("mirrored %s tennis pick'em props %s → %s", mirrored, source_league, sibling)


def _apply_upcoming_slate_filter(
    db: Session,
    *,
    league: str,
    platform: str,
    board_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Drop finished tips, attach tip times, and close stale warehouse props."""
    filtered, meta = enrich_and_filter_upcoming_props(
        board_rows,
        league=league,
        drop_unknown_when_upcoming_exist=False,
    )
    keep_ids = {str(r.get("id")) for r in filtered if r.get("id")}
    if meta.get("droppedFinished"):
        code = normalize_league(league)
        prefix = f"{code.lower()}:pickem:{platform}:"
        open_props = (
            db.execute(
                select(Prop).where(
                    Prop.league == code,
                    Prop.status == "open",
                    Prop.id.like(f"{prefix}%"),
                )
            )
            .scalars()
            .all()
        )
        closed = 0
        for prop in open_props:
            if prop.id not in keep_ids:
                was_on_board = any(str(r.get("id")) == prop.id for r in board_rows)
                if was_on_board:
                    prop.status = "closed"
                    closed += 1
        if closed:
            db.commit()
            log.info(
                "closed %s finished %s/%s pick'em props (upcoming slate filter)",
                closed,
                code,
                platform,
            )
    return filtered


def _finalize_platform_board(
    db: Session,
    *,
    league: str,
    platform: str,
    label: str,
    board_rows: list[dict[str, Any]],
    updated: str,
    **extra: Any,
) -> dict[str, Any]:
    code = normalize_league(league)
    filtered = _apply_upcoming_slate_filter(
        db, league=code, platform=platform, board_rows=board_rows
    )
    filtered.sort(
        key=lambda r: (
            -(r.get("edgePercent") if r.get("edgePercent") is not None else -999),
            r.get("tipTime") or "",
            r.get("player") or "",
        )
    )
    with_model = sum(1 for r in filtered if r.get("projectedValue") is not None)
    note = extra.pop("note", None)
    if not filtered and board_rows:
        suffix = (
            "All cached tips look finished — waiting on PropLine for the next PrizePicks slate."
        )
        note = f"{note} {suffix}".strip() if note else suffix
    return {
        "ok": True,
        "league": code,
        "platform": platform,
        "platformLabel": label,
        "props": filtered,
        "players": _players_from_board(filtered, label),
        "count": len(filtered),
        "modeledCount": with_model,
        "updatedAt": updated,
        "propsUpdatedAt": updated,
        "dataSource": f"pickem:{platform}",
        "live": True,
        "note": note,
        **extra,
    }


def _players_from_board(props: list[dict[str, Any]], label: str) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    # Prefer modeled props when choosing each player's featured card lean
    ordered = sorted(
        props,
        key=lambda p: (
            0 if p.get("projectedValue") is not None else 1,
            -(abs(float(p.get("edgePercent") or p.get("edgeVsLine") or 0))),
        ),
    )
    for p in ordered:
        pid = str(
            p.get("playerId")
            or p.get("playerExternalId")
            or p.get("playerWarehouseId")
            or ""
        )
        if not pid or pid in seen:
            continue
        seen.add(pid)
        name = str(p.get("player") or "")
        initials = "".join(part[0] for part in name.split()[:2] if part).upper() or "?"
        out.append(
            {
                "id": pid,
                "name": name,
                "team": p.get("team") or "",
                "opponent": p.get("opponent") or "",
                "position": p.get("position") or "",
                "headshotInitials": initials,
                "confidence": p.get("confidence") or 0,
                "researchScore": p.get("researchScore") or 0,
                "matchupNote": p.get("game") or f"{p.get('market')} · {label}",
                "tipTime": p.get("tipTime") or p.get("commenceTime"),
                "topPropId": p.get("id"),
                "topMarket": p.get("market"),
                "topSide": p.get("side"),
                "topLine": p.get("line"),
                "topLean": f"{p.get('side')} {p.get('line')}",
                "playerWarehouseId": p.get("playerWarehouseId"),
                "playerExternalId": p.get("playerExternalId"),
            }
        )
    return out


def _apply_prediction_to_analytics(
    *,
    analytics: PropAnalytics,
    prediction: Any,
    platform_line: float,
    side: str,
    over_odds: int,
    under_odds: int,
    settings: Any,
    matchup_note: Optional[str] = None,
) -> dict[str, Any]:
    """Write model output onto PropAnalytics and return board metric fields."""
    projected = float(prediction.projected_value)
    edge = (
        float(prediction.edge_vs_line)
        if prediction.edge_vs_line is not None
        else round(projected - platform_line, 2)
    )
    over_p = float(prediction.over_probability)
    under_p = float(prediction.under_probability)
    lean_side = "Over" if projected >= platform_line else "Under"
    edge_pct = model_edge_percent(
        projected=projected,
        line=platform_line,
        over_probability=over_p,
        under_probability=under_p,
        side=lean_side,
    )
    ev = expected_value(
        over_p if lean_side == "Over" else under_p,
        over_odds if lean_side == "Over" else under_odds,
    )
    analytics.projected_value = projected
    analytics.comparison_line = platform_line
    analytics.edge_vs_line = edge
    analytics.over_probability = over_p
    analytics.under_probability = under_p
    analytics.no_vig_prob = over_p if lean_side == "Over" else under_p
    analytics.ev_percent = round(ev, 2)
    analytics.confidence_score = int(prediction.confidence_score)
    analytics.research_score = int(prediction.research_score)
    analytics.data_quality_score = prediction.data_quality_score
    analytics.model_version = prediction.model_version
    analytics.explain_bullets = list(prediction.explanation)
    analytics.influential_factors = list(prediction.influential_factors or [])
    if matchup_note:
        analytics.matchup_note = matchup_note
    analytics.is_model_estimate = True
    analytics.odds_are_mock = False
    analytics.disclaimer = settings.model_disclaimer
    analytics.computed_at = datetime.now(timezone.utc)
    if prediction.l5 and prediction.l10 and prediction.l20 and prediction.season:
        analytics.l5_hits, analytics.l5_samples, analytics.l5_rate = (
            prediction.l5.hits,
            prediction.l5.samples,
            prediction.l5.rate,
        )
        analytics.l10_hits, analytics.l10_samples, analytics.l10_rate = (
            prediction.l10.hits,
            prediction.l10.samples,
            prediction.l10.rate,
        )
        analytics.l20_hits, analytics.l20_samples, analytics.l20_rate = (
            prediction.l20.hits,
            prediction.l20.samples,
            prediction.l20.rate,
        )
        analytics.season_hits, analytics.season_samples, analytics.season_rate = (
            prediction.season.hits,
            prediction.season.samples,
            prediction.season.rate,
        )
    return {
        "projectedValue": projected,
        "edgeVsLine": edge,
        "edgePercent": edge_pct,
        "confidence": int(prediction.confidence_score),
        "researchScore": int(prediction.research_score),
        "evPercent": round(ev, 2),
        "noVigProb": over_p if lean_side == "Over" else under_p,
        "side": lean_side if side else lean_side,
        "isModelEstimate": True,
        "modelPending": False,
        "explanation": list(prediction.explanation),
    }


def _remodel_pending_board_rows(
    db: Session,
    *,
    league: str,
    rows: list[tuple[Prop, PropAnalytics, Player]],
) -> None:
    """Fill missing projections for cached platform props (no PropLine call)."""
    settings = get_settings()
    code = normalize_league(league)
    remodeled = 0
    attempted = 0
    for prop, analytics, player in rows:
        if analytics.projected_value is not None or player is None:
            continue
        if attempted >= REMODEL_PENDING_LIMIT:
            break
        attempted += 1
        prediction, *_rest, hydrated = _build_prediction_for_player(
            db,
            league=code,
            player=player,
            market=prop.market,
            platform_line=float(prop.line),
        )
        if hydrated.id != player.id:
            prop.player_id = hydrated.id
            player = hydrated
        if prediction is None:
            continue
        _apply_prediction_to_analytics(
            analytics=analytics,
            prediction=prediction,
            platform_line=float(prop.line),
            side=prop.side or "Over",
            over_odds=100,
            under_odds=100,
            settings=settings,
        )
        # Align prop lean with model when we finally have a projection
        prop.side = "Over" if prediction.projected_value >= float(prop.line) else "Under"
        remodeled += 1
    if remodeled or attempted:
        db.commit()
        log.info(
            "remodeled %s/%s pending %s pick'em props this pass",
            remodeled,
            attempted,
            code,
        )


def _list_cached_platform_board(
    db: Session,
    *,
    league: str,
    platform: str,
    slugs: frozenset[str],
    allow_stale: bool = False,
    max_age: Optional[timedelta] = None,
) -> Optional[dict[str, Any]]:
    """Return a recently synced platform board without calling PropLine again."""
    from app.db.models import Odds, Sportsbook

    code = normalize_league(league)
    label = PICKEM_APP_LABELS.get(platform, platform)
    prefix = f"{code.lower()}:pickem:{platform}:"
    props = (
        db.execute(
            select(Prop, PropAnalytics, Player)
            .join(PropAnalytics, PropAnalytics.prop_id == Prop.id)
            .outerjoin(Player, Player.id == Prop.player_id)
            .where(Prop.league == code, Prop.status == "open", Prop.id.like(f"{prefix}%"))
            .order_by(PropAnalytics.research_score.desc())
        )
        .all()
    )
    if not props:
        # Tennis: PropLine is one sport feed — try the sibling tour cache.
        if code in {"ATP", "WTA"}:
            sibling = "WTA" if code == "ATP" else "ATP"
            sib_prefix = f"{sibling.lower()}:pickem:{platform}:"
            props = (
                db.execute(
                    select(Prop, PropAnalytics, Player)
                    .join(PropAnalytics, PropAnalytics.prop_id == Prop.id)
                    .outerjoin(Player, Player.id == Prop.player_id)
                    .where(
                        Prop.league == sibling,
                        Prop.status == "open",
                        Prop.id.like(f"{sib_prefix}%"),
                    )
                    .order_by(PropAnalytics.research_score.desc())
                )
                .all()
            )
        if not props:
            return None

    # Freshness: newest odds capture for this platform
    prop_ids = [p.id for p, _, _ in props]
    odds_rows = (
        db.execute(
            select(Odds, Sportsbook)
            .join(Sportsbook, Sportsbook.id == Odds.sportsbook_id)
            .where(Odds.prop_id.in_(prop_ids), Sportsbook.slug.in_(list(slugs)))
            .order_by(Odds.captured_at.desc())
        )
        .all()
    )
    if not odds_rows:
        return None
    newest = odds_rows[0][0].captured_at
    if newest.tzinfo is None:
        newest = newest.replace(tzinfo=timezone.utc)
    age = datetime.now(timezone.utc) - newest
    ttl = max_age if (allow_stale and max_age is not None) else PLATFORM_CACHE_TTL
    if allow_stale and max_age is None:
        ttl = timedelta(days=2)
    if age > ttl:
        return None

    # Remodel any props still missing projections (e.g. stubs now resolvable)
    _remodel_pending_board_rows(db, league=code, rows=list(props))
    # Re-read analytics after remodel
    props = (
        db.execute(
            select(Prop, PropAnalytics, Player)
            .join(PropAnalytics, PropAnalytics.prop_id == Prop.id)
            .outerjoin(Player, Player.id == Prop.player_id)
            .where(Prop.league == code, Prop.status == "open", Prop.id.like(f"{prefix}%"))
            .order_by(PropAnalytics.research_score.desc())
        )
        .all()
    )

    # Rebuild board rows from warehouse (already platform-scoped)
    odds_by_prop: dict[str, list] = {}
    for o, book in odds_rows:
        odds_by_prop.setdefault(o.prop_id, []).append((o, book))

    board: list[dict[str, Any]] = []
    for prop, analytics, player in props:
        hits = odds_by_prop.get(prop.id) or []
        if not hits:
            continue  # must have live platform odds
        over = next((o for o, _ in hits if (o.side or "").lower() == "over"), hits[0][0])
        under = next((o for o, _ in hits if (o.side or "").lower() == "under"), None)
        line = float(over.line)
        projected = analytics.projected_value
        edge = analytics.edge_vs_line
        over_p = float(analytics.over_probability or 0.5)
        under_p = float(analytics.under_probability or (1.0 - over_p))
        if projected is not None:
            edge_pct = model_edge_percent(
                projected=float(projected),
                line=line,
                over_probability=over_p,
                under_probability=under_p,
                side=prop.side,
            )
        else:
            edge_pct = None
        team, opponent = _team_opponent_from_matchup_note(analytics.matchup_note)
        board.append(
            {
                "id": prop.id,
                "playerId": _board_player_ids(player)[0],
                "playerExternalId": _board_player_ids(player)[1],
                "playerWarehouseId": _board_player_ids(player)[2],
                "player": player.full_name if player else "Player",
                "team": team,
                "opponent": opponent,
                "position": (player.position if player else None) or "",
                "market": prop.market,
                "stat": prop.market,
                "side": prop.side,
                "line": line,
                "platformLine": line,
                "americanOdds": over.american_odds,
                "overOdds": over.american_odds,
                "underOdds": under.american_odds if under else 100,
                "projectedValue": projected,
                "edgeVsLine": edge,
                "edgePercent": edge_pct,
                "confidence": analytics.confidence_score or 0,
                "researchScore": analytics.research_score or 0,
                "evPercent": analytics.ev_percent or 0,
                "noVigProb": analytics.no_vig_prob or 0.5,
                "l5": f"{analytics.l5_hits or 0}/{analytics.l5_samples or 0}",
                "l10": f"{analytics.l10_hits or 0}/{analytics.l10_samples or 0}",
                "l20": f"{analytics.l20_hits or 0}/{analytics.l20_samples or 0}",
                "season": f"{analytics.season_hits or 0}/{analytics.season_samples or 0}",
                "game": analytics.matchup_note or "TBD",
                "sport": code,
                "league": code,
                "platform": platform,
                "platformSlug": hits[0][1].slug,
                "platformName": hits[0][1].name or label,
                "sourceProvider": over.provider,
                "oddsAreMock": False,
                "oddsRole": "platform-live",
                "isModelEstimate": bool(analytics.is_model_estimate),
                "modelPending": analytics.projected_value is None,
                "explanation": analytics.explain_bullets or [],
                "lineUpdatedAt": newest.isoformat(),
                "headshot": player.headshot_url if player else None,
                "injury": "None",
            }
        )

    if not board:
        return None

    updated = newest.isoformat()
    return _finalize_platform_board(
        db,
        league=code,
        platform=platform,
        label=label,
        board_rows=board,
        updated=updated,
        syncedAt=updated,
        cached=True,
        stale=allow_stale and age > PLATFORM_CACHE_TTL,
        source="propline-cache",
        disclaimer=(
            f"Cached live {label} props"
            f"{' (stale — PropLine refresh deferred)' if allow_stale and age > PLATFORM_CACHE_TTL else f' (refreshed within {int(PLATFORM_CACHE_TTL.total_seconds() // 60)}m)'}. "
            "Upcoming tips only — finished games are removed. "
            "Projections are Seraphim estimates vs those lines."
        ),
    )


def ensure_pickem_platform_board(
    db: Session,
    *,
    league: str,
    platform: str,
    refresh: bool = False,
) -> dict[str, Any]:
    """Public entry used by board API routes."""
    return sync_pickem_platform_board(
        db, league=league, platform=platform, force=refresh
    )
