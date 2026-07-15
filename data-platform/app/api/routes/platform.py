from fastapi import APIRouter

from app.providers.registry import provider_status

router = APIRouter(tags=["platform"])


@router.get("/providers")
def providers():
    """Which data providers are live, mock, or require configuration."""
    return {"providers": provider_status()}


@router.get("/leagues")
def leagues():
    return {
        "leagues": [
            {"code": "NBA", "status": "live", "notes": "ESPN schedule/gamelog/injuries; odds via Odds API or mock"},
            {"code": "NFL", "status": "planned", "notes": "Adapter stub — expand after NBA warehouse is stable"},
            {"code": "WNBA", "status": "planned", "notes": "Reuse ESPN basketball patterns"},
            {"code": "ATP", "status": "needs_provider", "notes": "REQUIRES PROVIDER SELECTION for schedule + odds"},
            {"code": "WTA", "status": "needs_provider", "notes": "REQUIRES PROVIDER SELECTION for schedule + odds"},
        ]
    }
