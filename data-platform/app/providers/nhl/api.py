"""NHL Web API adapter — free public HTTP API (no key).

Primary host: https://api-web.nhle.com/
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

NHL_WEB = "https://api-web.nhle.com/v1"
NHL_STATS = "https://api.nhle.com/stats/rest/en"


class NhlApiProvider:
    meta = ProviderMeta(
        name="nhl-api",
        leagues=["NHL"],
        capabilities=["schedule", "roster", "gamelog", "slate"],
        requires_api_key=False,
        is_mock=False,
        notes="Free NHL public web/stats APIs. No API key required.",
        homepage="https://www.nhl.com/",
    )

    def __init__(self, user_agent: str = "SeraphimAnalytics/1.0") -> None:
        self.http = ProviderHttpClient(user_agent=user_agent)

    def fetch_teams(self, league: str = "NHL") -> list[NormalizedTeam]:
        if league.upper() != "NHL":
            return []
        # Prefer current standings (active clubs only). Historical franchise list
        # from stats/rest includes Quebec Nordiques, etc. and breaks roster sync.
        try:
            data = self.http.get_json(f"{NHL_WEB}/standings/now")
            rows = data.get("standings") or []
            out: list[NormalizedTeam] = []
            seen: set[str] = set()
            for t in rows:
                abbr = t.get("teamAbbrev", {}).get("default") if isinstance(t.get("teamAbbrev"), dict) else t.get("teamAbbrev")
                abbr = abbr or t.get("teamCommonName", {}).get("default") if isinstance(t.get("teamCommonName"), dict) else abbr
                if not abbr or abbr in seen:
                    continue
                seen.add(abbr)
                name = (
                    (t.get("teamName") or {}).get("default")
                    if isinstance(t.get("teamName"), dict)
                    else (t.get("teamName") or abbr)
                )
                out.append(
                    NormalizedTeam(
                        external_id=str(t.get("teamId") or abbr),
                        league="NHL",
                        abbreviation=str(abbr),
                        name=str(name),
                    )
                )
            if out:
                return out
        except Exception as exc:  # noqa: BLE001
            log.warning("nhl standings teams: %s", exc)

        try:
            data = self.http.get_json(f"{NHL_STATS}/team")
        except Exception as exc:  # noqa: BLE001
            log.warning("nhl teams: %s", exc)
            return []
        out = []
        for t in data.get("data") or []:
            abbr = t.get("triCode") or t.get("rawTricode") or ""
            if not abbr:
                continue
            out.append(
                NormalizedTeam(
                    external_id=str(t.get("id") or abbr),
                    league="NHL",
                    abbreviation=abbr,
                    name=t.get("fullName") or t.get("name") or abbr,
                )
            )
        return out

    def fetch_schedule(self, league: str = "NHL", date: Optional[str] = None) -> list[NormalizedGame]:
        if league.upper() != "NHL":
            return []
        d = date
        if d and "-" not in d and len(d) == 8:
            d = f"{d[:4]}-{d[4:6]}-{d[6:8]}"
        if not d:
            d = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        try:
            data = self.http.get_json(f"{NHL_WEB}/schedule/{d}")
        except Exception as exc:  # noqa: BLE001
            log.warning("nhl schedule: %s", exc)
            return []
        games: list[NormalizedGame] = []
        for week in data.get("gameWeek") or [data]:
            for g in week.get("games") or data.get("games") or []:
                home = g.get("homeTeam") or {}
                away = g.get("awayTeam") or {}
                tip_raw = g.get("startTimeUTC") or g.get("gameDate")
                tip = (
                    datetime.fromisoformat(str(tip_raw).replace("Z", "+00:00"))
                    if tip_raw
                    else datetime.now(timezone.utc)
                )
                games.append(
                    NormalizedGame(
                        external_id=str(g.get("id") or g.get("gamePk") or ""),
                        league="NHL",
                        tipoff_at=tip,
                        status=str(g.get("gameState") or g.get("gameScheduleState") or "FUT"),
                        home_team_external_id=str(home.get("id") or home.get("abbrev") or ""),
                        away_team_external_id=str(away.get("id") or away.get("abbrev") or ""),
                        home_abbr=home.get("abbrev") or "HOME",
                        away_abbr=away.get("abbrev") or "AWAY",
                        home_name=home.get("placeName", {}).get("default")
                        if isinstance(home.get("placeName"), dict)
                        else (home.get("commonName") or home.get("abbrev") or "Home"),
                        away_name=away.get("placeName", {}).get("default")
                        if isinstance(away.get("placeName"), dict)
                        else (away.get("commonName") or away.get("abbrev") or "Away"),
                        home_score=home.get("score"),
                        away_score=away.get("score"),
                        venue=(g.get("venue") or {}).get("default")
                        if isinstance(g.get("venue"), dict)
                        else None,
                        raw={"source": "nhl-api"},
                    )
                )
        return [g for g in games if g.external_id]

    def fetch_team_roster(self, team_external_id: str) -> list[NormalizedPlayer]:
        # Prefer current season path — /current may 307-redirect depending on calendar.
        year = datetime.now(timezone.utc).year
        # NHL seasons span calendar years: e.g. 2025-26 → 20252026
        season = f"{year}{year + 1}" if datetime.now(timezone.utc).month >= 7 else f"{year - 1}{year}"
        paths = (
            f"{NHL_WEB}/roster/{team_external_id}/{season}",
            f"{NHL_WEB}/roster/{team_external_id}/current",
        )
        data = None
        for path in paths:
            try:
                data = self.http.get_json(path)
                break
            except Exception as exc:  # noqa: BLE001
                log.warning("nhl roster %s: %s", path, exc)
        if not data:
            return []
        out: list[NormalizedPlayer] = []
        for group in ("forwards", "defensemen", "goalies"):
            for p in data.get(group) or []:
                pid = str(p.get("id") or "")
                if not pid:
                    continue
                first = (p.get("firstName") or {}).get("default") if isinstance(p.get("firstName"), dict) else p.get("firstName")
                last = (p.get("lastName") or {}).get("default") if isinstance(p.get("lastName"), dict) else p.get("lastName")
                out.append(
                    NormalizedPlayer(
                        external_id=pid,
                        league="NHL",
                        full_name=f"{first or ''} {last or ''}".strip() or "Player",
                        team_external_id=str(team_external_id),
                        position=p.get("positionCode") or group[:1].upper(),
                        jersey=str(p.get("sweaterNumber") or "") or None,
                        headshot_url=p.get("headshot"),
                    )
                )
        return out

    def fetch_gamelog(self, league: str, player_external_id: str) -> list[NormalizedGamelog]:
        if league.upper() != "NHL":
            return []
        # Landing page game log
        try:
            data = self.http.get_json(f"{NHL_WEB}/player/{player_external_id}/landing")
        except Exception as exc:  # noqa: BLE001
            log.warning("nhl player %s: %s", player_external_id, exc)
            return []
        season_logs = (data.get("seasonTotals") or [])
        # Prefer last5 or gameLog if present
        games = data.get("last5Games") or data.get("gameLog") or []
        out: list[NormalizedGamelog] = []
        for g in games[:25]:
            tip_raw = str(g.get("gameDate") or "")[:10]
            try:
                played = datetime.strptime(tip_raw, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                played = datetime.now(timezone.utc)
            goals = _f(g.get("goals"))
            assists = _f(g.get("assists"))
            points = None
            if goals is not None or assists is not None:
                points = float(goals or 0) + float(assists or 0)
            out.append(
                NormalizedGamelog(
                    player_external_id=player_external_id,
                    league="NHL",
                    played_at=played,
                    opponent=str(g.get("opponentAbbrev") or "OPP"),
                    home=str(g.get("homeRoadFlag") or "").upper() == "H",
                    game_external_id=str(g.get("gameId") or "") or None,
                    points=points,
                    assists=assists,
                    raw={
                        "source": "nhl-api",
                        "goals": goals,
                        "assists": assists,
                        "shots": _f(g.get("shots")),
                        "toi": g.get("toi"),
                        "seasonTotalsHint": bool(season_logs),
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
