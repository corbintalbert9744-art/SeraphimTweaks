"""Assemble the cross-league +EV board from warehouse props + live market lines."""

from __future__ import annotations

import logging
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.analytics.plus_ev import (
    PLUS_EV_THRESHOLD,
    SortKey,
    enrich_prop_with_plus_ev,
    sort_plus_ev_props,
)
from app.ingestion.comparison_books import build_live_odds_comparison
from app.ingestion.generic_board import list_league_props
from app.ingestion.nba_board import list_nba_props_from_warehouse
from app.ingestion.platform_board import normalize_pickem_app
from app.ingestion.wnba_board import list_wnba_props_from_warehouse

log = logging.getLogger(__name__)

BOARD_LEAGUES = ("NBA", "WNBA", "NFL", "MLB", "NHL", "Soccer", "ATP", "WTA")


def _is_live_optional(prop: dict[str, Any]) -> bool:
    pid = str(prop.get("id") or "")
    if ":pickem:" in pid:
        return True
    if prop.get("oddsAreMock") is False:
        return True
    if prop.get("oddsAreMock") is True:
        return False
    # Warehouse comparison-only rows without live pick'em id are not +EV board fodder
    return False


def _scope_platform(props: list[dict[str, Any]], platform: Optional[str]) -> list[dict[str, Any]]:
    app = normalize_pickem_app(platform) if platform else None
    if not app:
        return props
    slug = app  # prizepicks | underdog | …
    out = []
    for p in props:
        pid = str(p.get("id") or "").lower()
        p_slug = str(p.get("platformSlug") or p.get("platform") or "").lower()
        if f":{slug}:" in pid or p_slug == slug or f"pickem:{slug}" in pid:
            out.append(p)
    return out


def _collect_league_props(db: Session, league: str) -> list[dict[str, Any]]:
    code = league.upper() if league.upper() != "SOCCER" else "Soccer"
    if code == "NBA":
        return list_nba_props_from_warehouse(db)
    if code == "WNBA":
        return list_wnba_props_from_warehouse(db)
    return list_league_props(db, code)


def _attach_books(db: Session, prop: dict[str, Any]) -> list[dict[str, Any]]:
    league = str(prop.get("league") or "NBA")
    projected = float(prop.get("projectedValue") or prop.get("line") or 0)
    side = str(prop.get("recommendation") or prop.get("side") or "Over")
    try:
        comparison = build_live_odds_comparison(
            db,
            league=league,
            base=prop,
            projected=projected,
            model_side=side if side in ("Over", "Under") else "Over",
        )
        return list(comparison.get("books") or [])
    except Exception:  # noqa: BLE001
        log.exception("plus-ev books failed for %s", prop.get("id"))
        return list(prop.get("books") or [])


def build_plus_ev_board(
    db: Session,
    *,
    platform: Optional[str] = None,
    league: Optional[str] = None,
    sort_by: SortKey = "ev",
    plus_ev_only: bool = True,
    min_ev: Optional[float] = None,
    limit: int = 100,
    include_market_detail: bool = True,
) -> dict[str, Any]:
    """Cross-league +EV board ranked by EV / edge / confidence / research score."""
    leagues = [league] if league and league != "All" else list(BOARD_LEAGUES)
    raw: list[dict[str, Any]] = []
    for lg in leagues:
        try:
            rows = _collect_league_props(db, lg)
        except Exception:  # noqa: BLE001
            log.exception("plus-ev league load failed %s", lg)
            continue
        for row in rows:
            row = {**row, "league": row.get("league") or lg}
            if not _is_live_optional(row):
                continue
            raw.append(row)

    raw = _scope_platform(raw, platform)

    # Cap pre-enrichment work for responsiveness
    raw = raw[: max(limit * 3, 120)]

    enriched: list[dict[str, Any]] = []
    for prop in raw:
        books = _attach_books(db, prop) if include_market_detail else (prop.get("books") or [])
        row = enrich_prop_with_plus_ev(prop, books=books)
        if not include_market_detail:
            row.pop("marketEv", None)
        enriched.append(row)

    threshold = float(min_ev) if min_ev is not None else PLUS_EV_THRESHOLD
    if plus_ev_only:
        enriched = [
            p
            for p in enriched
            if p.get("isPlusEv")
            or (
                p.get("evPercent") is not None
                and float(p["evPercent"]) >= threshold
                and float(p.get("modelEdge") or 0) > 0
            )
        ]
    elif min_ev is not None:
        enriched = [
            p
            for p in enriched
            if p.get("evPercent") is not None and float(p["evPercent"]) >= min_ev
        ]

    ranked = sort_plus_ev_props(enriched, sort_by=sort_by)[:limit]
    plus_count = sum(1 for p in ranked if p.get("isPlusEv"))

    return {
        "ok": True,
        "threshold": PLUS_EV_THRESHOLD,
        "sortBy": sort_by,
        "platform": platform,
        "league": league or "All",
        "plusEvOnly": plus_ev_only,
        "count": len(ranked),
        "plusEvCount": plus_count,
        "props": ranked,
        "disclaimer": (
            "Expected value uses Seraphim model probability vs offered (or conventional "
            "pick'em −110) odds. Model estimates — not guaranteed win probabilities."
        ),
    }
