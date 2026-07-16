"""ESPN Tennis adapter — public ATP/WTA scoreboards (no API key).

Parses tournament ``groupings`` → singles matchups → players.
Tennis Abstract is not scraped. Match prop boards use research/comparison
lines until Odds API or a licensed stats feed supplies live prices.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from app.providers.base import NormalizedGame, NormalizedPlayer, ProviderHttpClient, ProviderMeta

log = logging.getLogger(__name__)


class EspnTennisProvider:
    meta = ProviderMeta(
        name="espn-tennis",
        leagues=["ATP", "WTA"],
        capabilities=["schedule", "slate", "roster"],
        requires_api_key=False,
        is_mock=False,
        notes=(
            "Free ESPN ATP/WTA scoreboards — no API key. "
            "Singles matchups from tournament groupings. "
            "Prop lines use comparison catalog / Odds API when keyed — not scraped from PrizePicks."
        ),
        homepage="https://www.espn.com/tennis/",
    )

    BASE = "https://site.api.espn.com/apis/site/v2/sports/tennis"

    def __init__(self, user_agent: str = "SeraphimAnalytics/1.0") -> None:
        self.http = ProviderHttpClient(user_agent=user_agent)

    def _tour_path(self, league: str) -> str:
        return "wta" if league.upper() == "WTA" else "atp"

    def _singles_label(self, league: str) -> str:
        return "Women's Singles" if league.upper() == "WTA" else "Men's Singles"

    def fetch_schedule(self, league: str = "ATP", date: Optional[str] = None) -> list[NormalizedGame]:
        code = league.upper()
        if code not in {"ATP", "WTA"}:
            return []
        path = f"{self.BASE}/{self._tour_path(code)}/scoreboard"
        try:
            data = self.http.get_json(path)
        except Exception as exc:  # noqa: BLE001
            log.warning("espn tennis %s: %s", code, exc)
            return []
        want = self._singles_label(code)
        games: list[NormalizedGame] = []
        for e in data.get("events") or []:
            tournament = e.get("name") or e.get("shortName") or "Tournament"
            for grouping in e.get("groupings") or []:
                gname = (grouping.get("grouping") or {}).get("displayName") or ""
                if gname != want:
                    continue
                for c in grouping.get("competitions") or []:
                    parsed = self._competition_to_game(c, league=code, tournament=tournament)
                    if parsed:
                        games.append(parsed)
        return games

    def _competition_to_game(
        self, c: dict[str, Any], *, league: str, tournament: str
    ) -> Optional[NormalizedGame]:
        competitors = c.get("competitors") or []
        if len(competitors) < 2:
            return None
        a, b = competitors[0], competitors[1]
        a_name, a_id = self._competitor_identity(a)
        b_name, b_id = self._competitor_identity(b)
        if not a_name or not b_name:
            return None
        tip_raw = c.get("date") or c.get("startDate")
        tip = (
            datetime.fromisoformat(str(tip_raw).replace("Z", "+00:00"))
            if tip_raw
            else datetime.now(timezone.utc)
        )
        status = (c.get("status") or {}).get("type", {}).get("description") or "Scheduled"
        return NormalizedGame(
            external_id=str(c.get("id") or f"{a_id}-{b_id}"),
            league=league,
            tipoff_at=tip,
            status=status,
            home_team_external_id=a_id,
            away_team_external_id=b_id,
            home_abbr=(a_name.split()[-1] if a_name else "A")[:4].upper(),
            away_abbr=(b_name.split()[-1] if b_name else "B")[:4].upper(),
            home_name=a_name,
            away_name=b_name,
            venue=tournament,
            raw={"source": "espn-tennis", "tour": league, "tournament": tournament},
        )

    def _competitor_identity(self, c: dict[str, Any]) -> tuple[str, str]:
        ath = c.get("athlete") or {}
        name = ath.get("displayName") or ath.get("fullName") or c.get("displayName") or ""
        ext = str(c.get("id") or ath.get("guid") or ath.get("id") or name.replace(" ", "-").lower())
        return name, ext

    def fetch_slate_matchups(self, league: str = "ATP") -> list[dict[str, Any]]:
        """Return singles matchups with both players for pick'em board building."""
        games = self.fetch_schedule(league)
        out: list[dict[str, Any]] = []
        for g in games:
            out.append(
                {
                    "game": g,
                    "players": [
                        NormalizedPlayer(
                            external_id=g.home_team_external_id,
                            league=league.upper(),
                            full_name=g.home_name,
                            team_external_id=g.home_team_external_id,
                            position="RHB",
                            short_name=g.home_abbr,
                        ),
                        NormalizedPlayer(
                            external_id=g.away_team_external_id,
                            league=league.upper(),
                            full_name=g.away_name,
                            team_external_id=g.away_team_external_id,
                            position="RHB",
                            short_name=g.away_abbr,
                        ),
                    ],
                }
            )
        return out

    def fetch_slate_players(self, league: str = "ATP") -> list[NormalizedPlayer]:
        seen: set[str] = set()
        out: list[NormalizedPlayer] = []
        for m in self.fetch_slate_matchups(league):
            for p in m["players"]:
                if p.external_id in seen:
                    continue
                seen.add(p.external_id)
                out.append(p)
        return out
