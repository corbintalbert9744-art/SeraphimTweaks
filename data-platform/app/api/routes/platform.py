from fastapi import APIRouter, Query
from sqlalchemy.orm import Session
from fastapi import Depends

from app.config import get_settings
from app.db.session import get_db
from app.jobs.scheduler import list_scheduled_jobs
from app.providers.base import list_recent_provider_runs
from app.providers.comparison_lines import canonical_provider_catalog
from app.providers.nba_api.provider import nba_api_installed
from app.providers.nflverse.provider import nflverse_installed
from app.providers.registry import provider_capability_matrix, provider_status

router = APIRouter(tags=["platform"])


@router.get("/providers")
def providers():
    """Which data providers are live, mock, or require configuration."""
    settings = get_settings()
    return {
        "providers": provider_status(),
        "capabilityMatrix": provider_capability_matrix(),
        "database": "postgres" if not settings.is_sqlite() else "sqlite",
        "primaryNbaProvider": "espn-nba",
        "jobs": list_scheduled_jobs(),
    }


@router.get("/providers/runs")
def provider_runs(limit: int = Query(25, ge=1, le=100), db: Session = Depends(get_db)):
    """Recent provider_runs audit rows (schedule / gamelog / injury / slate sync)."""
    return {"runs": list_recent_provider_runs(db, limit=limit)}


@router.get("/leagues")
def leagues():
    settings = get_settings()
    soccer_key = bool(settings.football_data_api_key)
    odds_key = bool(settings.odds_api_key)
    return {
        "leagues": [
            {
                "code": "NBA",
                "status": "live",
                "provider": "espn-nba",
                "notes": "ESPN schedule/roster/gamelog/injuries auto-synced to Postgres; optional nba_api supplement; odds via Odds API or placeholder comparison lines",
            },
            {
                "code": "NFL",
                "status": "live",
                "provider": "espn-nfl",
                "notes": "ESPN schedule/gamelog/injuries; optional nflverse (nfl_data_py) supplement; odds via Odds API or placeholder comparison lines",
            },
            {
                "code": "WNBA",
                "status": "live",
                "provider": "espn-wnba",
                "notes": "ESPN schedule/roster/gamelog/injuries; Line Comparison includes PrizePicks placeholders until pick'em adapter is connected",
            },
            {
                "code": "MLB",
                "status": "live",
                "provider": "mlb-statsapi",
                "notes": "MLB Stats API (no key) → warehouse gamelogs → Projection Engine V1. Odds via ODDS_API_KEY or comparison placeholders.",
            },
            {
                "code": "NHL",
                "status": "live",
                "provider": "nhl-api",
                "notes": "NHL public API (no key) → warehouse gamelogs → Projection Engine V1. Odds via ODDS_API_KEY or comparison placeholders.",
            },
            {
                "code": "Soccer",
                "status": "live",
                "provider": "espn-soccer",
                "notes": "ESPN soccer slate → PrizePicks-style pick'em (Goals, Shots, SOT, …). Optional FOOTBALL_DATA_API_KEY.",
            },
            {
                "code": "ATP",
                "status": "live",
                "provider": "espn-tennis",
                "notes": "ESPN ATP singles → PrizePicks-style pick'em slate (Fantasy Score, Total Games, Total Sets).",
            },
            {
                "code": "WTA",
                "status": "live",
                "provider": "espn-tennis",
                "notes": "ESPN WTA singles → PrizePicks-style pick'em slate (Fantasy Score, Total Games, Total Sets).",
            },
        ],
        "lineProviders": canonical_provider_catalog(),
        "apiKeys": {
            "ODDS_API_KEY": {
                "required": False,
                "configured": odds_key,
                "purpose": "The Odds API free tier — live sportsbook player-prop odds",
            },
            "FOOTBALL_DATA_API_KEY": {
                "required": True,
                "configured": soccer_key,
                "purpose": "Football-Data.org free tier — soccer schedules (no fabricated data without key)",
            },
            "nba_api": {
                "required": False,
                "configured": nba_api_installed(),
                "purpose": "Optional pip package nba_api — NBA Stats supplement (no key)",
            },
            "nfl_data_py": {
                "required": False,
                "configured": nflverse_installed(),
                "purpose": "Optional pip package nfl_data_py — NFLVerse rosters/weekly stats (no key)",
            },
        },
    }
