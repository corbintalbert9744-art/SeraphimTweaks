"""ESPN Soccer adapter — public scoreboard (no API key).

Primary free schedule source for Soccer. Football-Data.org remains optional
when FOOTBALL_DATA_API_KEY is set.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from app.providers.base import NormalizedGame, ProviderHttpClient, ProviderMeta

log = logging.getLogger(__name__)

# Free-tier friendly ESPN soccer scoreboards
ESPN_SOCCER_PATHS = (
    "soccer/eng.1/scoreboard",  # Premier League
    "soccer/usa.1/scoreboard",  # MLS
    "soccer/uefa.champions/scoreboard",
)


class EspnSoccerProvider:
    meta = ProviderMeta(
        name="espn-soccer",
        leagues=["Soccer"],
        capabilities=["schedule", "slate"],
        requires_api_key=False,
        is_mock=False,
        notes="Free ESPN soccer scoreboards (EPL/MLS/UCL). No API key. Player prop logs need an events extension.",
        homepage="https://www.espn.com/soccer/",
    )

    BASE = "https://site.api.espn.com/apis/site/v2/sports"

    def __init__(self, user_agent: str = "SeraphimAnalytics/1.0") -> None:
        self.http = ProviderHttpClient(user_agent=user_agent)

    def fetch_schedule(self, league: str = "Soccer", date: Optional[str] = None) -> list[NormalizedGame]:
        if league.upper() != "SOCCER":
            return []
        games: list[NormalizedGame] = []
        params = {}
        if date:
            d = date if "-" not in date and len(date) == 8 else date.replace("-", "")
            if len(d) == 8:
                params["dates"] = d
        for path in ESPN_SOCCER_PATHS:
            try:
                data = self.http.get_json(f"{self.BASE}/{path}", params=params or None)
            except Exception as exc:  # noqa: BLE001
                log.warning("espn soccer %s: %s", path, exc)
                continue
            for e in data.get("events") or []:
                tip_raw = e.get("date")
                tip = (
                    datetime.fromisoformat(str(tip_raw).replace("Z", "+00:00"))
                    if tip_raw
                    else datetime.now(timezone.utc)
                )
                comps = (e.get("competitions") or [{}])[0]
                competitors = {c.get("homeAway"): c for c in (comps.get("competitors") or [])}
                home = competitors.get("home") or {}
                away = competitors.get("away") or {}
                ht = home.get("team") or {}
                at = away.get("team") or {}
                games.append(
                    NormalizedGame(
                        external_id=str(e.get("id") or ""),
                        league="Soccer",
                        tipoff_at=tip,
                        status=(e.get("status") or {}).get("type", {}).get("description") or "Scheduled",
                        home_team_external_id=str(ht.get("id") or ""),
                        away_team_external_id=str(at.get("id") or ""),
                        home_abbr=ht.get("abbreviation") or ht.get("shortDisplayName") or "HOME",
                        away_abbr=at.get("abbreviation") or at.get("shortDisplayName") or "AWAY",
                        home_name=ht.get("displayName") or "Home",
                        away_name=at.get("displayName") or "Away",
                        home_score=_score(home.get("score")),
                        away_score=_score(away.get("score")),
                        venue=(comps.get("venue") or {}).get("fullName"),
                        home_logo=(ht.get("logos") or [{}])[0].get("href") if ht.get("logos") else None,
                        away_logo=(at.get("logos") or [{}])[0].get("href") if at.get("logos") else None,
                        raw={"source": "espn-soccer", "path": path},
                    )
                )
        return [g for g in games if g.external_id]


def _score(v) -> Optional[int]:
    if v is None or v == "":
        return None
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None
