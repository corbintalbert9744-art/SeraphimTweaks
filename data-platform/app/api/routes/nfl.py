from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.ingestion.nfl_pipeline import (
    build_and_store_featured_nfl_prop,
    import_nfl_injuries_for_open_games,
    import_nfl_schedule,
    recalculate_nfl_analytics,
)
from app.ingestion.nfl_board import ensure_nfl_board, list_nfl_player_cards
from app.providers.registry import get_nfl_providers

router = APIRouter(prefix="/nfl", tags=["nfl"])


@router.get("/games")
def nfl_games(dates: Optional[str] = Query(None), db: Session = Depends(get_db)):
    providers = get_nfl_providers()
    games = providers.schedule.fetch_schedule("NFL", dates) if providers.schedule else []
    try:
        import_nfl_schedule(db, dates)
    except Exception:
        pass
    return {
        "date": dates,
        "source": "espn",
        "league": "NFL",
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
def nfl_props(
    refresh: bool = Query(False, description="Force re-ingest slate"),
    platform: Optional[str] = Query(
        None,
        description="Pick'em app id: prizepicks | underdog | sleeper | other",
    ),
    db: Session = Depends(get_db),
):
    """NFL board — with platform, live pick'em feed first (when PropLine has NFL props)."""
    from app.ingestion.pickem_platform_sync import ensure_pickem_platform_board
    from app.ingestion.platform_board import normalize_pickem_app

    if platform and normalize_pickem_app(platform):
        payload = ensure_pickem_platform_board(
            db, league="NFL", platform=platform, refresh=refresh
        )
        props = payload.get("props") or []
        if not props:
            research = ensure_nfl_board(db, force=refresh)
            props = research.get("props") or []
            players = research.get("players") or []
            teams = sorted({p["team"] for p in props if p.get("team") and p["team"] != "—"})
            markets = sorted({p["market"] for p in props if p.get("market")})
            label = payload.get("platformLabel") or platform
            return {
                **payload,
                "ok": bool(props),
                "props": props,
                "players": players,
                "count": len(props),
                "teams": ["All", *teams],
                "markets": ["All", *markets],
                "live": True,
                "fallback": True,
                "fallbackSource": "espn-nfl",
                "source": research.get("source") or "espn-nfl",
                "dataSource": "espn-nfl-research",
                "rateLimited": False,
                "requiresApiKey": False,
                "error": None,
                "note": (
                    f"Research slate active while live {label} lines refresh. "
                    "Seraphim projections vs research baselines — not scraped pick'em lines."
                ),
            }
        teams = sorted({p["team"] for p in props if p.get("team") and p["team"] != "—"})
        markets = sorted({p["market"] for p in props if p.get("market")})
        return {**payload, "teams": ["All", *teams], "markets": ["All", *markets], "live": True}

    payload = ensure_nfl_board(db, force=refresh)
    props = payload.get("props") or []
    players = payload.get("players") or []
    teams = sorted({p["team"] for p in props if p.get("team")})
    markets = sorted({p["market"] for p in props if p.get("market")})
    return {
        **payload,
        "props": props,
        "players": players,
        "count": len(props),
        "teams": ["All", *teams],
        "markets": ["All", *markets],
        "live": True,
        "disclaimer": "Select a pick'em app for live platform lines.",
    }


@router.get("/players")
def nfl_players(db: Session = Depends(get_db)):
    ensure_nfl_board(db, force=False)
    players = list_nfl_player_cards(db)
    return {"ok": True, "players": players, "count": len(players), "live": True}


@router.get("/featured-prop")
def featured_prop(gameId: Optional[str] = Query(None), db: Session = Depends(get_db)):
    return build_and_store_featured_nfl_prop(db, gameId)


@router.post("/jobs/import-schedule")
def job_import_schedule(dates: Optional[str] = None, db: Session = Depends(get_db)):
    return import_nfl_schedule(db, dates)


@router.post("/jobs/import-injuries")
def job_import_injuries(db: Session = Depends(get_db)):
    return import_nfl_injuries_for_open_games(db)


@router.post("/jobs/recalculate-analytics")
def job_recalc(db: Session = Depends(get_db)):
    return recalculate_nfl_analytics(db)
