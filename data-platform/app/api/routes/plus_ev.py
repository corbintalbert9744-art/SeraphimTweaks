"""Positive Expected Value (+EV) board API."""

from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.analytics.plus_ev import PLUS_EV_THRESHOLD, STRONG_PLUS_EV_THRESHOLD, enrich_prop_with_plus_ev
from app.db.session import get_db
from app.ingestion.comparison_books import build_live_odds_comparison
from app.ingestion.plus_ev_board import build_plus_ev_board

router = APIRouter(prefix="/plus-ev", tags=["plus-ev"])

SortParam = Literal["ev", "edge", "confidence", "researchScore"]


@router.get("")
def plus_ev_board(
    platform: Optional[str] = Query(None, description="Pick'em app: prizepicks|underdog|sleeper|other"),
    league: Optional[str] = Query(None, description="NBA|WNBA|NFL|… or All"),
    sort: SortParam = Query("ev", description="ev|edge|confidence|researchScore"),
    plusEvOnly: bool = Query(True, description="Only props meeting the +EV threshold"),
    minEv: Optional[float] = Query(None, description="Override minimum EV %"),
    limit: int = Query(80, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return build_plus_ev_board(
        db,
        platform=platform,
        league=None if not league or league == "All" else league,
        sort_by=sort,
        plus_ev_only=plusEvOnly,
        min_ev=minEv,
        limit=limit,
        include_market_detail=True,
    )


@router.get("/thresholds")
def plus_ev_thresholds():
    return {
        "ok": True,
        "plusEvThreshold": PLUS_EV_THRESHOLD,
        "strongPlusEvThreshold": STRONG_PLUS_EV_THRESHOLD,
        "sortKeys": ["ev", "edge", "confidence", "researchScore"],
    }


@router.get("/prop/{prop_id:path}")
def plus_ev_for_prop(
    prop_id: str,
    league: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Per-prop +EV breakdown across every available connected market line."""
    from app.api.routes.odds_comparison import _prop_base

    base, resolved = _prop_base(db, prop_id, league)
    projected = float(base.get("projectedValue") or base.get("line") or 0)
    side = str(base.get("recommendation") or base.get("side") or "Over")
    comparison = build_live_odds_comparison(
        db,
        league=resolved,
        base=base,
        projected=projected,
        model_side=side if side in ("Over", "Under") else "Over",
    )
    enriched = enrich_prop_with_plus_ev(
        {**base, "league": resolved},
        books=comparison.get("books") or [],
    )
    return {
        "ok": True,
        "propId": prop_id,
        "league": resolved,
        "threshold": PLUS_EV_THRESHOLD,
        "prop": enriched,
        "books": comparison.get("books") or [],
        "marketEv": enriched.get("marketEv") or [],
        "bestEv": enriched.get("bestEv"),
        "isPlusEv": enriched.get("isPlusEv"),
    }
