"""Football-Data.org soccer adapter — free tier (requires API token).

REQUIRES CONFIGURATION: set FOOTBALL_DATA_API_KEY.
Docs: https://www.football-data.org/documentation/quickstart
Free tier: limited competitions / rate limits.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from app.providers.base import NormalizedGame, NormalizedTeam, ProviderMeta

log = logging.getLogger(__name__)

BASE = "https://api.football-data.org/v4"

# Free-tier friendly competition codes
DEFAULT_COMPETITIONS = ("PL", "CL", "PD", "BL1", "SA")


class FootballDataOrgProvider:
    meta = ProviderMeta(
        name="football-data-org",
        leagues=["Soccer"],
        capabilities=["schedule", "roster", "slate"],
        requires_api_key=True,
        is_mock=False,
        notes=(
            "REQUIRES FOOTBALL_DATA_API_KEY (free tier at football-data.org). "
            "Without a key this adapter is not used — no fabricated soccer fixtures."
        ),
        homepage="https://www.football-data.org/",
    )

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    def _get(self, path: str, params: Optional[dict[str, Any]] = None) -> Any:
        headers = {"X-Auth-Token": self.api_key}
        with httpx.Client(timeout=30.0, headers=headers) as client:
            res = client.get(f"{BASE}{path}", params=params or {})
            res.raise_for_status()
            return res.json()

    def configured(self) -> bool:
        return bool(self.api_key)

    def fetch_competitions(self) -> list[dict[str, Any]]:
        if not self.api_key:
            return []
        data = self._get("/competitions")
        return data.get("competitions") or []

    def fetch_teams(self, competition: str = "PL") -> list[NormalizedTeam]:
        if not self.api_key:
            return []
        data = self._get(f"/competitions/{competition}/teams")
        out: list[NormalizedTeam] = []
        for t in data.get("teams") or []:
            out.append(
                NormalizedTeam(
                    external_id=str(t.get("id")),
                    league="Soccer",
                    abbreviation=(t.get("tla") or t.get("shortName") or "TM")[:4],
                    name=t.get("name") or "Team",
                    logo_url=t.get("crest"),
                )
            )
        return out

    def fetch_schedule(self, league: str = "Soccer", date: Optional[str] = None) -> list[NormalizedGame]:
        if league.upper() != "SOCCER" or not self.api_key:
            return []
        games: list[NormalizedGame] = []
        for code in DEFAULT_COMPETITIONS:
            try:
                data = self._get(f"/competitions/{code}/matches", {"status": "SCHEDULED,TIMED,LIVE,FINISHED"})
            except Exception as exc:  # noqa: BLE001
                log.warning("football-data %s: %s", code, exc)
                continue
            for m in (data.get("matches") or [])[:20]:
                tip_raw = m.get("utcDate")
                tip = (
                    datetime.fromisoformat(tip_raw.replace("Z", "+00:00"))
                    if tip_raw
                    else datetime.now(timezone.utc)
                )
                if date:
                    want = date if "-" in date else f"{date[:4]}-{date[4:6]}-{date[6:8]}"
                    if tip.strftime("%Y-%m-%d") != want:
                        continue
                home = m.get("homeTeam") or {}
                away = m.get("awayTeam") or {}
                score = (m.get("score") or {}).get("fullTime") or {}
                games.append(
                    NormalizedGame(
                        external_id=str(m.get("id")),
                        league="Soccer",
                        tipoff_at=tip,
                        status=str(m.get("status") or "SCHEDULED"),
                        home_team_external_id=str(home.get("id") or ""),
                        away_team_external_id=str(away.get("id") or ""),
                        home_abbr=(home.get("tla") or home.get("shortName") or "HOME")[:4],
                        away_abbr=(away.get("tla") or away.get("shortName") or "AWAY")[:4],
                        home_name=home.get("name") or "Home",
                        away_name=away.get("name") or "Away",
                        home_score=score.get("home"),
                        away_score=score.get("away"),
                        season=str((m.get("season") or {}).get("startDate") or code),
                        raw={"source": "football-data-org", "competition": code},
                    )
                )
        return games
