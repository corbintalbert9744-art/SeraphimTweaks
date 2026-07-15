"""The Odds API adapter.

REQUIRES CONFIGURATION: set ODDS_API_KEY in the environment.
Docs: https://the-odds-api.com/

Without a key, registry falls back to MockOddsProvider.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from app.providers.base import NormalizedOddsQuote, ProviderMeta

# Sport keys used by The Odds API — confirm in their dashboard when enabling.
SPORT_KEYS = {
    "NBA": "basketball_nba",
    "NFL": "americanfootball_nfl",
    "WNBA": "basketball_wnba",
    # Tennis keys vary by tour — confirm before production use:
    "ATP": "tennis_atp_french_open",  # PLACEHOLDER — select correct tournament keys
    "WTA": "tennis_wta_french_open",  # PLACEHOLDER — select correct tournament keys
}


class TheOddsApiProvider:
    meta = ProviderMeta(
        name="the-odds-api",
        leagues=list(SPORT_KEYS.keys()),
        capabilities=["odds", "props"],
        requires_api_key=True,
        is_mock=False,
        notes="Live player-prop odds when ODDS_API_KEY is set. ATP/WTA sport keys need verification.",
    )

    BASE = "https://api.the-odds-api.com/v4"

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    def _get(self, path: str, params: dict[str, Any]) -> Any:
        params = {**params, "apiKey": self.api_key}
        with httpx.Client(timeout=30.0) as client:
            res = client.get(f"{self.BASE}{path}", params=params)
            res.raise_for_status()
            return res.json()

    def fetch_player_prop_odds(self, league: str, date: Optional[str] = None) -> list[NormalizedOddsQuote]:
        sport = SPORT_KEYS.get(league.upper())
        if not sport or not self.api_key:
            return []
        _ = date
        # Player props endpoint — markets vary by sport.
        # REQUIRES: confirm market keys (player_points, etc.) for each league in The Odds API docs.
        events = self._get(f"/sports/{sport}/events", {})
        out: list[NormalizedOddsQuote] = []
        now = datetime.now(timezone.utc)
        for event in events[:8]:
            eid = event.get("id")
            try:
                props = self._get(
                    f"/sports/{sport}/events/{eid}/odds",
                    {
                        "regions": "us",
                        "markets": "player_points,player_rebounds,player_assists",
                        "oddsFormat": "american",
                    },
                )
            except httpx.HTTPError:
                continue
            for book in props.get("bookmakers") or []:
                for market in book.get("markets") or []:
                    market_name = {
                        "player_points": "Points",
                        "player_rebounds": "Rebounds",
                        "player_assists": "Assists",
                    }.get(market.get("key") or "", market.get("key") or "Prop")
                    for outcome in market.get("outcomes") or []:
                        out.append(
                            NormalizedOddsQuote(
                                league=league.upper(),
                                player_external_id=None,
                                player_name=outcome.get("description") or outcome.get("name") or "Player",
                                market=market_name,
                                side="Over" if "over" in (outcome.get("name") or "").lower() else "Under",
                                line=float(outcome.get("point") or 0),
                                american_odds=int(outcome.get("price") or -110),
                                sportsbook_slug=(book.get("key") or "book").lower(),
                                sportsbook_name=book.get("title") or book.get("key") or "Book",
                                game_external_id=str(eid),
                                captured_at=now,
                                is_mock=False,
                            )
                        )
        return out
