"""NBA warehouse sync — ESPN provider → PostgreSQL/SQLite.

Orchestrates the full daily import:
  schedule → teams/players → historical gamelogs → injuries → projection props
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.config import get_settings
from app.ingestion.nba_board import import_nba_slate
from app.ingestion.nba_pipeline import import_nba_injuries_for_open_games, import_nba_schedule
from app.ingestion.warehouse import upsert_gamelog, upsert_game, upsert_player
from app.providers.base import run_provider_job
from app.providers.registry import get_nba_providers

log = logging.getLogger(__name__)


def sync_nba_warehouse(
    db: Session,
    *,
    date: Optional[str] = None,
    max_games: int | None = None,
    per_team: int | None = None,
    prefetch_gamelogs: bool = True,
) -> dict[str, Any]:
    """Full NBA day sync using the ESPN adapter.

    Steps
    -----
    1. Import today's (or ``date``) schedule into the warehouse.
    2. Pull injuries for open games.
    3. Prefetch roster athletes + historical gamelogs for the slate.
    4. Build Points/Rebounds/Assists props via the prediction engine.
    """
    settings = get_settings()
    max_games = max_games if max_games is not None else settings.nba_sync_max_games
    per_team = per_team if per_team is not None else settings.nba_sync_per_team
    providers = get_nba_providers()
    assert providers.schedule is not None

    stages: dict[str, Any] = {}

    with run_provider_job(db, provider="espn-nba", league="NBA", job="sync_schedule") as job:
        schedule = import_nba_schedule(db, date)
        job.rows_written = int(schedule.get("imported") or 0)
        job.message = f"date={date or 'today'}"
        stages["schedule"] = schedule

    with run_provider_job(db, provider="espn-nba", league="NBA", job="sync_injuries") as job:
        injuries = import_nba_injuries_for_open_games(db)
        job.rows_written = int(injuries.get("injuries") or injuries.get("imported") or 0)
        stages["injuries"] = injuries

    gamelog_rows = 0
    players_cached = 0
    if prefetch_gamelogs and providers.featured and providers.gamelog:
        with run_provider_job(db, provider="espn-nba", league="NBA", job="sync_gamelogs") as job:
            games = providers.schedule.fetch_schedule("NBA", date)
            seen_players: set[str] = set()
            for game in games[:max_games]:
                upsert_game(db, game)
                athletes = []
                if hasattr(providers.featured, "pick_slate_athletes"):
                    athletes = providers.featured.pick_slate_athletes(  # type: ignore[union-attr]
                        game.external_id, per_team=per_team
                    )
                for athlete in athletes:
                    if athlete.external_id in seen_players:
                        continue
                    seen_players.add(athlete.external_id)
                    player_row = upsert_player(db, athlete)
                    players_cached += 1
                    try:
                        logs = providers.gamelog.fetch_gamelog("NBA", athlete.external_id)
                        for g in logs[:40]:
                            upsert_gamelog(db, g, player_row.id)
                            gamelog_rows += 1
                    except Exception:
                        log.exception("gamelog prefetch failed for %s", athlete.external_id)
            db.flush()
            job.rows_written = gamelog_rows
            job.message = f"players={players_cached} gamelogs={gamelog_rows}"
            stages["gamelogs"] = {"players": players_cached, "rows": gamelog_rows}

    with run_provider_job(db, provider="espn-nba+model", league="NBA", job="sync_slate") as job:
        slate = import_nba_slate(
            db,
            date=date,
            max_games=max_games,
            per_team=per_team,
            markets=("Points", "Rebounds", "Assists"),
        )
        job.rows_written = int(slate.get("props") or 0)
        job.message = (
            f"games={slate.get('games')} players={slate.get('players')} "
            f"props={slate.get('props')} injuries={slate.get('injuries')}"
        )
        stages["slate"] = {k: v for k, v in slate.items() if k != "board"}

    return {
        "ok": True,
        "provider": "espn-nba",
        "league": "NBA",
        "database": "postgres" if not settings.is_sqlite() else "sqlite",
        "date": date,
        "maxGames": max_games,
        "perTeam": per_team,
        "stages": stages,
    }
