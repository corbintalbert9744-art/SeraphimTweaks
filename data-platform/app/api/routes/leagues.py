from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import get_db
from app.ingestion.generic_board import ensure_league_board, list_league_props
from app.ingestion.multi_sport_sync import (
    sync_all_sports,
    sync_mlb_warehouse,
    sync_nhl_warehouse,
    sync_soccer_warehouse,
    sync_tennis_warehouse,
)
from app.providers.registry import get_mlb_providers, get_nhl_providers, get_soccer_providers

router = APIRouter(tags=["leagues"])


def _games_payload(games) -> list[dict]:
    return [
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
            },
            "away": {
                "id": g.away_team_external_id,
                "abbreviation": g.away_abbr,
                "name": g.away_name,
                "score": g.away_score,
            },
        }
        for g in games
    ]


@router.get("/mlb/games")
def mlb_games(dates: str | None = Query(None), db: Session = Depends(get_db)):
    providers = get_mlb_providers()
    games = providers.schedule.fetch_schedule("MLB", dates) if providers.schedule else []
    return {"date": dates, "source": "mlb-statsapi", "live": True, "games": _games_payload(games)}


@router.get("/mlb/props")
def mlb_props(refresh: bool = Query(False), db: Session = Depends(get_db)):
    if refresh:
        sync_mlb_warehouse(db)
    else:
        existing = list_league_props(db, "MLB")
        if not existing:
            sync_mlb_warehouse(db)
    props = list_league_props(db, "MLB")
    teams = sorted({p["team"] for p in props if p.get("team")})
    return {
        "ok": True,
        "league": "MLB",
        "props": props,
        "count": len(props),
        "teams": ["All", *teams],
        "live": True,
        "source": "mlb-statsapi",
        "disclaimer": "Projections are Seraphim model estimates from imported MLB Stats API logs.",
    }


@router.post("/mlb/jobs/sync")
def mlb_sync(dates: str | None = Query(None), db: Session = Depends(get_db)):
    return sync_mlb_warehouse(db, date=dates)


@router.get("/nhl/games")
def nhl_games(dates: str | None = Query(None), db: Session = Depends(get_db)):
    providers = get_nhl_providers()
    games = providers.schedule.fetch_schedule("NHL", dates) if providers.schedule else []
    return {"date": dates, "source": "nhl-api", "live": True, "games": _games_payload(games)}


@router.get("/nhl/props")
def nhl_props(refresh: bool = Query(False), db: Session = Depends(get_db)):
    if refresh:
        sync_nhl_warehouse(db)
    else:
        existing = list_league_props(db, "NHL")
        if not existing:
            sync_nhl_warehouse(db)
    props = list_league_props(db, "NHL")
    teams = sorted({p["team"] for p in props if p.get("team")})
    return {
        "ok": True,
        "league": "NHL",
        "props": props,
        "count": len(props),
        "teams": ["All", *teams],
        "live": True,
        "source": "nhl-api",
        "disclaimer": "Projections are Seraphim model estimates from imported NHL API logs.",
    }


@router.post("/nhl/jobs/sync")
def nhl_sync(dates: str | None = Query(None), db: Session = Depends(get_db)):
    return sync_nhl_warehouse(db, date=dates)


@router.get("/soccer/games")
def soccer_games(dates: str | None = Query(None), db: Session = Depends(get_db)):
    providers = get_soccer_providers()
    if providers is None:
        settings = get_settings()
        return {
            "date": dates,
            "source": "football-data-org",
            "live": False,
            "games": [],
            "requiresApiKey": True,
            "configured": bool(settings.football_data_api_key),
            "error": "FOOTBALL_DATA_API_KEY not configured — no fabricated soccer fixtures.",
        }
    games = providers.schedule.fetch_schedule("Soccer", dates) if providers.schedule else []
    return {"date": dates, "source": "football-data-org", "live": True, "games": _games_payload(games)}


@router.get("/soccer/props")
def soccer_props(db: Session = Depends(get_db)):
    props = list_league_props(db, "Soccer")
    settings = get_settings()
    return {
        "ok": True,
        "league": "Soccer",
        "props": props,
        "count": len(props),
        "live": bool(props),
        "requiresApiKey": not bool(settings.football_data_api_key),
        "note": (
            "Schedule sync available with FOOTBALL_DATA_API_KEY. "
            "Player prop logs are not fabricated — awaiting events extension."
            if not props
            else None
        ),
    }


@router.post("/soccer/jobs/sync")
def soccer_sync(dates: str | None = Query(None), db: Session = Depends(get_db)):
    result = sync_soccer_warehouse(db, date=dates)
    if not result.get("ok") and result.get("requiresApiKey"):
        raise HTTPException(status_code=503, detail=result)
    return result


@router.get("/tennis/status")
def tennis_status(db: Session = Depends(get_db)):
    return sync_tennis_warehouse(db)


@router.post("/jobs/sync-all")
def sync_all(dates: str | None = Query(None), db: Session = Depends(get_db)):
    """Import every available legitimate source; never fabricates missing keys."""
    return sync_all_sports(db, date=dates)


@router.post("/leagues/{league}/board")
def rebuild_league_board(league: str, db: Session = Depends(get_db)):
    code = league.upper()
    if code not in {"MLB", "NHL", "Soccer", "ATP", "WTA"}:
        raise HTTPException(status_code=404, detail="Unsupported league for generic board")
    return ensure_league_board(db, league=code, force=True)
