"""Comparison line providers — sportsbooks + fantasy pick'em.

UI never talks to a vendor SDK. Ingest / serializers call these adapters.
Swap MockComparisonLinesProvider for live PrizePicks / Underdog / Odds API
without changing PropDetail or the board.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal, Optional, Protocol, runtime_checkable

from app.providers.base import NormalizedOddsQuote, ProviderMeta

ProviderKind = Literal["sportsbook", "pickem"]


@dataclass
class ComparisonLine:
    """One operator line for a prop — sportsbook odds or pick'em entry."""

    name: str
    slug: str
    kind: ProviderKind
    line: float
    over: int = -110
    under: int = -110
    is_mock: bool = True
    provider: str = "mock-comparison-lines"


def edge_vs_projection(projected: float, line: float, model_side: str) -> float:
    """Positive = line favors the model's recommended side."""
    raw = projected - line
    return round(raw if model_side == "Over" else -raw, 2)


def best_value_line(lines: list[dict], *, model_side: str) -> Optional[str]:
    if not lines:
        return None
    ranked = sorted(
        lines,
        key=lambda row: edge_vs_projection(
            float(row.get("projectedValue") or row.get("_projected") or 0),
            float(row["line"]),
            model_side,
        ),
        reverse=True,
    )
    return ranked[0].get("book") or ranked[0].get("name")


@runtime_checkable
class ComparisonLinesProvider(Protocol):
    meta: ProviderMeta

    def quote_lines(
        self,
        *,
        league: str,
        player_name: str,
        player_external_id: Optional[str],
        market: str,
        baseline_line: float,
        projected_value: float,
        game_external_id: Optional[str] = None,
    ) -> list[ComparisonLine]:
        ...


class MockComparisonLinesProvider:
    """Demo sportsbook + pick'em lines with slight spreads around the baseline.

    Clearly labeled mock until real operator adapters are wired.
    Line offsets create a realistic “best value” without inventing odds from air.
    """

    meta = ProviderMeta(
        name="mock-comparison-lines",
        leagues=["NBA", "NFL", "WNBA"],
        capabilities=["odds", "props", "pickem"],
        requires_api_key=False,
        is_mock=True,
        notes=(
            "MOCK sportsbooks (DK/FD/BetMGM) + pick'em (PrizePicks/Underdog/Sleeper/ParlayPlay). "
            "Replace with live ComparisonLinesProvider adapters; UI stays the same."
        ),
    )

    # Offsets from baseline consensus line — pick'em often sits near projection.
    _SPORTSBOOKS = (
        ("draftkings", "DraftKings", 0.0),
        ("fanduel", "FanDuel", 0.0),
        ("betmgm", "BetMGM", 0.5),
    )
    _PICKEM = (
        ("prizepicks", "PrizePicks", -1.5),
        ("underdog", "Underdog", -1.0),
        ("sleeper", "Sleeper", -1.5),
        ("parlayplay", "ParlayPlay", 0.5),
    )

    def quote_lines(
        self,
        *,
        league: str,
        player_name: str,
        player_external_id: Optional[str],
        market: str,
        baseline_line: float,
        projected_value: float,
        game_external_id: Optional[str] = None,
    ) -> list[ComparisonLine]:
        _ = (league, player_name, player_external_id, market, projected_value, game_external_id)
        out: list[ComparisonLine] = []
        for slug, name, offset in self._SPORTSBOOKS:
            out.append(
                ComparisonLine(
                    name=name,
                    slug=slug,
                    kind="sportsbook",
                    line=max(0.5, round((baseline_line + offset) * 2) / 2),
                    over=-110,
                    under=-110,
                    is_mock=True,
                )
            )
        for slug, name, offset in self._PICKEM:
            # Pick'em lines often sit off consensus — offsets create a clear Best Value.
            out.append(
                ComparisonLine(
                    name=name,
                    slug=slug,
                    kind="pickem",
                    line=max(0.5, round((baseline_line + offset) * 2) / 2),
                    over=-110,
                    under=-110,
                    is_mock=True,
                )
            )
        return out

    def to_odds_quotes(
        self,
        *,
        league: str,
        player_name: str,
        player_external_id: Optional[str],
        market: str,
        baseline_line: float,
        projected_value: float,
        game_external_id: Optional[str] = None,
    ) -> list[NormalizedOddsQuote]:
        """Persistable Over quotes (Under mirrored at insert time if needed)."""
        now = datetime.now(timezone.utc)
        quotes: list[NormalizedOddsQuote] = []
        for row in self.quote_lines(
            league=league,
            player_name=player_name,
            player_external_id=player_external_id,
            market=market,
            baseline_line=baseline_line,
            projected_value=projected_value,
            game_external_id=game_external_id,
        ):
            for side, american in (("Over", row.over), ("Under", row.under)):
                quotes.append(
                    NormalizedOddsQuote(
                        league=league,
                        player_external_id=player_external_id,
                        player_name=player_name,
                        market=market,
                        side=side,
                        line=row.line,
                        american_odds=american,
                        sportsbook_slug=row.slug,
                        sportsbook_name=row.name,
                        game_external_id=game_external_id,
                        captured_at=now,
                        is_mock=True,
                    )
                )
        return quotes


def get_comparison_lines_provider() -> ComparisonLinesProvider:
    """Registry hook — swap to live providers when keys exist."""
    return MockComparisonLinesProvider()
