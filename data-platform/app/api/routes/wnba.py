from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.ingestion.wnba_board import (
    ensure_wnba_board,
    get_wnba_player_profile,
    get_wnba_prop_detail,
    list_wnba_player_cards,
)
from app.providers.registry import get_wnba_providers

router = APIRouter(prefix="/wnba", tags=["wnba"])


@router.get("/games")
def wnba_games(dates: Optional[str] = Query(None), db: Session = Depends(get_db)):
    providers = get_wnba_providers()
    games = providers.schedule.fetch_schedule("WNBA", dates) if providers.schedule else []
    return {
        "date": dates,
        "source": "espn",
        "league": "WNBA",
        "games": [
            {
                "id": g.external_id,
                "name": f"{g.away_name} at {g.home_name}",
                "shortName": f"{g.away_abbr} @ {g.home_abbr}",
                "tipoffAt": g.tipoff_at.isoformat(),
                "status": g.status,
                "venue": g.venue,
                "home": {
                    "id": g.home_team_external_id,
                    "abbreviation": g.home_abbr,
                    "name": g.home_name,
                    "score": g.home_score,
                    "logo": g.home_logo,
                },
                "away": {
                    "id": g.away_team_external_id,
                    "abbreviation": g.away_abbr,
                    "name": g.away_name,
                    "score": g.away_score,
                    "logo": g.away_logo,
                },
            }
            for g in games
        ],
    }


@router.get("/props")
def wnba_props(
    refresh: bool = Query(False, description="Force re-ingest slate"),
    db: Session = Depends(get_db),
):
    """Live WNBA research board — ESPN + Seraphim projection; PrizePicks in Line Comparison."""
    payload = ensure_wnba_board(db, force=refresh)
    teams = sorted({p["team"] for p in payload["props"] if p.get("team")})
    return {
        **payload,
        "teams": ["All", *teams],
        "live": True,
        "comparisonNote": "PrizePicks appears in Line Comparison (placeholder until live pick'em adapter).",
        "disclaimer": "Projections are Seraphim model estimates — not PrizePicks or sportsbook copies.",
    }


@router.get("/props/{prop_id}")
def wnba_prop_detail(prop_id: str, db: Session = Depends(get_db)):
    ensure_wnba_board(db, force=False)
    detail = get_wnba_prop_detail(db, prop_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Prop not found")
    return {"ok": True, "prop": detail, "live": True}


@router.get("/players")
def wnba_players(db: Session = Depends(get_db)):
    ensure_wnba_board(db, force=False)
    players = list_wnba_player_cards(db)
    return {"ok": True, "players": players, "count": len(players), "live": True}


@router.get("/players/{player_id}")
def wnba_player_detail(player_id: str, db: Session = Depends(get_db)):
    ensure_wnba_board(db, force=False)
    profile = get_wnba_player_profile(db, player_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Player not found")
    return {"ok": True, "player": profile, "live": True}
