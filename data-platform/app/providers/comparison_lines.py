"""Comparison line providers — sportsbooks + fantasy pick'em.

UI never talks to a vendor SDK. Ingest / serializers call these adapters.
Swap PlaceholderComparisonLinesProvider for live PrizePicks / Underdog / Odds API
adapters without changing PropDetail or the board.

Canonical operators (always returned):
  PrizePicks, Underdog, FanDuel, DraftKings, BetMGM, Caesars, Fanatics, ESPN BET
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal, Optional, Protocol, runtime_checkable

from app.providers.base import NormalizedOddsQuote, ProviderMeta

ProviderKind = Literal["sportsbook", "pickem"]


@dataclass(frozen=True)
class LineProviderSpec:
    """Registry entry for a comparison-line operator."""

    slug: str
    name: str
    kind: ProviderKind
    # Offset from baseline when emitting placeholder/demo lines
    placeholder_offset: float = 0.0
    # True when a live adapter is wired and producing real quotes
    connected: bool = False
    notes: str = ""


# Fixed catalog — UI always shows these rows. Add adapters by flipping `connected`.
CANONICAL_LINE_PROVIDERS: tuple[LineProviderSpec, ...] = (
    LineProviderSpec(
        "prizepicks",
        "PrizePicks",
        "pickem",
        placeholder_offset=-1.5,
        connected=False,
        notes="Requires PrizePicks partner / scrape adapter.",
    ),
    LineProviderSpec(
        "underdog",
        "Underdog",
        "pickem",
        placeholder_offset=-1.0,
        connected=False,
        notes="Requires Underdog Fantasy API adapter.",
    ),
    LineProviderSpec(
        "fanduel",
        "FanDuel",
        "sportsbook",
        placeholder_offset=0.0,
        connected=False,
        notes="Covered by The Odds API when ODDS_API_KEY is set.",
    ),
    LineProviderSpec(
        "draftkings",
        "DraftKings",
        "sportsbook",
        placeholder_offset=0.0,
        connected=False,
        notes="Covered by The Odds API when ODDS_API_KEY is set.",
    ),
    LineProviderSpec(
        "betmgm",
        "BetMGM",
        "sportsbook",
        placeholder_offset=0.5,
        connected=False,
        notes="Covered by The Odds API when ODDS_API_KEY is set.",
    ),
    LineProviderSpec(
        "caesars",
        "Caesars",
        "sportsbook",
        placeholder_offset=0.5,
        connected=False,
        notes="Requires Caesars / Odds API book key mapping.",
    ),
    LineProviderSpec(
        "fanatics",
        "Fanatics Sportsbook",
        "sportsbook",
        placeholder_offset=-0.5,
        connected=False,
        notes="Requires Fanatics Sportsbook adapter.",
    ),
    LineProviderSpec(
        "espnbet",
        "ESPN BET",
        "sportsbook",
        placeholder_offset=0.0,
        connected=False,
        notes="Requires ESPN BET / Odds API book key mapping.",
    ),
)


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
    connected: bool = False
    requires_integration: bool = True
    provider: str = "comparison-lines"
    notes: str = ""


def edge_vs_projection(projected: float, line: float, model_side: str) -> float:
    """Positive = line favors the model's recommended side."""
    raw = projected - line
    return round(raw if model_side == "Over" else -raw, 2)


def best_value_line(lines: list[dict], *, model_side: str) -> Optional[str]:
    if not lines:
        return None
    # Prefer connected lines when ranking best value
    eligible = [row for row in lines if not row.get("requiresIntegration")] or lines
    ranked = sorted(
        eligible,
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
        live_quotes: Optional[list[NormalizedOddsQuote]] = None,
    ) -> list[ComparisonLine]:
        ...


class CatalogComparisonLinesProvider:
    """Always returns the canonical 8 operators.

    - Connected sportsbooks: use live Odds API quotes when present.
    - Otherwise: placeholder line near baseline, clearly marked requires_integration.
    """

    meta = ProviderMeta(
        name="catalog-comparison-lines",
        leagues=["NBA", "NFL", "WNBA", "MLB", "NHL", "Soccer", "ATP", "WTA"],
        capabilities=["odds", "props", "pickem"],
        requires_api_key=False,
        is_mock=True,
        notes=(
            "Canonical line catalog (PrizePicks, Underdog, FanDuel, DraftKings, BetMGM, "
            "Caesars, Fanatics, ESPN BET). Unconnected operators return placeholder lines "
            "marked requires_integration. Swap individual adapters without UI changes."
        ),
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
        live_quotes: Optional[list[NormalizedOddsQuote]] = None,
    ) -> list[ComparisonLine]:
        _ = (league, player_name, player_external_id, market, projected_value, game_external_id)
        live_by_slug: dict[str, NormalizedOddsQuote] = {}
        for q in live_quotes or []:
            slug = (q.sportsbook_slug or "").lower().replace(" ", "").replace("-", "")
            # Normalize common Odds API keys
            aliases = {
                "draftkings": "draftkings",
                "fanduel": "fanduel",
                "betmgm": "betmgm",
                "williamhill_us": "caesars",
                "caesars": "caesars",
                "espnbet": "espnbet",
                "espn_bet": "espnbet",
                "fanatics": "fanatics",
            }
            key = aliases.get(slug, slug)
            # Prefer Over quotes for line
            if key not in live_by_slug or q.side == "Over":
                live_by_slug[key] = q

        out: list[ComparisonLine] = []
        for spec in CANONICAL_LINE_PROVIDERS:
            live = live_by_slug.get(spec.slug)
            if live is not None:
                over = live.american_odds if live.side == "Over" else -110
                under = live.american_odds if live.side == "Under" else -110
                # Pair if we only have one side
                out.append(
                    ComparisonLine(
                        name=spec.name,
                        slug=spec.slug,
                        kind=spec.kind,
                        line=float(live.line),
                        over=over if live.side == "Over" else -110,
                        under=under if live.side == "Under" else -110,
                        is_mock=False,
                        connected=True,
                        requires_integration=False,
                        provider=live.sportsbook_slug or "the-odds-api",
                        notes="Live quote",
                    )
                )
                continue

            placeholder_line = max(0.5, round((baseline_line + spec.placeholder_offset) * 2) / 2)
            out.append(
                ComparisonLine(
                    name=spec.name,
                    slug=spec.slug,
                    kind=spec.kind,
                    line=placeholder_line,
                    over=-110,
                    under=-110,
                    is_mock=True,
                    connected=spec.connected,
                    requires_integration=not spec.connected,
                    provider="placeholder",
                    notes=spec.notes or "Requires integration",
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
        live_quotes: Optional[list[NormalizedOddsQuote]] = None,
    ) -> list[NormalizedOddsQuote]:
        """Persistable Over/Under quotes for warehouse odds table."""
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
            live_quotes=live_quotes,
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
                        is_mock=row.is_mock,
                    )
                )
        return quotes


# Back-compat alias
MockComparisonLinesProvider = CatalogComparisonLinesProvider


def get_comparison_lines_provider() -> ComparisonLinesProvider:
    """Registry hook — swap to composite live providers when keys exist."""
    return CatalogComparisonLinesProvider()


def canonical_provider_catalog() -> list[dict]:
    """Public catalog for /providers and frontend LineComparison."""
    return [
        {
            "slug": s.slug,
            "name": s.name,
            "kind": s.kind,
            "connected": s.connected,
            "requiresIntegration": not s.connected,
            "notes": s.notes,
        }
        for s in CANONICAL_LINE_PROVIDERS
    ]
