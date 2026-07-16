"""Live Odds Comparison API — provider-adapter backed, Postgres-timestamped lines."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.ingestion.comparison_books import build_live_odds_comparison
from app.ingestion.nba_board import get_nba_prop_detail, list_nba_props_from_warehouse
from app.ingestion.generic_board import list_league_props
from app.ingestion.wnba_board import get_wnba_prop_detail
from app.providers.comparison_lines import canonical_provider_catalog

router = APIRouter(prefix="/odds", tags=["odds-comparison"])

_LEAGUE_PREFIX = {
    "nba": "NBA",
    "wnba": "WNBA",
    "nfl": "NFL",
    "mlb": "MLB",
    "nhl": "NHL",
    "soccer": "Soccer",
    "atp": "ATP",
    "wta": "WTA",
}


def _infer_league(prop_id: str, league: str | None) -> str | None:
    if league:
        raw = league.strip()
        if raw.upper() == "SOCCER":
            return "Soccer"
        return raw.upper() if raw.upper() in {"NBA", "WNBA", "NFL", "MLB", "NHL", "ATP", "WTA"} else raw
    prefix = prop_id.split(":")[0].lower() if ":" in prop_id else ""
    return _LEAGUE_PREFIX.get(prefix)


def _prop_base(db: Session, prop_id: str, league: str | None) -> tuple[dict, str]:
    """Resolve a prop row + league for comparison.

    Prefer board rows + build_live_odds_comparison over full detail builders so a
    secondary research-detail bug cannot blank the entire Live Odds table.
    """
    inferred = _infer_league(prop_id, league)
    order = (
        [inferred]
        if inferred
        else ["NBA", "WNBA", "NFL", "MLB", "NHL", "Soccer", "ATP", "WTA"]
    )
    for code in order:
        if code == "NBA":
            board = {p["id"]: p for p in list_nba_props_from_warehouse(db)}
            if prop_id in board:
                return board[prop_id], "NBA"
            try:
                detail = get_nba_prop_detail(db, prop_id)
            except Exception:  # noqa: BLE001 — comparison must degrade gracefully
                detail = None
            if detail:
                return detail, "NBA"
        elif code == "WNBA":
            from app.ingestion.wnba_board import list_wnba_props_from_warehouse

            board = {p["id"]: p for p in list_wnba_props_from_warehouse(db)}
            if prop_id in board:
                return board[prop_id], "WNBA"
            try:
                detail = get_wnba_prop_detail(db, prop_id)
            except Exception:  # noqa: BLE001
                detail = None
            if detail:
                return detail, "WNBA"
        props = list_league_props(db, code)
        row = next((p for p in props if p["id"] == prop_id), None)
        if row:
            return row, code

    if inferred:
        # Fallback full scan if inferred league missed
        for code in ("NBA", "WNBA", "NFL", "MLB", "NHL", "Soccer", "ATP", "WTA"):
            if code == inferred:
                continue
            props = list_league_props(db, code)
            row = next((p for p in props if p["id"] == prop_id), None)
            if row:
                return row, code

    raise HTTPException(status_code=404, detail="Prop not found")


@router.get("/providers")
def odds_providers():
    """Canonical sportsbook + pick'em catalog + upstream adapter configuration status.

    Operator rows stay unavailable until a live quote is captured — never fabricated.
    """
    from app.providers.line_aggregation.factory import get_line_aggregator

    try:
        agg = get_line_aggregator().status()
        adapters = list(agg.get("adapters") or [])
    except Exception:  # noqa: BLE001 — status must never 500 the catalog
        adapters = []
    configured = [a for a in adapters if a.get("configured")]
    return {
        "ok": True,
        "providers": canonical_provider_catalog(),
        "adapters": adapters,
        "configuredAdapterCount": len(configured),
        "disclaimer": (
            "Connected books only show live captured lines. "
            "Unavailable operators stay blank — market data is never fabricated."
        ),
    }


@router.get("/comparison/{prop_id:path}")
def live_odds_comparison(
    prop_id: str,
    league: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Live Odds Comparison table for one player prop.

    Returns every canonical operator with live lines when available,
    best-line highlight, line-diff flags, and last update timestamps from Postgres.
    """
    base, resolved_league = _prop_base(db, prop_id, league)
    # Detail builders already attach a full oddsComparison payload
    existing = base.get("oddsComparison")
    if isinstance(existing, dict) and existing.get("books"):
        return {
            "ok": True,
            "propId": prop_id,
            "league": resolved_league,
            "player": base.get("player"),
            "market": base.get("market"),
            "side": base.get("recommendation") or base.get("side"),
            "line": base.get("line"),
            "projectedValue": base.get("projectedValue") or base.get("line"),
            **existing,
        }

    projected = float(base.get("projectedValue") or base.get("line") or 0)
    model_side = str(base.get("recommendation") or base.get("side") or "Over")
    comparison = build_live_odds_comparison(
        db,
        league=resolved_league,
        base=base,
        projected=projected,
        model_side=model_side,
    )
    return {
        "ok": True,
        "propId": prop_id,
        "league": resolved_league,
        "player": base.get("player"),
        "market": base.get("market"),
        "side": model_side,
        "line": base.get("line"),
        "projectedValue": projected,
        **comparison,
    }
