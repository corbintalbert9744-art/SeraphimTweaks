"""Arbitrage Finder API — guaranteed Over/Under arbs across sportsbooks."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.analytics.arbitrage import DEFAULT_TOTAL_STAKE
from app.db.session import get_db
from app.ingestion.arbitrage_board import (
    REFRESH_SECONDS,
    build_arbitrage_board,
    scan_prop_arbitrage,
)

router = APIRouter(prefix="/arbitrage", tags=["arbitrage"])


@router.get("")
def arbitrage_board(
    league: Optional[str] = Query(None, description="NBA|WNBA|… or All"),
    totalStake: float = Query(DEFAULT_TOTAL_STAKE, ge=1, le=1_000_000),
    minProfitPct: float = Query(0.0, ge=0, le=50),
    limit: int = Query(40, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return build_arbitrage_board(
        db,
        league=None if not league or league == "All" else league,
        total_stake=totalStake,
        min_profit_pct=minProfitPct,
        limit=limit,
    )


@router.get("/meta")
def arbitrage_meta():
    return {
        "ok": True,
        "refreshSeconds": REFRESH_SECONDS,
        "defaultTotalStake": DEFAULT_TOTAL_STAKE,
        "excludedKinds": ["pickem"],
        "notes": (
            "Scans connected sportsbooks only. Compares best Over vs best Under "
            "at matching lines. Profit when implied probabilities sum below 100%."
        ),
    }


@router.get("/prop/{prop_id:path}")
def arbitrage_for_prop(
    prop_id: str,
    league: Optional[str] = Query(None),
    totalStake: float = Query(DEFAULT_TOTAL_STAKE, ge=1, le=1_000_000),
    db: Session = Depends(get_db),
):
    from app.api.routes.odds_comparison import _prop_base

    base, resolved = _prop_base(db, prop_id, league)
    hit = scan_prop_arbitrage(
        db,
        {**base, "league": resolved},
        total_stake=totalStake,
    )
    if hit is None:
        return {
            "ok": True,
            "propId": prop_id,
            "league": resolved,
            "isArbitrage": False,
            "opportunity": None,
            "message": "No guaranteed Over/Under arbitrage at matching lines among connected sportsbooks.",
        }
    return {
        "ok": True,
        "propId": prop_id,
        "league": resolved,
        "isArbitrage": True,
        "opportunity": hit,
    }
