from datetime import datetime, timezone

from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    settings = get_settings()
    return {
        "ok": True,
        "product": "seraphim-data-platform",
        "time": datetime.now(timezone.utc).isoformat(),
        "db": "sqlite" if settings.is_sqlite() else "postgres",
        "scheduler": settings.enable_scheduler,
        "disclaimer": settings.model_disclaimer,
    }
