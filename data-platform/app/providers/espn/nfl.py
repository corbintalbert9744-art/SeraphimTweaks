"""ESPN NFL adapter — public APIs, no key required.

Capabilities: schedule, gamelog, injuries, featured athlete, team roster fallback.
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

ESPN_SITE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl"
ESPN_WEB = "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl"


class EspnNflProvider:
    meta = ProviderMeta(
        name="espn-nfl",
        leagues=["NFL"],
        capabilities=["schedule", "gamelog", "injuries", "featured", "roster"],
        requires_api_key=False,
        is_mock=False,
        notes="Live ESPN public endpoints for NFL scoreboard, gamelogs, injuries, and roster fallback.",
    )

    def __init__(self, user_agent: str = "SeraphimAnalytics/1.0") -> None:
        self.user_agent = user_agent

    def _get(self, url: str) -> Any:
        with httpx.Client(
            timeout=30.0,
            headers={"User-Agent": self.user_agent, "Accept": "application/json"},
        ) as client:
            res = client.get(url)
            res.raise_for_status()
            return res.json()

    def fetch_schedule(self, league: str = "NFL", date: Optional[str] = None) -> list[NormalizedGame]:
        if league.upper() != "NFL":
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
            season = None
            if e.get("season"):
                season = str((e.get("season") or {}).get("year") or "")
            games.append(
                NormalizedGame(
                    external_id=str(e.get("id")),
                    league="NFL",
                    tipoff_at=tipoff,
                    status=(e.get("status") or {}).get("type", {}).get("name") or "STATUS_UNKNOWN",
                    home_team_external_id=str(home_team.get("id") or ""),
                    away_team_external_id=str(away_team.get("id") or ""),
                    home_abbr=home_team.get("abbreviation") or "HOME",
                    away_abbr=away_team.get("abbreviation") or "AWAY",
                    home_name=home_team.get("displayName") or "Home",
                    away_name=away_team.get("displayName") or "Away",
                    season=season or None,
                    venue=(comp.get("venue") or {}).get("fullName"),
                    home_score=int(home["score"]) if home.get("score") not in (None, "") else None,
                    away_score=int(away["score"]) if away.get("score") not in (None, "") else None,
                    home_logo=home_team.get("logo"),
                    away_logo=away_team.get("logo"),
                    raw={"event": e.get("id"), "shortName": e.get("shortName"), "week": (e.get("week") or {}).get("number")},
                )
            )
        return games

    def fetch_team_roster(self, team_external_id: str) -> list[NormalizedPlayer]:
        data = self._get(f"{ESPN_SITE}/teams/{team_external_id}/roster")
        out: list[NormalizedPlayer] = []
        for group in data.get("athletes") or []:
            for a in group.get("items") or []:
                if not a.get("id"):
                    continue
                pos = a.get("position") or {}
                out.append(
                    NormalizedPlayer(
                        external_id=str(a["id"]),
                        league="NFL",
                        full_name=a.get("displayName") or a.get("fullName") or "Player",
                        short_name=a.get("shortName") or a.get("displayName"),
                        position=pos.get("abbreviation") if isinstance(pos, dict) else None,
                        jersey=str(a.get("jersey") or "") or None,
                        headshot_url=(a.get("headshot") or {}).get("href")
                        if isinstance(a.get("headshot"), dict)
                        else None,
                        team_external_id=str(team_external_id),
                    )
                )
        return out

    def fetch_gamelog(self, league: str, player_external_id: str) -> list[NormalizedGamelog]:
        if league.upper() != "NFL":
            return []
        data = self._get(f"{ESPN_WEB}/athletes/{player_external_id}/gamelog")
        names: list[str] = data.get("names") or []
        labels: list[str] = data.get("labels") or []

        def idx(key: str) -> int:
            for i, n in enumerate(names):
                if n.lower() == key.lower():
                    return i
            return -1

        i_pass = idx("passingYards")
        i_rush = idx("rushingYards")
        i_rec = idx("receivingYards")
        i_receptions = idx("receptions")
        i_targets = idx("receivingTargets")
        # Some skill players only have receiving names
        if i_rec < 0:
            # duplicate YDS labels — prefer later receiving block if names include receivingYards
            pass

        events_map: dict = data.get("events") or {}
        rows: list[NormalizedGamelog] = []

        def num(stats: list, i: int) -> Optional[float]:
            if i < 0 or i >= len(stats):
                return None
            try:
                cleaned = "".join(ch for ch in str(stats[i]) if ch.isdigit() or ch == "." or ch == "-")
                return float(cleaned) if cleaned not in ("", "-") else None
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
                    opp_abbr = (
                        opp.get("abbreviation")
                        if isinstance(opp, dict)
                        else meta.get("opponentAbbreviation") or "OPP"
                    )
                    home = bool(meta.get("atVs") == "vs" or meta.get("homeAway") == "home")
                    pass_yds = num(stats, i_pass)
                    rush_yds = num(stats, i_rush)
                    rec_yds = num(stats, i_rec)
                    receptions = num(stats, i_receptions)
                    # Map primary volume into points for warehouse reuse (Passing Yards featured).
                    primary = pass_yds if pass_yds is not None else (
                        rec_yds if rec_yds is not None else rush_yds
                    )
                    rows.append(
                        NormalizedGamelog(
                            player_external_id=player_external_id,
                            league="NFL",
                            played_at=played,
                            opponent=opp_abbr or "OPP",
                            home=home,
                            game_external_id=event_id or None,
                            points=primary,
                            rebounds=rush_yds,
                            assists=rec_yds,
                            threes=receptions,
                            raw={
                                "eventId": event_id,
                                "passingYards": pass_yds,
                                "rushingYards": rush_yds,
                                "receivingYards": rec_yds,
                                "receptions": receptions,
                                "targets": num(stats, i_targets),
                                "labels": labels[:8],
                            },
                        )
                    )

        rows.sort(key=lambda r: r.played_at, reverse=True)
        return rows

    def fetch_injuries(self, league: str, game_external_id: Optional[str] = None) -> list[NormalizedInjury]:
        if league.upper() != "NFL" or not game_external_id:
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
                        league="NFL",
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

        # Prefer passingYards leader when available (live/final games).
        for team_block in data.get("leaders") or []:
            for preferred in ("passingYards", "receivingYards", "rushingYards"):
                cat = next((l for l in (team_block.get("leaders") or []) if l.get("name") == preferred), None)
                top = ((cat or {}).get("leaders") or [{}])[0].get("athlete") or {}
                if top.get("id"):
                    team = team_block.get("team") or {}
                    return NormalizedPlayer(
                        external_id=str(top["id"]),
                        league="NFL",
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

        # Upcoming games: roster fallback — first QB on home team, else any QB/WR/RB.
        header = data.get("header") or {}
        competitions = header.get("competitions") or []
        team_ids: list[str] = []
        if competitions:
            for c in competitions[0].get("competitors") or []:
                tid = str((c.get("team") or {}).get("id") or "")
                if tid:
                    # home first
                    if c.get("homeAway") == "home":
                        team_ids.insert(0, tid)
                    else:
                        team_ids.append(tid)
        for tid in team_ids:
            roster = self.fetch_team_roster(tid)
            qbs = [p for p in roster if (p.position or "").upper() == "QB"]
            if qbs:
                return qbs[0]
            skill = [p for p in roster if (p.position or "").upper() in ("WR", "RB", "TE")]
            if skill:
                return skill[0]
        return None
