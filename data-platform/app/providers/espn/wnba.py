"""ESPN WNBA adapter — first legitimate sports data provider (public APIs, no key).

Capabilities: schedule, roster, gamelog, injuries, featured athlete, slate athletes.
Odds / props: not provided by ESPN — use OddsProvider / comparison lines separately.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from app.providers.base import (
    NormalizedGame,
    NormalizedGamelog,
    NormalizedInjury,
    NormalizedPlayer,
    ProviderHttpClient,
    ProviderMeta,
)

ESPN_SITE = "https://site.api.espn.com/apis/site/v2/sports/basketball/wnba"
ESPN_WEB = "https://site.web.api.espn.com/apis/common/v3/sports/basketball/wnba"


class EspnWnbaProvider:
    """Live ESPN WNBA provider implementing schedule/roster/gamelog/injuries/slate."""

    meta = ProviderMeta(
        name="espn-wnba",
        leagues=["WNBA"],
        capabilities=["schedule", "gamelog", "injuries", "featured", "roster", "slate"],
        requires_api_key=False,
        is_mock=False,
        notes="Live ESPN public endpoints for WNBA scoreboard, rosters, gamelogs, and injuries.",
        homepage="https://www.espn.com/wnba/",
    )

    def __init__(
        self,
        user_agent: str = "SeraphimAnalytics/1.0",
        *,
        http: ProviderHttpClient | None = None,
    ) -> None:
        self.user_agent = user_agent
        self.http = http or ProviderHttpClient(user_agent=user_agent)

    def _get(self, url: str) -> Any:
        return self.http.get_json(url)

    def fetch_schedule(self, league: str = "WNBA", date: Optional[str] = None) -> list[NormalizedGame]:
        if league.upper() != "WNBA":
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
                    league="WNBA",
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
        if league.upper() != "WNBA":
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
                            league="WNBA",
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
        if league.upper() != "WNBA" or not game_external_id:
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
                        league="WNBA",
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
                    league="WNBA",
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
        athletes = self.pick_slate_athletes(game_external_id, per_team=1)
        return athletes[0] if athletes else None

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
                        league="WNBA",
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

    def pick_slate_athletes(self, game_external_id: str, per_team: int = 2) -> list[NormalizedPlayer]:
        """Leaders when available; otherwise skill-position roster sample for upcoming games."""
        data = self._get(f"{ESPN_SITE}/summary?event={game_external_id}")
        picked: list[NormalizedPlayer] = []
        seen: set[str] = set()

        for team_block in data.get("leaders") or []:
            team = team_block.get("team") or {}
            for cat_name in ("points", "rebounds", "assists"):
                cat = next((l for l in (team_block.get("leaders") or []) if l.get("name") == cat_name), None)
                for leader in (cat or {}).get("leaders") or []:
                    ath = leader.get("athlete") or {}
                    eid = str(ath.get("id") or "")
                    if not eid or eid in seen:
                        continue
                    seen.add(eid)
                    picked.append(
                        NormalizedPlayer(
                            external_id=eid,
                            league="WNBA",
                            full_name=ath.get("displayName") or ath.get("fullName") or "Player",
                            short_name=ath.get("shortName") or ath.get("displayName"),
                            position=(ath.get("position") or {}).get("abbreviation")
                            if isinstance(ath.get("position"), dict)
                            else None,
                            headshot_url=(ath.get("headshot") or {}).get("href")
                            if isinstance(ath.get("headshot"), dict)
                            else None,
                            team_external_id=str(team.get("id") or ""),
                        )
                    )
                    if sum(1 for p in picked if p.team_external_id == str(team.get("id") or "")) >= per_team:
                        break
                if sum(1 for p in picked if p.team_external_id == str(team.get("id") or "")) >= per_team:
                    break

        if len(picked) >= per_team * 2:
            return picked[: per_team * 2]

        header = data.get("header") or {}
        competitions = header.get("competitions") or []
        team_ids: list[str] = []
        if competitions:
            for c in competitions[0].get("competitors") or []:
                tid = str((c.get("team") or {}).get("id") or "")
                if tid:
                    if c.get("homeAway") == "home":
                        team_ids.insert(0, tid)
                    else:
                        team_ids.append(tid)
        skill = {"PG", "SG", "SF", "PF", "C", "G", "F"}
        for tid in team_ids:
            roster = self.fetch_team_roster(tid)
            candidates = [p for p in roster if (p.position or "").upper() in skill] or roster
            for p in candidates[:per_team]:
                if p.external_id not in seen:
                    seen.add(p.external_id)
                    picked.append(p)
        return picked
