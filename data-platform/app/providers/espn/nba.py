"""ESPN NBA adapter — public APIs, no key required.

Capabilities: schedule, gamelog, injuries, featured athlete.
Odds / props: not provided by ESPN — use OddsProvider separately.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from app.providers.base import (
    NormalizedGame,
    NormalizedGamelog,
    NormalizedInjury,
    NormalizedPlayer,
    ProviderMeta,
)

ESPN_SITE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"
ESPN_WEB = "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba"


class EspnNbaProvider:
    meta = ProviderMeta(
        name="espn-nba",
        leagues=["NBA"],
        capabilities=["schedule", "gamelog", "injuries", "featured"],
        requires_api_key=False,
        is_mock=False,
        notes="Live ESPN public endpoints for NBA scoreboard, gamelogs, and injury snippets.",
    )

    def __init__(self, user_agent: str = "SeraphimAnalytics/1.0") -> None:
        self.user_agent = user_agent

    def _get(self, url: str) -> Any:
        with httpx.Client(timeout=30.0, headers={"User-Agent": self.user_agent, "Accept": "application/json"}) as client:
            res = client.get(url)
            res.raise_for_status()
            return res.json()

    def fetch_schedule(self, league: str = "NBA", date: Optional[str] = None) -> list[NormalizedGame]:
        if league.upper() != "NBA":
            return []
        qs = f"?dates={date}" if date else ""
        data = self._get(f"{ESPN_SITE}/scoreboard{qs}")
        games: list[NormalizedGame] = []
        for e in data.get("events") or []:
            comp = (e.get("competitions") or [{}])[0]
            competitors = comp.get("competitors") or []
            home = next((c for c in competitors if c.get("homeAway") == "home"), {})
            away = next((c for c in competitors if c.get("homeAway") == "away"), {})
            tip = e.get("date")
            tipoff = datetime.fromisoformat(tip.replace("Z", "+00:00")) if tip else datetime.now(timezone.utc)
            home_team = home.get("team") or {}
            away_team = away.get("team") or {}
            games.append(
                NormalizedGame(
                    external_id=str(e.get("id")),
                    league="NBA",
                    tipoff_at=tipoff,
                    status=(e.get("status") or {}).get("type", {}).get("name") or "STATUS_UNKNOWN",
                    home_team_external_id=str(home_team.get("id") or ""),
                    away_team_external_id=str(away_team.get("id") or ""),
                    home_abbr=home_team.get("abbreviation") or "HOME",
                    away_abbr=away_team.get("abbreviation") or "AWAY",
                    home_name=home_team.get("displayName") or "Home",
                    away_name=away_team.get("displayName") or "Away",
                    venue=(comp.get("venue") or {}).get("fullName"),
                    home_score=int(home["score"]) if home.get("score") not in (None, "") else None,
                    away_score=int(away["score"]) if away.get("score") not in (None, "") else None,
                    home_logo=home_team.get("logo"),
                    away_logo=away_team.get("logo"),
                    raw={"event": e.get("id"), "shortName": e.get("shortName")},
                )
            )
        return games

    def fetch_gamelog(self, league: str, player_external_id: str) -> list[NormalizedGamelog]:
        if league.upper() != "NBA":
            return []
        data = self._get(f"{ESPN_WEB}/athletes/{player_external_id}/gamelog")
        labels: list[str] = data.get("labels") or []
        names: list[str] = data.get("names") or []

        def idx(key: str) -> int:
            for i, n in enumerate(names):
                if n.lower() == key.lower():
                    return i
            return -1

        def idx_label(label: str) -> int:
            for i, l in enumerate(labels):
                if l == label:
                    return i
            return -1

        i_pts = idx("points") if idx("points") >= 0 else idx_label("PTS")
        i_reb = idx("totalRebounds") if idx("totalRebounds") >= 0 else idx_label("REB")
        i_ast = idx("assists") if idx("assists") >= 0 else idx_label("AST")
        i_3 = idx("threePointFieldGoalsMade") if idx("threePointFieldGoalsMade") >= 0 else idx_label("3PT")
        i_min = idx("minutes") if idx("minutes") >= 0 else idx_label("MIN")

        events_map: dict = data.get("events") or {}
        rows: list[NormalizedGamelog] = []

        def num(stats: list, i: int) -> Optional[float]:
            if i < 0 or i >= len(stats):
                return None
            try:
                cleaned = "".join(ch for ch in str(stats[i]) if ch.isdigit() or ch == ".")
                return float(cleaned) if cleaned else None
            except (TypeError, ValueError):
                return None

        for season in data.get("seasonTypes") or []:
            for cat in season.get("categories") or []:
                for ev in cat.get("events") or []:
                    event_id = str(ev.get("eventId") or "")
                    meta = events_map.get(event_id) or {}
                    stats = ev.get("stats") or []
                    date_str = meta.get("gameDate") or meta.get("date") or ""
                    try:
                        played = datetime.fromisoformat(str(date_str).replace("Z", "+00:00"))
                    except ValueError:
                        try:
                            played = datetime.strptime(str(date_str)[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                        except ValueError:
                            continue
                    opp = meta.get("opponent") or {}
                    opp_abbr = opp.get("abbreviation") if isinstance(opp, dict) else meta.get("opponentAbbreviation") or "OPP"
                    home = bool(meta.get("atVs") == "vs" or meta.get("homeAway") == "home")
                    rows.append(
                        NormalizedGamelog(
                            player_external_id=player_external_id,
                            league="NBA",
                            played_at=played,
                            opponent=opp_abbr or "OPP",
                            home=home,
                            game_external_id=event_id or None,
                            minutes=num(stats, i_min),
                            points=num(stats, i_pts),
                            rebounds=num(stats, i_reb),
                            assists=num(stats, i_ast),
                            threes=num(stats, i_3),
                            raw={"eventId": event_id},
                        )
                    )

        rows.sort(key=lambda r: r.played_at, reverse=True)
        return rows

    def fetch_injuries(self, league: str, game_external_id: Optional[str] = None) -> list[NormalizedInjury]:
        if league.upper() != "NBA" or not game_external_id:
            return []
        data = self._get(f"{ESPN_SITE}/summary?event={game_external_id}")
        out: list[NormalizedInjury] = []
        for block in data.get("injuries") or []:
            team = block.get("team") or {}
            for item in block.get("injuries") or []:
                ath = item.get("athlete") or {}
                details = item.get("details") or {}
                out.append(
                    NormalizedInjury(
                        league="NBA",
                        status=item.get("status") or (item.get("type") or {}).get("description") or "Unknown",
                        player_external_id=str(ath.get("id") or "") or None,
                        player_name=ath.get("displayName") or ath.get("fullName"),
                        team_external_id=str(team.get("id") or "") or None,
                        team_abbr=team.get("abbreviation") or team.get("displayName"),
                        detail=details.get("type") or item.get("longComment") or item.get("shortComment"),
                    )
                )
        return out

    def pick_featured_athlete(self, game_external_id: str) -> Optional[NormalizedPlayer]:
        data = self._get(f"{ESPN_SITE}/summary?event={game_external_id}")
        for team_block in data.get("leaders") or []:
            pts = next((l for l in (team_block.get("leaders") or []) if l.get("name") == "points"), None)
            top = ((pts or {}).get("leaders") or [{}])[0].get("athlete") or {}
            if top.get("id"):
                team = team_block.get("team") or {}
                return NormalizedPlayer(
                    external_id=str(top["id"]),
                    league="NBA",
                    full_name=top.get("displayName") or top.get("fullName") or "Player",
                    short_name=top.get("shortName") or top.get("displayName"),
                    position=(top.get("position") or {}).get("abbreviation")
                    if isinstance(top.get("position"), dict)
                    else None,
                    headshot_url=(top.get("headshot") or {}).get("href")
                    if isinstance(top.get("headshot"), dict)
                    else None,
                    team_external_id=str(team.get("id") or ""),
                )
        return None
