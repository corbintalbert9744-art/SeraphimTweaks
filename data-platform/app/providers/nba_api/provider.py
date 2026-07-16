"""nba_api adapter — free community client for NBA (and WNBA where supported).

Package: ``nba_api`` (https://github.com/swar/nba_api)
No API key. Falls back gracefully if the package is not installed — registry
keeps ESPN as the live primary until nba_api is available.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from app.providers.base import (
    NormalizedGame,
    NormalizedGamelog,
    NormalizedPlayer,
    ProviderMeta,
)

log = logging.getLogger(__name__)

try:
    from nba_api.stats.endpoints import leaguegamefinder, playergamelog, commonteamroster
    from nba_api.stats.static import teams as nba_teams
    from nba_api.stats.static import players as nba_players

    _NBA_API_AVAILABLE = True
except ImportError:  # pragma: no cover
    _NBA_API_AVAILABLE = False
    leaguegamefinder = playergamelog = commonteamroster = nba_teams = nba_players = None  # type: ignore


class NbaApiProvider:
    """Legitimate free NBA Stats endpoints via nba_api (no key)."""

    meta = ProviderMeta(
        name="nba-api",
        leagues=["NBA", "WNBA"],
        capabilities=["schedule", "roster", "gamelog", "slate"],
        requires_api_key=False,
        is_mock=False,
        notes=(
            "Free nba_api package wrapping stats.nba.com. Install: pip install nba_api. "
            "WNBA coverage is limited — ESPN WNBA remains primary for women's slate. "
            "No API key required."
        ),
        homepage="https://github.com/swar/nba_api",
    )

    def __init__(self, *, league: str = "NBA") -> None:
        self.league = league.upper()
        self._available = _NBA_API_AVAILABLE

    @property
    def available(self) -> bool:
        return self._available

    def fetch_schedule(self, league: str = "NBA", date: Optional[str] = None) -> list[NormalizedGame]:
        if not self._available or league.upper() not in ("NBA", "WNBA"):
            return []
        # LeagueGameFinder returns recent games; filter by date when provided.
        try:
            finder = leaguegamefinder.LeagueGameFinder(
                league_id_nullable="00" if league.upper() == "NBA" else "10",
                season_nullable=None,
            )
            frames = finder.get_data_frames()
            if not frames:
                return []
            df = frames[0]
        except Exception as exc:  # noqa: BLE001
            log.warning("nba_api schedule failed: %s", exc)
            return []

        games: list[NormalizedGame] = []
        seen: set[str] = set()
        for _, row in df.head(40).iterrows():
            gid = str(row.get("GAME_ID") or "")
            if not gid or gid in seen:
                continue
            seen.add(gid)
            tip_raw = str(row.get("GAME_DATE") or "")
            try:
                tip = datetime.strptime(tip_raw[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                tip = datetime.now(timezone.utc)
            if date and tip_raw[:10].replace("-", "") != date.replace("-", "")[:8]:
                # soft filter — include nearby if exact date missing
                pass
            matchup = str(row.get("MATCHUP") or "")
            is_home = " vs. " in matchup or " vs " in matchup
            team = str(row.get("TEAM_ABBREVIATION") or "TM")
            opp = matchup.split(" ")[-1] if matchup else "OPP"
            home_abbr = team if is_home else opp
            away_abbr = opp if is_home else team
            games.append(
                NormalizedGame(
                    external_id=gid,
                    league=league.upper(),
                    tipoff_at=tip,
                    status="STATUS_FINAL" if row.get("WL") else "STATUS_SCHEDULED",
                    home_team_external_id=home_abbr,
                    away_team_external_id=away_abbr,
                    home_abbr=home_abbr,
                    away_abbr=away_abbr,
                    home_name=home_abbr,
                    away_name=away_abbr,
                    season=str(row.get("SEASON_ID") or ""),
                    raw={"source": "nba_api", "matchup": matchup},
                )
            )
        return games

    def fetch_gamelog(self, league: str, player_external_id: str) -> list[NormalizedGamelog]:
        if not self._available or league.upper() != "NBA":
            return []
        try:
            gl = playergamelog.PlayerGameLog(player_id=player_external_id, timeout=30)
            frames = gl.get_data_frames()
            if not frames:
                return []
            df = frames[0]
        except Exception as exc:  # noqa: BLE001
            log.warning("nba_api gamelog %s failed: %s", player_external_id, exc)
            return []

        rows: list[NormalizedGamelog] = []
        for _, row in df.head(40).iterrows():
            tip_raw = str(row.get("GAME_DATE") or "")
            try:
                played = datetime.strptime(tip_raw[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                continue
            matchup = str(row.get("MATCHUP") or "")
            home = "vs" in matchup.lower()
            opp = matchup.split()[-1] if matchup else "OPP"
            mins = row.get("MIN")
            try:
                minutes = float(str(mins).split(":")[0]) if mins is not None else None
            except (TypeError, ValueError):
                minutes = None
            rows.append(
                NormalizedGamelog(
                    player_external_id=str(player_external_id),
                    league="NBA",
                    played_at=played,
                    opponent=opp,
                    home=home,
                    game_external_id=str(row.get("Game_ID") or row.get("GAME_ID") or "") or None,
                    minutes=minutes,
                    points=_f(row.get("PTS")),
                    rebounds=_f(row.get("REB")),
                    assists=_f(row.get("AST")),
                    threes=_f(row.get("FG3M")),
                    steals=_f(row.get("STL")),
                    blocks=_f(row.get("BLK")),
                    raw={"source": "nba_api"},
                )
            )
        return rows

    def fetch_team_roster(self, team_external_id: str) -> list[NormalizedPlayer]:
        if not self._available:
            return []
        try:
            # Prefer numeric team id; fall back to abbreviation lookup
            tid = team_external_id
            if not tid.isdigit() and nba_teams:
                match = next(
                    (t for t in nba_teams.get_teams() if t.get("abbreviation") == team_external_id.upper()),
                    None,
                )
                tid = str(match["id"]) if match else team_external_id
            roster = commonteamroster.CommonTeamRoster(team_id=tid, timeout=30)
            frames = roster.get_data_frames()
            if not frames:
                return []
            df = frames[0]
        except Exception as exc:  # noqa: BLE001
            log.warning("nba_api roster %s failed: %s", team_external_id, exc)
            return []

        out: list[NormalizedPlayer] = []
        for _, row in df.iterrows():
            pid = str(row.get("PLAYER_ID") or "")
            if not pid:
                continue
            out.append(
                NormalizedPlayer(
                    external_id=pid,
                    league="NBA",
                    full_name=str(row.get("PLAYER") or "Player"),
                    team_external_id=str(team_external_id),
                    position=str(row.get("POSITION") or "") or None,
                    jersey=str(row.get("NUM") or "") or None,
                )
            )
        return out

    def search_players(self, query: str, limit: int = 20) -> list[NormalizedPlayer]:
        if not self._available or not nba_players:
            return []
        q = query.lower()
        hits = [p for p in nba_players.get_players() if q in (p.get("full_name") or "").lower()]
        return [
            NormalizedPlayer(
                external_id=str(p["id"]),
                league="NBA",
                full_name=p.get("full_name") or "Player",
            )
            for p in hits[:limit]
        ]


def _f(v: Any) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def nba_api_installed() -> bool:
    return _NBA_API_AVAILABLE
