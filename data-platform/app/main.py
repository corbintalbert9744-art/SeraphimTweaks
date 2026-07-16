"""FastAPI application — sports data & analytics API."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import arbitrage, health, leagues, nba, nfl, odds_comparison, platform, plus_ev, predict, wnba
from app.config import get_settings
from app.db.session import init_db
from app.jobs.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("seraphim.data-platform")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    init_db()
    log.info("DB ready (%s)", "sqlite" if settings.is_sqlite() else "postgres")
    if settings.enable_scheduler:
        start_scheduler()
        log.info("Scheduler started")
    yield
    stop_scheduler()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Seraphim IQ Data Platform",
        version="0.1.0",
        description=(
            "Sports warehouse + analytics API. Scores are model estimates from evidence "
            "(hit rates, no-vig, matchup, injuries) — not guaranteed win probabilities."
        ),
        lifespan=lifespan,
    )
    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router, prefix="/api/v1")
    app.include_router(platform.router, prefix="/api/v1")
    app.include_router(predict.router, prefix="/api/v1")
    app.include_router(nba.router, prefix="/api/v1")
    app.include_router(nfl.router, prefix="/api/v1")
    app.include_router(wnba.router, prefix="/api/v1")
    app.include_router(leagues.router, prefix="/api/v1")
    app.include_router(odds_comparison.router, prefix="/api/v1")
    app.include_router(plus_ev.router, prefix="/api/v1")
    app.include_router(arbitrage.router, prefix="/api/v1")
    return app


app = create_app()
