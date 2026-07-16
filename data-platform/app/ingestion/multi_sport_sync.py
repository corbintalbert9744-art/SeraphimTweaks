"""Multi-sport warehouse sync — provider adapters → Postgres → analytics.

Orchestrates free/legitimate sources:
  - nba_api (optional) / ESPN for NBA & WNBA
  - nflverse (optional) / ESPN for NFL
  - MLB Stats API (no key)
  - NHL API (no key)
  - Football-Data.org (FOOTBALL_DATA_API_KEY)
  - Tennis Abstract (not live — requires provider selection)
  - The Odds API (ODDS_API_KEY) for sportsbook odds
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import Player
from app.ingestion.generic_board import ensure_league_board
from app.ingestion.nba_sync import sync_nba_warehouse
from app.ingestion.nfl_board import ensure_nfl_board
from app.ingestion.warehouse import upsert_game, upsert_gamelog, upsert_player, upsert_team
from app.ingestion.wnba_board import ensure_wnba_board
from app.providers.base import NormalizedTeam, run_provider_job
from app.providers.mlb.statsapi import MlbStatsApiProvider
from app.providers.nba_api.provider import NbaApiProvider, nba_api_installed
from app.providers.nflverse.provider import NflverseProvider, nflverse_installed
from app.providers.nhl.api import NhlApiProvider
from app.providers.registry import get_odds_provider
from app.providers.soccer.football_data import FootballDataOrgProvider

log = logging.getLogger(__name__)


def sync_mlb_warehouse(db: Session, *, date: Optional[str] = None, max_teams: int = 6) -> dict[str, Any]:
    provider = MlbStatsApiProvider()
    stages: dict[str, Any] = {"provider": provider.meta.name}

    with run_provider_job(db, provider="mlb-statsapi", league="MLB", job="sync_schedule") as job:
        games = provider.fetch_schedule("MLB", date)
        for g in games:
            upsert_game(db, g)
        job.rows_written = len(games)
        stages["schedule"] = {"imported": len(games)}

    players_n = 0
    logs_n = 0
    with run_provider_job(db, provider="mlb-statsapi", league="MLB", job="sync_rosters_logs") as job:
        teams = provider.fetch_teams("MLB")[:max_teams]
        for team in teams:
            upsert_team(db, team)
            roster = provider.fetch_team_roster(team.external_id)
            for athlete in roster[:8]:
                row = upsert_player(db, athlete)
                players_n += 1
                for gl in provider.fetch_gamelog("MLB", athlete.external_id)[:25]:
                    upsert_gamelog(db, gl, row.id)
                    logs_n += 1
        job.rows_written = players_n + logs_n
        stages["rosters"] = {"players": players_n, "logs": logs_n}

    board = ensure_league_board(
        db,
        league="MLB",
        markets=("Hits", "Home Runs", "RBIs", "Total Bases", "Strikeouts"),
        force=True,
        raw_stat_keys={
            "Hits": "hits",
            "Home Runs": "homeRuns",
            "RBIs": "rbi",
            "Total Bases": "totalBases",
            "Strikeouts": "strikeOuts",
        },
    )
    stages["board"] = {"props": board.get("count", 0)}
    stages["ok"] = True
    return stages


def sync_nhl_warehouse(db: Session, *, date: Optional[str] = None, max_teams: int = 6) -> dict[str, Any]:
    provider = NhlApiProvider()
    stages: dict[str, Any] = {"provider": provider.meta.name}

    with run_provider_job(db, provider="nhl-api", league="NHL", job="sync_schedule") as job:
        games = provider.fetch_schedule("NHL", date)
        for g in games:
            upsert_game(db, g)
        job.rows_written = len(games)
        stages["schedule"] = {"imported": len(games)}

    players_n = 0
    logs_n = 0
    with run_provider_job(db, provider="nhl-api", league="NHL", job="sync_rosters_logs") as job:
        team_ids: list[str] = []
        for g in games[:max_teams]:
            for tid in (g.home_abbr, g.away_abbr):
                if tid and tid not in team_ids:
                    team_ids.append(tid)
        if not team_ids:
            for t in provider.fetch_teams("NHL")[:max_teams]:
                upsert_team(db, t)
                team_ids.append(t.abbreviation)
            db.flush()
        for tid in team_ids[:max_teams]:
            roster = provider.fetch_team_roster(tid)
            for athlete in roster[:6]:
                row = upsert_player(db, athlete)
                players_n += 1
                for gl in provider.fetch_gamelog("NHL", athlete.external_id)[:20]:
                    upsert_gamelog(db, gl, row.id)
                    logs_n += 1
        job.rows_written = players_n + logs_n
        stages["rosters"] = {"players": players_n, "logs": logs_n}

    board = ensure_league_board(
        db,
        league="NHL",
        markets=("Points", "Goals", "Assists", "Shots"),
        force=True,
        raw_stat_keys={"Goals": "goals", "Assists": "assists", "Shots": "shots", "Points": None},
    )
    stages["board"] = {"props": board.get("count", 0)}
    stages["ok"] = True
    return stages


def sync_soccer_warehouse(db: Session, *, date: Optional[str] = None) -> dict[str, Any]:
    """ESPN soccer schedules (no key) + optional Football-Data.org when keyed."""
    from app.providers.espn.soccer import EspnSoccerProvider

    stages: dict[str, Any] = {}
    espn = EspnSoccerProvider()
    with run_provider_job(db, provider="espn-soccer", league="Soccer", job="sync_schedule") as job:
        games = espn.fetch_schedule("Soccer", date)
        for g in games:
            upsert_game(db, g)
        job.rows_written = len(games)
        stages["espn"] = {"imported": len(games)}

    settings = get_settings()
    key = settings.football_data_api_key
    if key:
        provider = FootballDataOrgProvider(key)
        with run_provider_job(db, provider="football-data-org", league="Soccer", job="sync_schedule") as job:
            fd_games = provider.fetch_schedule("Soccer", date)
            for g in fd_games:
                upsert_game(db, g)
            job.rows_written = len(fd_games)
            stages["footballData"] = {"imported": len(fd_games)}
    else:
        stages["footballData"] = {
            "requiresApiKey": True,
            "envVar": "FOOTBALL_DATA_API_KEY",
            "note": "Optional enrichment — ESPN schedule already imported without a key.",
        }

    stages["board"] = {
        "props": 0,
        "note": "Match schedules imported from ESPN. Player prop logs require an events provider — not fabricated.",
    }
    stages["ok"] = True
    stages["provider"] = "espn-soccer"
    return stages


def sync_tennis_warehouse(db: Session, *, tour: str = "ATP", date: Optional[str] = None) -> dict[str, Any]:
    """ESPN ATP/WTA schedules (no key). No fabricated match props."""
    from app.providers.espn.tennis import EspnTennisProvider

    code = "WTA" if tour.upper() == "WTA" else "ATP"
    provider = EspnTennisProvider()
    stages: dict[str, Any] = {"provider": provider.meta.name, "tour": code}

    with run_provider_job(db, provider="espn-tennis", league=code, job="sync_schedule") as job:
        games = provider.fetch_schedule(code, date)
        for g in games:
            upsert_game(db, g)
        job.rows_written = len(games)
        stages["schedule"] = {"imported": len(games)}

    players_n = 0
    with run_provider_job(db, provider="espn-tennis", league=code, job="sync_slate_players") as job:
        for p in provider.fetch_slate_players(code):
            upsert_player(db, p)
            players_n += 1
        job.rows_written = players_n
        stages["players"] = {"imported": players_n}

    # Explicit: no fabricated prop boards without match-stat logs
    stages["board"] = {
        "props": 0,
        "note": (
            "ESPN schedule + slate players imported. Match prop gamelogs are not fabricated. "
            "ODDS_API_KEY enables tournament odds when sport keys are verified; "
            "Tennis Abstract is not scraped."
        ),
    }
    stages["ok"] = True
    return stages


def sync_odds_all_leagues(db: Session) -> dict[str, Any]:
    _ = db
    settings = get_settings()
    if not settings.odds_api_key:
        return {
            "ok": False,
            "provider": "the-odds-api",
            "requiresApiKey": True,
            "error": "ODDS_API_KEY not configured — comparison lines stay as labeled placeholders.",
        }
    odds = get_odds_provider()
    out: dict[str, Any] = {"provider": "the-odds-api", "leagues": {}}
    for league in ("NBA", "NFL", "WNBA", "MLB", "NHL", "Soccer"):
        try:
            quotes = odds.fetch_player_prop_odds(league)  # type: ignore[union-attr]
            out["leagues"][league] = {"quotes": len(quotes or [])}
        except Exception as exc:  # noqa: BLE001
            out["leagues"][league] = {"error": str(exc)}
    out["ok"] = True
    return out


def sync_nba_api_supplement(db: Session) -> dict[str, Any]:
    """Optional nba_api enrichment when package is installed."""
    if not nba_api_installed():
        return {"ok": False, "provider": "nba-api", "installed": False, "note": "pip install nba_api"}
    provider = NbaApiProvider()
    with run_provider_job(db, provider="nba-api", league="NBA", job="supplement_schedule") as job:
        games = provider.fetch_schedule("NBA")
        for g in games[:15]:
            upsert_game(db, g)
        job.rows_written = min(15, len(games))
    return {"ok": True, "provider": "nba-api", "games": len(games)}


def sync_nflverse_supplement(db: Session) -> dict[str, Any]:
    if not nflverse_installed():
        return {"ok": False, "provider": "nflverse", "installed": False, "note": "pip install nfl_data_py"}
    provider = NflverseProvider()
    players_n = 0
    with run_provider_job(db, provider="nflverse", league="NFL", job="import_rosters") as job:
        for p in provider.fetch_rosters("NFL")[:400]:
            upsert_player(db, p)
            players_n += 1
        job.rows_written = players_n
    logs_n = 0
    with run_provider_job(db, provider="nflverse", league="NFL", job="import_weekly") as job:
        for gl in provider.fetch_weekly_stats("NFL")[:300]:
            pl = db.execute(
                select(Player).where(
                    Player.league == "NFL",
                    Player.external_id == gl.player_external_id,
                )
            ).scalar_one_or_none()
            if not pl:
                continue
            upsert_gamelog(db, gl, pl.id)
            logs_n += 1
        job.rows_written = logs_n
    return {"ok": True, "provider": "nflverse", "players": players_n, "logs": logs_n}


def sync_all_sports(db: Session, *, date: Optional[str] = None) -> dict[str, Any]:
    """Run every available legitimate importer. Never fabricates missing leagues."""
    settings = get_settings()
    results: dict[str, Any] = {
        "database": "postgres" if not settings.is_sqlite() else "sqlite",
        "sources": {},
    }

    try:
        results["sources"]["NBA"] = sync_nba_warehouse(db, date=date)
    except Exception as exc:  # noqa: BLE001
        results["sources"]["NBA"] = {"ok": False, "error": str(exc)}
    try:
        results["sources"]["WNBA"] = ensure_wnba_board(db, force=True)
    except Exception as exc:  # noqa: BLE001
        results["sources"]["WNBA"] = {"ok": False, "error": str(exc)}
    results["sources"]["nba_api"] = sync_nba_api_supplement(db)

    try:
        results["sources"]["NFL"] = ensure_nfl_board(db, force=True)
    except Exception as exc:  # noqa: BLE001
        results["sources"]["NFL"] = {"ok": False, "error": str(exc)}
    results["sources"]["nflverse"] = sync_nflverse_supplement(db)

    try:
        results["sources"]["MLB"] = sync_mlb_warehouse(db, date=date)
    except Exception as exc:  # noqa: BLE001
        log.exception("MLB sync failed")
        results["sources"]["MLB"] = {"ok": False, "error": str(exc)}
    try:
        results["sources"]["NHL"] = sync_nhl_warehouse(db, date=date)
    except Exception as exc:  # noqa: BLE001
        log.exception("NHL sync failed")
        results["sources"]["NHL"] = {"ok": False, "error": str(exc)}
    results["sources"]["Soccer"] = sync_soccer_warehouse(db, date=date)
    try:
        results["sources"]["ATP"] = sync_tennis_warehouse(db, tour="ATP", date=date)
    except Exception as exc:  # noqa: BLE001
        results["sources"]["ATP"] = {"ok": False, "error": str(exc)}
    try:
        results["sources"]["WTA"] = sync_tennis_warehouse(db, tour="WTA", date=date)
    except Exception as exc:  # noqa: BLE001
        results["sources"]["WTA"] = {"ok": False, "error": str(exc)}
    results["sources"]["odds"] = sync_odds_all_leagues(db)
    results["ok"] = True
    return results
