"""MLB Stats API adapter — free public HTTP API (no key).

Base: https://statsapi.mlb.com/api/
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from app.providers.base import (
    NormalizedGame,
    NormalizedGamelog,
    NormalizedPlayer,
    NormalizedTeam,
    ProviderHttpClient,
    ProviderMeta,
)

log = logging.getLogger(__name__)

MLB_API = "https://statsapi.mlb.com/api/v1"


class MlbStatsApiProvider:
    meta = ProviderMeta(
        name="mlb-statsapi",
        leagues=["MLB"],
        capabilities=["schedule", "roster", "gamelog", "slate"],
        requires_api_key=False,
        is_mock=False,
        notes="Free MLB Stats API (statsapi.mlb.com). No API key required.",
        homepage="https://statsapi.mlb.com/",
    )

    def __init__(self, user_agent: str = "SeraphimAnalytics/1.0") -> None:
        self.http = ProviderHttpClient(user_agent=user_agent)

    def fetch_teams(self, league: str = "MLB") -> list[NormalizedTeam]:
        if league.upper() != "MLB":
            return []
        data = self.http.get_json(f"{MLB_API}/teams?sportId=1")
        out: list[NormalizedTeam] = []
        for t in data.get("teams") or []:
            out.append(
                NormalizedTeam(
                    external_id=str(t.get("id")),
                    league="MLB",
                    abbreviation=t.get("abbreviation") or t.get("teamCode") or "TM",
                    name=t.get("name") or t.get("teamName") or "Team",
                    city=(t.get("franchiseName") or None),
                )
            )
        return out

    def fetch_schedule(self, league: str = "MLB", date: Optional[str] = None) -> list[NormalizedGame]:
        if league.upper() != "MLB":
            return []
        # date YYYYMMDD or YYYY-MM-DD
        if date:
            d = date if "-" in date else f"{date[:4]}-{date[4:6]}-{date[6:8]}"
        else:
            d = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        data = self.http.get_json(f"{MLB_API}/schedule?sportId=1&date={d}")
        games: list[NormalizedGame] = []
        for day in data.get("dates") or []:
            for g in day.get("games") or []:
                teams = {c.get("homeAway"): c for c in (g.get("teams") or {}).values()} if False else {}
                # MLB shape: teams.home / teams.away
                home = (g.get("teams") or {}).get("home") or {}
                away = (g.get("teams") or {}).get("away") or {}
                home_t = home.get("team") or {}
                away_t = away.get("team") or {}
                tip_raw = g.get("gameDate")
                tip = (
                    datetime.fromisoformat(tip_raw.replace("Z", "+00:00"))
                    if tip_raw
                    else datetime.now(timezone.utc)
                )
                games.append(
                    NormalizedGame(
                        external_id=str(g.get("gamePk")),
                        league="MLB",
                        tipoff_at=tip,
                        status=(g.get("status") or {}).get("detailedState") or "Scheduled",
                        home_team_external_id=str(home_t.get("id") or ""),
                        away_team_external_id=str(away_t.get("id") or ""),
                        home_abbr=home_t.get("abbreviation") or home_t.get("teamName") or "HOME",
                        away_abbr=away_t.get("abbreviation") or away_t.get("teamName") or "AWAY",
                        home_name=home_t.get("name") or "Home",
                        away_name=away_t.get("name") or "Away",
                        venue=((g.get("venue") or {}).get("name")),
                        home_score=home.get("score"),
                        away_score=away.get("score"),
                        season=str(g.get("season") or ""),
                        raw={"source": "mlb-statsapi"},
                    )
                )
        return games

    def fetch_team_roster(self, team_external_id: str) -> list[NormalizedPlayer]:
        data = self.http.get_json(f"{MLB_API}/teams/{team_external_id}/roster")
        out: list[NormalizedPlayer] = []
        for entry in data.get("roster") or []:
            person = entry.get("person") or {}
            pid = str(person.get("id") or "")
            if not pid:
                continue
            pos = entry.get("position") or {}
            out.append(
                NormalizedPlayer(
                    external_id=pid,
                    league="MLB",
                    full_name=person.get("fullName") or "Player",
                    team_external_id=str(team_external_id),
                    position=pos.get("abbreviation") if isinstance(pos, dict) else None,
                    jersey=str(entry.get("jerseyNumber") or "") or None,
                )
            )
        return out

    def fetch_gamelog(self, league: str, player_external_id: str) -> list[NormalizedGamelog]:
        if league.upper() != "MLB":
            return []
        season = datetime.now(timezone.utc).year
        # Hitting game log
        url = (
            f"{MLB_API}/people/{player_external_id}/stats"
            f"?stats=gameLog&group=hitting&season={season}"
        )
        try:
            data = self.http.get_json(url)
        except Exception as exc:  # noqa: BLE001
            log.warning("mlb gamelog %s: %s", player_external_id, exc)
            return []
        splits = []
        for block in data.get("stats") or []:
            splits.extend(block.get("splits") or [])
        out: list[NormalizedGamelog] = []
        for s in splits[:40]:
            game = s.get("game") or {}
            tip_raw = (s.get("date") or "")[:10]
            try:
                played = datetime.strptime(tip_raw, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                continue
            opp = (s.get("opponent") or {}).get("abbreviation") or "OPP"
            is_home = (s.get("isHome") is True) or (s.get("homeAway") == "home")
            st = s.get("stat") or {}
            hits = _f(st.get("hits"))
            out.append(
                NormalizedGamelog(
                    player_external_id=player_external_id,
                    league="MLB",
                    played_at=played,
                    opponent=opp,
                    home=bool(is_home),
                    game_external_id=str(game.get("gamePk") or "") or None,
                    points=hits,  # primary counting stat slot for Hits market
                    raw={
                        "source": "mlb-statsapi",
                        "hits": hits,
                        "rbi": _f(st.get("rbi")),
                        "homeRuns": _f(st.get("homeRuns")),
                        "stolenBases": _f(st.get("stolenBases")),
                        "atBats": _f(st.get("atBats")),
                        "totalBases": _f(st.get("totalBases")),
                        "strikeOuts": _f(st.get("strikeOuts")),
                    },
                )
            )
        return out


def _f(v: Any) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None
