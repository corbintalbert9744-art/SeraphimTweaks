from fastapi import APIRouter, Query
from sqlalchemy.orm import Session
from fastapi import Depends

from app.config import get_settings
from app.db.session import get_db
from app.jobs.scheduler import list_scheduled_jobs
from app.providers.base import list_recent_provider_runs
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
    from app.providers.comparison_lines import canonical_provider_catalog

    return {
        "leagues": [
            {
                "code": "NBA",
                "status": "live",
                "provider": "espn-nba",
                "notes": "ESPN schedule/roster/gamelog/injuries auto-synced to Postgres; odds via Odds API or placeholder comparison lines",
            },
            {
                "code": "NFL",
                "status": "live",
                "provider": "espn-nfl",
                "notes": "ESPN schedule/gamelog/injuries/roster fallback; odds via Odds API or placeholder comparison lines",
            },
            {
                "code": "WNBA",
                "status": "planned",
                "notes": "Reuse ESPN basketball patterns — next after NBA sync hardened",
            },
            {
                "code": "MLB",
                "status": "needs_provider",
                "notes": "REQUIRES PROVIDER — MLB stats + odds adapter not connected",
            },
            {
                "code": "NHL",
                "status": "needs_provider",
                "notes": "REQUIRES PROVIDER — NHL stats + odds adapter not connected",
            },
            {
                "code": "Soccer",
                "status": "needs_provider",
                "notes": "REQUIRES PROVIDER — Soccer leagues adapter not connected",
            },
            {
                "code": "ATP",
                "status": "needs_provider",
                "notes": "REQUIRES PROVIDER SELECTION for schedule + odds",
            },
            {
                "code": "WTA",
                "status": "needs_provider",
                "notes": "REQUIRES PROVIDER SELECTION for schedule + odds",
            },
        ],
        "lineProviders": canonical_provider_catalog(),
    }
