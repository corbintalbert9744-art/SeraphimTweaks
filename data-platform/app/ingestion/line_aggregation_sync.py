"""Sync aggregated multi-provider lines into Postgres (odds + line_snapshots).

Runs on the scheduler — pages read cached warehouse rows, not live vendor APIs.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import Player, Prop, PropAnalytics
from app.ingestion.warehouse import insert_odds
from app.providers.base import NormalizedOddsQuote, run_provider_job
from app.providers.line_aggregation.factory import get_line_aggregator
from app.providers.propline.markets import PICKEM_SLUGS, normalize_league

log = logging.getLogger(__name__)

SYNC_LEAGUES = ("NBA", "WNBA", "NFL", "MLB", "NHL", "Soccer", "ATP", "WTA")


def sync_aggregated_lines(
    db: Session, *, leagues: Optional[tuple[str, ...]] = None
) -> dict[str, Any]:
    """Fetch from all configured providers (priority + fallback) and cache in Postgres."""
    settings = get_settings()
    any_key = bool(
        settings.propline_api_key
        or settings.sharpapi_api_key
        or settings.odds_api_key
        or settings.antelytics_api_key
    )
    if not any_key:
        return {
            "ok": False,
            "provider": "line-aggregator",
            "requiresApiKey": True,
            "error": (
                "No line-provider API keys configured "
                "(PROPLINE_API_KEY / SHARPAPI_API_KEY / ODDS_API_KEY / ANTELYTICS_API_KEY). "
                "Comparison rows stay marked unavailable — not fabricated."
            ),
            "envVars": [
                "PROPLINE_API_KEY",
                "SHARPAPI_API_KEY",
                "ODDS_API_KEY",
                "ANTELYTICS_API_KEY",
            ],
        }

    aggregator = get_line_aggregator()
    targets = leagues or SYNC_LEAGUES
    result: dict[str, Any] = {
        "provider": "line-aggregator",
        "adapters": aggregator.status()["adapters"],
        "leagues": {},
        "ok": True,
    }

    for league in targets:
        code = normalize_league(league)
        with run_provider_job(db, provider="line-aggregator", league=code, job="sync_lines") as job:
            try:
                agg = aggregator.aggregate(code)
            except Exception as exc:  # noqa: BLE001
                log.exception("line aggregate %s failed", code)
                result["leagues"][code] = {"ok": False, "error": str(exc)}
                job.error = str(exc)
                continue

            matched, snaps = _apply_quotes_to_open_props(db, league=code, quotes=agg.quotes)
            job.rows_written = matched + snaps
            payload = agg.to_dict()
            payload["matchedProps"] = matched
            payload["snapshots"] = snaps
            payload["ok"] = True
            result["leagues"][code] = payload

    db.commit()
    return result


# Back-compat alias used by earlier PropLine-only wiring
sync_propline_lines = sync_aggregated_lines


def _apply_quotes_to_open_props(
    db: Session, *, league: str, quotes: list[NormalizedOddsQuote]
) -> tuple[int, int]:
    if not quotes:
        return 0, 0

    by_key: dict[tuple[str, str], list[NormalizedOddsQuote]] = {}
    for q in quotes:
        key = (q.player_name.lower().strip(), q.market.lower().strip())
        by_key.setdefault(key, []).append(q)

    rows = (
        db.execute(
            select(Prop, PropAnalytics, Player)
            .join(PropAnalytics, PropAnalytics.prop_id == Prop.id)
            .outerjoin(Player, Player.id == Prop.player_id)
            .where(Prop.league == league, Prop.status == "open")
        )
        .all()
    )

    matched_props = 0
    snapshots = 0
    now = datetime.now(timezone.utc)

    for prop, analytics, player in rows:
        pname = (player.full_name if player else "").lower().strip()
        if not pname:
            continue
        mlabel = (prop.market or "").lower().strip()
        hits = by_key.get((pname, mlabel))
        if not hits:
            hits = []
            for (pn, mk), qs in by_key.items():
                if mk == mlabel and (pname in pn or pn in pname):
                    hits.extend(qs)
        if not hits:
            continue

        matched_props += 1
        overs = [q for q in hits if q.side == "Over"]
        if overs:
            sports = [q for q in overs if q.sportsbook_slug not in PICKEM_SLUGS] or overs
            sports.sort(key=lambda q: q.line)
            consensus = sports[len(sports) // 2]
            analytics.comparison_line = float(consensus.line)
            if analytics.projected_value is not None:
                analytics.edge_vs_line = round(
                    float(analytics.projected_value) - float(consensus.line), 2
                )
            analytics.odds_are_mock = False
            analytics.computed_at = now

        for q in hits:
            source = q.source_provider or "line-aggregator"
            # insert_odds also writes a timestamped line_snapshots row
            insert_odds(db, q, prop.id, provider_name=source, write_snapshot=True)
            snapshots += 1

    return matched_props, snapshots
