"""APScheduler jobs — keep the warehouse updated from live providers."""

from __future__ import annotations

import logging
import threading
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
from app.ingestion.multi_sport_sync import (
    sync_all_sports,
    sync_mlb_warehouse,
    sync_nhl_warehouse,
    sync_odds_all_leagues,
    sync_soccer_warehouse,
)
from app.ingestion.nba_sync import sync_nba_warehouse
from app.ingestion.nfl_pipeline import (
    build_and_store_featured_nfl_prop,
    import_nfl_injuries_for_open_games,
    import_nfl_schedule,
    recalculate_nfl_analytics,
)

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
    def _run(db):
        nba = import_nba_schedule(db)
        nfl = import_nfl_schedule(db)
        return {"nba": nba, "nfl": nfl}

    _safe("import_games", _run)


def job_refresh_odds() -> None:
    def _run(db):
        from app.ingestion.line_aggregation_sync import sync_aggregated_lines
        from app.ingestion.pickem_platform_sync import sync_pickem_platform_board
        from app.providers.propline import rate_limit as propline_rate_limit

        pickem: dict = {}
        # Never force-refresh pick'em on every tick — free PropLine tier is 1k/day.
        # Cache TTL inside sync_pickem_platform_board prevents hammering.
        if propline_rate_limit.is_blocked():
            pickem["skipped"] = {
                "reason": "propline_daily_limit",
                **propline_rate_limit.status(),
            }
        else:
            # PrizePicks first (primary app). Other platforms only if quota remains.
            for platform in ("prizepicks", "underdog", "sleeper"):
                if propline_rate_limit.is_blocked():
                    pickem["stopped"] = propline_rate_limit.status()
                    break
                for league in ("MLB", "WNBA", "NBA", "NHL", "Soccer", "ATP", "WTA"):
                    if propline_rate_limit.is_blocked():
                        break
                    key = f"{platform}:{league}"
                    try:
                        pickem[key] = sync_pickem_platform_board(
                            db, league=league, platform=platform, force=False
                        )
                    except Exception as exc:  # noqa: BLE001
                        pickem[key] = {"ok": False, "error": str(exc)}
                    # Tennis shares one PropLine sport key — one successful
                    # PrizePicks pull is enough for the day to avoid double spend.
                    if league == "ATP" and isinstance(pickem.get(key), dict):
                        if (pickem[key].get("count") or 0) > 0 and platform == "prizepicks":
                            # Still allow WTA to read cache / mirror below
                            pass

        return {
            "nba": build_and_store_featured_prop(db),
            "nfl": build_and_store_featured_nfl_prop(db),
            "line_aggregator": sync_aggregated_lines(db),
            "pickem_platforms": pickem,
        }

    _safe("refresh_odds", _run)


def job_multi_sport_sync() -> None:
    """MLB / NHL / Soccer / optional supplements → warehouse → projection boards."""

    def _run(db):
        return {
            "mlb": sync_mlb_warehouse(db),
            "nhl": sync_nhl_warehouse(db),
            "soccer": sync_soccer_warehouse(db),
        }

    _safe("multi_sport_sync", _run)


def job_update_injuries() -> None:
    def _run(db):
        return {
            "nba": import_nba_injuries_for_open_games(db),
            "nfl": import_nfl_injuries_for_open_games(db),
        }

    _safe("update_injuries", _run)


def job_import_stats() -> None:
    """Refresh NBA slate gamelogs + props (ESPN → warehouse)."""
    def _run(db):
        return sync_nba_warehouse(db)

    _safe("import_stats", _run)


def job_nba_full_sync() -> None:
    """Primary scheduled sync: today's games, players, logs, injuries, props."""
    def _run(db):
        return sync_nba_warehouse(db)

    _safe("nba_full_sync", _run)


def job_recalculate_analytics() -> None:
    def _run(db):
        return {
            "nba": recalculate_open_prop_analytics(db),
            "nfl": recalculate_nfl_analytics(db),
        }

    _safe("recalculate_analytics", _run)


def _bootstrap_nba_sync() -> None:
    settings = get_settings()
    if not settings.bootstrap_nba_sync:
        return
    log.info("Bootstrap NBA warehouse sync starting (espn-nba → %s)", "sqlite" if settings.is_sqlite() else "postgres")
    _safe("bootstrap_nba_sync", lambda db: sync_nba_warehouse(db))


def _bootstrap_multi_sport() -> None:
    settings = get_settings()
    if not settings.bootstrap_multi_sport:
        return
    log.info("Bootstrap multi-sport warehouse sync starting")
    _safe("bootstrap_multi_sport", lambda db: sync_all_sports(db))


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
    sched.add_job(
        job_nba_full_sync,
        "interval",
        minutes=settings.schedule_nba_sync_minutes,
        id="nba_full_sync",
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
    sched.add_job(
        job_multi_sport_sync,
        "interval",
        hours=max(1, settings.schedule_multi_sport_hours),
        id="multi_sport_sync",
        replace_existing=True,
    )
    sched.start()
    _scheduler = sched

    # Fire-and-forget bootstrap so the API is ready while ESPN sync runs.
    threading.Thread(target=_bootstrap_nba_sync, name="nba-bootstrap-sync", daemon=True).start()
    threading.Thread(target=_bootstrap_multi_sport, name="multi-sport-bootstrap", daemon=True).start()
    return sched


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
    _scheduler = None


def list_scheduled_jobs() -> list[dict]:
    if not _scheduler:
        return []
    out = []
    for job in _scheduler.get_jobs():
        out.append(
            {
                "id": job.id,
                "nextRunAt": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger),
            }
        )
    return out
