from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.ingestion.nba_board import (
    ensure_nba_board,
    get_nba_player_profile,
    get_nba_prop_detail,
    import_nba_slate,
    list_nba_player_cards,
)
from app.ingestion.nba_pipeline import (
    build_and_store_featured_prop,
    build_command_center,
    import_nba_injuries_for_open_games,
    import_nba_schedule,
    recalculate_open_prop_analytics,
)
from app.ingestion.nba_sync import sync_nba_warehouse
from app.providers.registry import get_nba_providers

router = APIRouter(prefix="/nba", tags=["nba"])


@router.get("/games")
def nba_games(dates: Optional[str] = Query(None), db: Session = Depends(get_db)):
    providers = get_nba_providers()
    games = providers.schedule.fetch_schedule("NBA", dates) if providers.schedule else []
    try:
        import_nba_schedule(db, dates)
    except Exception:
        pass
    return {
        "date": dates,
        "source": "espn",
        "games": [
            {
                "id": g.external_id,
                "name": f"{g.away_name} at {g.home_name}",
                "shortName": f"{g.away_abbr} @ {g.home_abbr}",
                "tipoffAt": g.tipoff_at.isoformat(),
                "status": g.status,
                "statusDetail": g.status,
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
def nba_props(
    refresh: bool = Query(False, description="Force re-ingest slate"),
    db: Session = Depends(get_db),
):
    """Live NBA research board from warehouse (auto-ingests if empty)."""
    payload = ensure_nba_board(db, force=refresh)
    teams = sorted({p["team"] for p in payload["props"] if p.get("team")})
    return {
        **payload,
        "teams": ["All", *teams],
        "live": True,
        "disclaimer": "Projections are Seraphim model estimates — not sportsbook copies.",
    }


@router.get("/props/{prop_id}")
def nba_prop_detail(prop_id: str, db: Session = Depends(get_db)):
    ensure_nba_board(db, force=False)
    detail = get_nba_prop_detail(db, prop_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Prop not found")
    return {"ok": True, "prop": detail, "live": True}


@router.get("/players")
def nba_players(db: Session = Depends(get_db)):
    ensure_nba_board(db, force=False)
    players = list_nba_player_cards(db)
    return {"ok": True, "players": players, "count": len(players), "live": True}


@router.get("/players/{player_id}")
def nba_player_detail(player_id: str, db: Session = Depends(get_db)):
    ensure_nba_board(db, force=False)
    profile = get_nba_player_profile(db, player_id)
    if not profile or not (profile.get("markets") or []):
        raise HTTPException(status_code=404, detail="Player not found")
    return {"ok": True, "player": profile, "live": True}


@router.get("/featured-prop")
def featured_prop(gameId: Optional[str] = Query(None), db: Session = Depends(get_db)):
    return build_and_store_featured_prop(db, gameId)


@router.get("/command-center")
def command_center(db: Session = Depends(get_db)):
    return build_command_center(db)


@router.post("/jobs/import-schedule")
def job_import_schedule(dates: Optional[str] = None, db: Session = Depends(get_db)):
    return import_nba_schedule(db, dates)


@router.post("/jobs/import-injuries")
def job_import_injuries(db: Session = Depends(get_db)):
    return import_nba_injuries_for_open_games(db)


@router.post("/jobs/import-slate")
def job_import_slate(
    max_games: int = 8,
    per_team: int = 3,
    db: Session = Depends(get_db),
):
    return import_nba_slate(
        db,
        max_games=max_games,
        per_team=per_team,
        markets=("Points", "Rebounds", "Assists"),
    )


@router.post("/jobs/sync")
def job_sync_warehouse(
    dates: Optional[str] = None,
    max_games: int = 8,
    per_team: int = 3,
    db: Session = Depends(get_db),
):
    """Full ESPN → warehouse sync: schedule, players, gamelogs, injuries, props."""
    return sync_nba_warehouse(
        db,
        date=dates,
        max_games=max_games,
        per_team=per_team,
    )


@router.post("/jobs/recalculate-analytics")
def job_recalc(db: Session = Depends(get_db)):
    return recalculate_open_prop_analytics(db)
