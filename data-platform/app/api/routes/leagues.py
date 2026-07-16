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
from app.providers.espn.soccer import EspnSoccerProvider
from app.providers.espn.tennis import EspnTennisProvider
from app.providers.registry import get_mlb_providers, get_nhl_providers

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


@router.get("/mlb/props/{prop_id}")
def mlb_prop_detail(prop_id: str, db: Session = Depends(get_db)):
    props = list_league_props(db, "MLB")
    row = next((p for p in props if p["id"] == prop_id), None)
    if not row:
        raise HTTPException(status_code=404, detail="Prop not found")
    return {"ok": True, "prop": row, "live": True, "league": "MLB"}


@router.get("/nhl/props/{prop_id}")
def nhl_prop_detail(prop_id: str, db: Session = Depends(get_db)):
    props = list_league_props(db, "NHL")
    row = next((p for p in props if p["id"] == prop_id), None)
    if not row:
        raise HTTPException(status_code=404, detail="Prop not found")
    return {"ok": True, "prop": row, "live": True, "league": "NHL"}


@router.get("/soccer/games")
def soccer_games(dates: str | None = Query(None), db: Session = Depends(get_db)):
    espn = EspnSoccerProvider()
    games = espn.fetch_schedule("Soccer", dates)
    return {
        "date": dates,
        "source": "espn-soccer",
        "live": True,
        "games": _games_payload(games),
        "note": "ESPN public scoreboard (no key). Optional FOOTBALL_DATA_API_KEY enriches fixtures.",
    }


@router.get("/soccer/props")
def soccer_props(db: Session = Depends(get_db)):
    props = list_league_props(db, "Soccer")
    settings = get_settings()
    return {
        "ok": True,
        "league": "Soccer",
        "props": props,
        "count": len(props),
        "live": True,
        "source": "espn-soccer",
        "requiresApiKey": False,
        "footballDataConfigured": bool(settings.football_data_api_key),
        "note": (
            None
            if props
            else "ESPN schedules sync without a key. Player prop logs are not fabricated — awaiting an events provider. Optional FOOTBALL_DATA_API_KEY enriches fixtures."
        ),
    }


@router.post("/soccer/jobs/sync")
def soccer_sync(dates: str | None = Query(None), db: Session = Depends(get_db)):
    return sync_soccer_warehouse(db, date=dates)


@router.get("/tennis/games")
def tennis_games(
    tour: str = Query("ATP"),
    dates: str | None = Query(None),
    db: Session = Depends(get_db),
):
    code = "WTA" if tour.upper() == "WTA" else "ATP"
    espn = EspnTennisProvider()
    games = espn.fetch_schedule(code, dates)
    return {"date": dates, "tour": code, "source": "espn-tennis", "live": True, "games": _games_payload(games)}


@router.get("/tennis/props")
def tennis_props(tour: str = Query("ATP"), db: Session = Depends(get_db)):
    code = "WTA" if tour.upper() == "WTA" else "ATP"
    props = list_league_props(db, code)
    return {
        "ok": True,
        "league": code,
        "props": props,
        "count": len(props),
        "live": True,
        "source": "espn-tennis",
        "requiresConfiguration": False,
        "note": (
            None
            if props
            else (
                f"{code} schedule syncs from ESPN (no key). "
                "Match prop gamelogs are not fabricated. "
                "ODDS_API_KEY enables tournament odds when sport keys are verified; Tennis Abstract is not scraped."
            )
        ),
    }


@router.post("/tennis/jobs/sync")
def tennis_sync(tour: str = Query("ATP"), dates: str | None = Query(None), db: Session = Depends(get_db)):
    return sync_tennis_warehouse(db, tour=tour, date=dates)


@router.get("/tennis/status")
def tennis_status(tour: str = Query("ATP"), db: Session = Depends(get_db)):
    return sync_tennis_warehouse(db, tour=tour)


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
