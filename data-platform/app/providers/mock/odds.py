"""Mock odds provider — clearly labeled placeholders until ODDS_API_KEY is configured."""

from __future__ import annotations

from datetime import datetime, timezone
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
            "MOCK — returns -110/-110 consensus placeholders. "
            "Replace by setting ODDS_API_KEY (The Odds API) or another OddsProvider."
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
        now = datetime.now(timezone.utc)
        books = [
            ("draftkings", "DraftKings"),
            ("fanduel", "FanDuel"),
            ("betmgm", "BetMGM"),
        ]
        out: list[NormalizedOddsQuote] = []
        for slug, name in books:
            for side, american in (("Over", -110), ("Under", -110)):
                out.append(
                    NormalizedOddsQuote(
                        league=league,
                        player_external_id=player_external_id,
                        player_name=player_name,
                        market=market,
                        side=side,
                        line=line,
                        american_odds=american,
                        sportsbook_slug=slug,
                        sportsbook_name=name,
                        game_external_id=game_external_id,
                        captured_at=now,
                        is_mock=True,
                    )
                )
        return out
