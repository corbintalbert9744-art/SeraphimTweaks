"""The Odds API adapter — LineMarketProvider compatible.

REQUIRES CONFIGURATION: set ODDS_API_KEY in the environment.
Docs: https://the-odds-api.com/

Used as a fallback in the multi-provider aggregator after PropLine / SharpAPI.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from app.providers.base import (
    LeagueSupportStatus,
    NormalizedOddsQuote,
    ProviderMeta,
    ProviderRateLimitError,
)

SPORT_KEYS = {
    "NBA": "basketball_nba",
    "NFL": "americanfootball_nfl",
    "WNBA": "basketball_wnba",
    "MLB": "baseball_mlb",
    "NHL": "icehockey_nhl",
    "Soccer": "soccer_epl",
    "ATP": "tennis_atp_french_open",
    "WTA": "tennis_wta_french_open",
}

PROP_MARKETS = {
    "NBA": "player_points,player_rebounds,player_assists",
    "NFL": "player_pass_yds,player_rush_yds,player_reception_yds",
    "WNBA": "player_points,player_rebounds,player_assists",
    "MLB": "batter_hits,batter_home_runs,batter_total_bases",
    "NHL": "player_points,player_goals,player_assists,player_shots_on_goal",
    "Soccer": "player_goal_scorer_anytime",
    # Tournament keys must be verified — empty until confirmed.
    "ATP": "",
    "WTA": "",
}

MARKET_LABELS = {
    "player_points": "Points",
    "player_rebounds": "Rebounds",
    "player_assists": "Assists",
    "player_pass_yds": "Pass Yards",
    "player_rush_yds": "Rush Yards",
    "player_reception_yds": "Receiving Yards",
    "batter_hits": "Hits",
    "batter_home_runs": "Home Runs",
    "batter_total_bases": "Total Bases",
    "player_goals": "Goals",
    "player_shots_on_goal": "Shots",
    "player_goal_scorer_anytime": "Anytime Goalscorer",
}


def _norm_league(league: str) -> str:
    if (league or "").upper() == "SOCCER":
        return "Soccer"
    return (league or "").upper()


class TheOddsApiProvider:
    meta = ProviderMeta(
        name="the-odds-api",
        leagues=list(SPORT_KEYS.keys()),
        capabilities=["odds", "props"],
        requires_api_key=True,
        is_mock=False,
        notes=(
            "The Odds API fallback when ODDS_API_KEY is set. "
            "NBA/NFL/WNBA/MLB/NHL/Soccer props; ATP/WTA tournament keys need verification."
        ),
        homepage="https://the-odds-api.com/",
    )

    BASE = "https://api.the-odds-api.com/v4"

    def __init__(self, api_key: str) -> None:
        self.api_key = (api_key or "").strip()

    @property
    def source_id(self) -> str:
        return "the-odds-api"

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def supports_league(self, league: str) -> LeagueSupportStatus:
        code = _norm_league(league)
        if code not in SPORT_KEYS:
            return LeagueSupportStatus(code, False, reason="No sport key", unavailable=True)
        markets = PROP_MARKETS.get(code) or ""
        if not markets:
            return LeagueSupportStatus(
                code,
                False,
                reason=f"The Odds API player-prop markets for {code} are not configured / unverified.",
                unavailable=True,
            )
        if not self.api_key:
            return LeagueSupportStatus(code, False, reason="ODDS_API_KEY not configured")
        return LeagueSupportStatus(code, True)

    def _get(self, path: str, params: dict[str, Any]) -> Any:
        params = {**params, "apiKey": self.api_key}
        with httpx.Client(timeout=30.0) as client:
            res = client.get(f"{self.BASE}{path}", params=params)
            if res.status_code == 429:
                raise ProviderRateLimitError("the-odds-api", "HTTP 429")
            res.raise_for_status()
            return res.json()

    def fetch_player_prop_odds(self, league: str, date: Optional[str] = None) -> list[NormalizedOddsQuote]:
        code = _norm_league(league)
        support = self.supports_league(code)
        if not support.supported:
            return []
        _ = date
        sport = SPORT_KEYS[code]
        markets = PROP_MARKETS[code]
        events = self._get(f"/sports/{sport}/events", {})
        out: list[NormalizedOddsQuote] = []
        now = datetime.now(timezone.utc)
        for event in (events or [])[:8]:
            eid = event.get("id")
            try:
                props = self._get(
                    f"/sports/{sport}/events/{eid}/odds",
                    {
                        "regions": "us",
                        "markets": markets,
                        "oddsFormat": "american",
                    },
                )
            except ProviderRateLimitError:
                raise
            except httpx.HTTPError:
                continue
            for book in props.get("bookmakers") or []:
                for market in book.get("markets") or []:
                    mkey = market.get("key") or ""
                    market_name = MARKET_LABELS.get(mkey, mkey or "Prop")
                    for outcome in market.get("outcomes") or []:
                        out.append(
                            NormalizedOddsQuote(
                                league=code,
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
                                source_provider="the-odds-api",
                            )
                        )
        return out
