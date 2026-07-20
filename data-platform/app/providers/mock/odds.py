"""Mock odds provider — clearly labeled placeholders until ODDS_API_KEY is configured."""

from __future__ import annotations

from typing import Optional

from app.providers.base import NormalizedOddsQuote, ProviderMeta


class MockOddsProvider:
    meta = ProviderMeta(
        name="mock-odds",
        leagues=["NBA", "NFL", "WNBA", "ATP", "WTA"],
        capabilities=["odds", "props"],
        requires_api_key=False,
        is_mock=True,
        notes=(
            "Stand-in when no odds API key is configured. "
            "Returns no quotes — never fabricates sportsbook lines. "
            "Set PROPLINE_API_KEY / SHARPAPI_API_KEY / ODDS_API_KEY for live data."
        ),
    )

    def fetch_player_prop_odds(self, league: str, date: Optional[str] = None) -> list[NormalizedOddsQuote]:
        # Empty list is intentional for bulk refresh; featured builder asks for quotes explicitly.
        _ = (league, date)
        return []

    def quote_for_prop(
        self,
        *,
        league: str,
        player_name: str,
        player_external_id: Optional[str],
        market: str,
        line: float,
        game_external_id: Optional[str] = None,
    ) -> list[NormalizedOddsQuote]:
        """Never invent sportsbook lines.

        When no live odds provider is keyed, return an empty list so comparison
        rows stay marked unavailable instead of fabricating DK/FD/MGM quotes.
        """
        _ = (league, player_name, player_external_id, market, line, game_external_id)
        return []
