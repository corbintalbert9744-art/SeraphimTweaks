"""APScheduler jobs for automatic warehouse updates."""

from __future__ import annotations

import logging
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler

from app.config import get_settings
from app.db.session import session_scope
from app.ingestion.nba_pipeline import (
    build_and_store_featured_prop,
    import_nba_injuries_for_open_games,
    import_nba_schedule,
    recalculate_open_prop_analytics,
)
from app.providers.registry import get_nba_providers

log = logging.getLogger(__name__)
_scheduler: Optional[BackgroundScheduler] = None


def _safe(job_name: str, fn) -> None:
    try:
        with session_scope() as db:
            result = fn(db)
            log.info("job %s ok: %s", job_name, result)
    except Exception:
        log.exception("job %s failed", job_name)


def job_import_games() -> None:
    _safe("import_games", lambda db: import_nba_schedule(db))


def job_refresh_odds() -> None:
    """Refresh odds for open props.

    Live path requires ODDS_API_KEY. Without it, featured rebuild still uses MockOddsProvider
    and marks oddsAreMock=true.
    """

    def _run(db):
        providers = get_nba_providers()
        odds = providers.odds
        if odds is None:
            return {"skipped": True, "reason": "no odds provider"}
        # Rebuild featured prop which re-quotes odds (live or mock)
        return build_and_store_featured_prop(db)

    _safe("refresh_odds", _run)


def job_update_injuries() -> None:
    _safe("update_injuries", lambda db: import_nba_injuries_for_open_games(db))


def job_import_stats() -> None:
    """Import completed game stats via featured athlete gamelog refresh (NBA v1)."""
    _safe("import_stats", lambda db: build_and_store_featured_prop(db))


def job_recalculate_analytics() -> None:
    _safe("recalculate_analytics", lambda db: recalculate_open_prop_analytics(db))


def start_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler and _scheduler.running:
        return _scheduler
    settings = get_settings()
    sched = BackgroundScheduler(timezone="UTC")
    sched.add_job(job_import_games, "cron", hour=5, minute=10, id="import_games", replace_existing=True)
    sched.add_job(
        job_refresh_odds,
        "interval",
        minutes=settings.schedule_odds_minutes,
        id="refresh_odds",
        replace_existing=True,
    )
    sched.add_job(
        job_update_injuries,
        "interval",
        minutes=settings.schedule_injuries_minutes,
        id="update_injuries",
        replace_existing=True,
    )
    sched.add_job(job_import_stats, "cron", hour="*/2", minute=20, id="import_stats", replace_existing=True)
    sched.add_job(
        job_recalculate_analytics,
        "interval",
        minutes=settings.schedule_analytics_minutes,
        id="recalculate_analytics",
        replace_existing=True,
    )
    sched.start()
    _scheduler = sched
    return sched


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
    _scheduler = None
