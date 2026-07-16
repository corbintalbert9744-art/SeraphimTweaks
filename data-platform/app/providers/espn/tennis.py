"""ESPN Tennis adapter — public ATP/WTA scoreboards (no API key).

Tennis Abstract is not scraped. ESPN provides legitimate free schedules.
Player prop / match-stat boards fill when a licensed stats + odds feed is keyed.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

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
            "Match prop gamelogs are not fabricated; Odds API tennis keys are tournament-specific."
        ),
        homepage="https://www.espn.com/tennis/",
    )

    BASE = "https://site.api.espn.com/apis/site/v2/sports/tennis"

    def __init__(self, user_agent: str = "SeraphimAnalytics/1.0") -> None:
        self.http = ProviderHttpClient(user_agent=user_agent)

    def _tour_path(self, league: str) -> str:
        return "wta" if league.upper() == "WTA" else "atp"

    def fetch_schedule(self, league: str = "ATP", date: Optional[str] = None) -> list[NormalizedGame]:
        code = league.upper()
        if code not in {"ATP", "WTA"}:
            return []
        path = f"{self.BASE}/{self._tour_path(code)}/scoreboard"
        params = {}
        if date:
            d = date if "-" not in date and len(date) == 8 else date.replace("-", "")
            if len(d) == 8:
                params["dates"] = d
        try:
            data = self.http.get_json(path, params=params or None)
        except Exception as exc:  # noqa: BLE001
            log.warning("espn tennis %s: %s", code, exc)
            return []
        games: list[NormalizedGame] = []
        for e in data.get("events") or []:
            tip_raw = e.get("date")
            tip = (
                datetime.fromisoformat(str(tip_raw).replace("Z", "+00:00"))
                if tip_raw
                else datetime.now(timezone.utc)
            )
            comps = (e.get("competitions") or [{}])[0]
            competitors = comps.get("competitors") or []
            # Tennis often uses athlete objects; treat first two as sides
            a = competitors[0] if len(competitors) > 0 else {}
            b = competitors[1] if len(competitors) > 1 else {}
            a_ath = a.get("athlete") or a.get("team") or {}
            b_ath = b.get("athlete") or b.get("team") or {}
            a_name = a_ath.get("displayName") or a.get("displayName") or "Player A"
            b_name = b_ath.get("displayName") or b.get("displayName") or "Player B"
            games.append(
                NormalizedGame(
                    external_id=str(e.get("id") or ""),
                    league=code,
                    tipoff_at=tip,
                    status=(e.get("status") or {}).get("type", {}).get("description") or "Scheduled",
                    home_team_external_id=str(a_ath.get("id") or a.get("id") or "a"),
                    away_team_external_id=str(b_ath.get("id") or b.get("id") or "b"),
                    home_abbr=(a_name.split()[-1] if a_name else "A")[:4].upper(),
                    away_abbr=(b_name.split()[-1] if b_name else "B")[:4].upper(),
                    home_name=a_name,
                    away_name=b_name,
                    venue=(comps.get("venue") or {}).get("fullName") or e.get("name"),
                    raw={"source": "espn-tennis", "tour": code, "eventName": e.get("name")},
                )
            )
        return [g for g in games if g.external_id]

    def fetch_slate_players(self, league: str = "ATP") -> list[NormalizedPlayer]:
        """Players appearing on today's ESPN tennis scoreboard."""
        games = self.fetch_schedule(league)
        out: list[NormalizedPlayer] = []
        seen: set[str] = set()
        for g in games:
            for ext, name, abbr in (
                (g.home_team_external_id, g.home_name, g.home_abbr),
                (g.away_team_external_id, g.away_name, g.away_abbr),
            ):
                if not ext or ext in seen:
                    continue
                seen.add(ext)
                out.append(
                    NormalizedPlayer(
                        external_id=ext,
                        league=league.upper(),
                        full_name=name,
                        team_external_id=ext,
                        position="RHB",
                        short_name=abbr,
                    )
                )
        return out
