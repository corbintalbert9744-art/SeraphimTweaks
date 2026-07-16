"""The Odds API adapter — LineMarketProvider compatible.

REQUIRES CONFIGURATION: set ODDS_API_KEY in the environment.
Docs: https://the-odds-api.com/

Used as a fallback in the multi-provider aggregator after PropLine / SharpAPI.
Pick'em boards use ``regions=us_dfs`` (PrizePicks / Underdog only) — never
sportsbook bookmakers as a substitute for DFS lines.
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

_BASKETBALL_ODDS_MARKETS = (
    "player_points,player_rebounds,player_assists,player_threes,"
    "player_steals,player_blocks,player_turnovers,"
    "player_points_rebounds,player_points_assists,player_rebounds_assists,"
    "player_points_rebounds_assists,player_double_double"
)

PROP_MARKETS = {
    "NBA": _BASKETBALL_ODDS_MARKETS,
    "NFL": "player_pass_yds,player_rush_yds,player_reception_yds",
    "WNBA": _BASKETBALL_ODDS_MARKETS,
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
    "player_threes": "Threes",
    "player_steals": "Steals",
    "player_blocks": "Blocks",
    "player_turnovers": "Turnovers",
    "player_points_rebounds": "Pts+Rebs",
    "player_points_assists": "Pts+Asts",
    "player_rebounds_assists": "Rebs+Asts",
    "player_points_rebounds_assists": "PRA",
    "player_double_double": "Double Double",
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

# PrizePicks / Underdog Fantasy live under us_dfs. Sleeper is not on this region.
PICKEM_REGIONS = "us_dfs"
PICKEM_BOOK_KEYS = frozenset({"prizepicks", "underdog"})


def _norm_league(league: str) -> str:
    if (league or "").upper() == "SOCCER":
        return "Soccer"
    return (league or "").upper()


class TheOddsApiProvider:
    meta = ProviderMeta(
        name="the-odds-api",
        leagues=list(SPORT_KEYS.keys()),
        capabilities=["odds", "props", "pickem"],
        requires_api_key=True,
        is_mock=False,
        notes=(
            "The Odds API fallback when ODDS_API_KEY is set. "
            "Sportsbook props via regions=us; PrizePicks/Underdog via us_dfs. "
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

    def fetch_player_prop_odds(
        self, league: str, date: Optional[str] = None
    ) -> list[NormalizedOddsQuote]:
        """Sportsbook player props (DraftKings, FanDuel, etc.)."""
        return self._fetch_event_props(
            league,
            date=date,
            regions="us",
            allowed_books=None,
        )

    def fetch_pickem_prop_odds(
        self,
        league: str,
        *,
        platforms: Optional[set[str]] = None,
        date: Optional[str] = None,
        max_events: Optional[int] = None,
        horizon_hours: int = 48,
    ) -> list[NormalizedOddsQuote]:
        """PrizePicks / Underdog lines via ``us_dfs`` — never sportsbook substitutes.

        Sleeper is not available on The Odds API DFS region; returns empty for that
        platform so the aggregator can try the next source.
        """
        _ = horizon_hours
        platforms_l = {p.lower() for p in platforms} if platforms else set(PICKEM_BOOK_KEYS)
        # Only keep books this API can actually serve
        wanted = platforms_l & PICKEM_BOOK_KEYS
        if not wanted:
            return []
        return self._fetch_event_props(
            league,
            date=date,
            regions=PICKEM_REGIONS,
            allowed_books=wanted,
            max_events=max_events,
        )

    def _fetch_event_props(
        self,
        league: str,
        *,
        date: Optional[str],
        regions: str,
        allowed_books: Optional[set[str]],
        max_events: Optional[int] = None,
    ) -> list[NormalizedOddsQuote]:
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
        limit = max_events if max_events is not None else 8
        for event in (events or [])[:limit]:
            eid = event.get("id")
            if eid is None:
                continue
            try:
                props = self._get(
                    f"/sports/{sport}/events/{eid}/odds",
                    {
                        "regions": regions,
                        "markets": markets,
                        "oddsFormat": "american",
                    },
                )
            except ProviderRateLimitError:
                raise
            except httpx.HTTPError:
                continue
            home = props.get("home_team") or event.get("home_team")
            away = props.get("away_team") or event.get("away_team")
            commence = props.get("commence_time") or event.get("commence_time")
            for book in props.get("bookmakers") or []:
                slug = str(book.get("key") or "").lower()
                if allowed_books is not None and slug not in allowed_books:
                    continue
                for market in book.get("markets") or []:
                    mkey = market.get("key") or ""
                    market_name = MARKET_LABELS.get(mkey, mkey or "Prop")
                    for outcome in market.get("outcomes") or []:
                        point = outcome.get("point")
                        if point is None:
                            continue
                        name = str(outcome.get("name") or "")
                        side = (
                            "Over"
                            if "over" in name.lower()
                            else "Under"
                            if "under" in name.lower()
                            else None
                        )
                        if side is None:
                            continue
                        player = str(
                            outcome.get("description") or outcome.get("name") or ""
                        ).strip()
                        if not player:
                            continue
                        try:
                            american = int(outcome.get("price") or 100)
                        except (TypeError, ValueError):
                            american = 100
                        out.append(
                            NormalizedOddsQuote(
                                league=code,
                                player_external_id=None,
                                player_name=player,
                                market=market_name,
                                side=side,
                                line=float(point),
                                american_odds=american,
                                sportsbook_slug=slug,
                                sportsbook_name=book.get("title") or book.get("key") or "Book",
                                game_external_id=str(eid),
                                captured_at=now,
                                is_mock=False,
                                source_provider="the-odds-api",
                                home_team=str(home) if home else None,
                                away_team=str(away) if away else None,
                                sport_key=sport,
                                raw={
                                    "market_key": mkey,
                                    "commence_time": commence,
                                    "regions": regions,
                                },
                            )
                        )
        return out
