"""Comparison line providers — sportsbooks + fantasy pick'em.

UI never talks to a vendor SDK. Ingest / serializers call these adapters.
Live quotes come from the multi-provider aggregator (PropLine, SharpAPI,
The Odds API, Antelytics) cached in Postgres.

Canonical operators (always returned):
  PrizePicks, Underdog, Sleeper, FanDuel, DraftKings, BetMGM, Caesars,
  Fanatics, ESPN BET, Bovada, Pinnacle, BetRivers

Missing operators are marked requires_integration / unavailable — never fabricated.
"""

from __future__ import annotations

from dataclasses import dataclass
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
    placeholder_offset: float = 0.0
    connected: bool = False
    notes: str = ""


# Fixed catalog — UI always shows these rows. Live adapters flip rows via live_quotes.
CANONICAL_LINE_PROVIDERS: tuple[LineProviderSpec, ...] = (
    LineProviderSpec(
        "prizepicks",
        "PrizePicks",
        "pickem",
        notes="Live when PropLine (or another adapter) returns PrizePicks — otherwise unavailable.",
    ),
    LineProviderSpec(
        "underdog",
        "Underdog",
        "pickem",
        notes="Live when PropLine / Underdog Fantasy quotes arrive — otherwise unavailable.",
    ),
    LineProviderSpec(
        "sleeper",
        "Sleeper",
        "pickem",
        notes="Live when PropLine / SharpAPI returns Sleeper — otherwise unavailable.",
    ),
    LineProviderSpec(
        "fanduel",
        "FanDuel",
        "sportsbook",
        notes="Live via PropLine / SharpAPI / The Odds API when keyed.",
    ),
    LineProviderSpec(
        "draftkings",
        "DraftKings",
        "sportsbook",
        notes="Live via PropLine / SharpAPI / The Odds API when keyed.",
    ),
    LineProviderSpec(
        "betmgm",
        "BetMGM",
        "sportsbook",
        notes="Live via PropLine / SharpAPI / The Odds API when keyed.",
    ),
    LineProviderSpec(
        "caesars",
        "Caesars",
        "sportsbook",
        notes="Live via The Odds API (williamhill_us) / PropLine when keyed.",
    ),
    LineProviderSpec(
        "fanatics",
        "Fanatics",
        "sportsbook",
        notes="Live via PropLine / The Odds API when keyed.",
    ),
    LineProviderSpec(
        "espnbet",
        "ESPN BET",
        "sportsbook",
        notes="Live via PropLine / The Odds API when keyed.",
    ),
    LineProviderSpec(
        "bovada",
        "Bovada",
        "sportsbook",
        notes="Live via PropLine when keyed.",
    ),
    LineProviderSpec(
        "pinnacle",
        "Pinnacle",
        "sportsbook",
        notes="Live via PropLine / SharpAPI when keyed.",
    ),
    LineProviderSpec(
        "betrivers",
        "BetRivers",
        "sportsbook",
        notes="Live via PropLine when keyed.",
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
    source_provider: Optional[str] = None
    notes: str = ""
    captured_at: Optional[datetime] = None


def edge_vs_projection(projected: float, line: float, model_side: str) -> float:
    """Positive = line favors the model's recommended side."""
    raw = projected - line
    return round(raw if model_side == "Over" else -raw, 2)


def best_value_line(lines: list[dict], *, model_side: str) -> Optional[str]:
    if not lines:
        return None
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


_SLUG_ALIASES = {
    "draftkings": "draftkings",
    "dk": "draftkings",
    "fanduel": "fanduel",
    "fd": "fanduel",
    "betmgm": "betmgm",
    "mgm": "betmgm",
    "williamhill_us": "caesars",
    "williamhill": "caesars",
    "caesars": "caesars",
    "czr": "caesars",
    "espnbet": "espnbet",
    "espn_bet": "espnbet",
    "espn": "espnbet",
    "fanatics": "fanatics",
    "bovada": "bovada",
    "pinnacle": "pinnacle",
    "betrivers": "betrivers",
    "prizepicks": "prizepicks",
    "underdog": "underdog",
    "underdogfantasy": "underdog",
    "unibet": "unibet",
    "sleeper": "sleeper",
    "parlayplay": "parlayplay",
}


def normalize_book_slug(slug: str | None) -> str:
    raw = (slug or "").lower().replace(" ", "").replace("-", "").replace("_", "")
    # Keep underscore form for williamhill_us before stripping
    spaced = (slug or "").lower().replace(" ", "").replace("-", "_")
    if spaced in _SLUG_ALIASES:
        return _SLUG_ALIASES[spaced]
    return _SLUG_ALIASES.get(raw, raw)


class CatalogComparisonLinesProvider:
    """Always returns the canonical operators.

    - Connected books: use live aggregator quotes when present (with source_provider).
    - Otherwise: unavailable placeholder — requires_integration, not fabricated.
    """

    meta = ProviderMeta(
        name="catalog-comparison-lines",
        leagues=["NBA", "NFL", "WNBA", "MLB", "NHL", "Soccer", "ATP", "WTA"],
        capabilities=["odds", "props", "pickem"],
        requires_api_key=False,
        is_mock=True,
        notes=(
            "Canonical line catalog. Live rows come from the multi-provider aggregator cache. "
            "Unavailable operators stay labeled — never fabricated."
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
        live_by_slug: dict[str, dict[str, NormalizedOddsQuote]] = {}
        for q in live_quotes or []:
            key = normalize_book_slug(q.sportsbook_slug)
            bucket = live_by_slug.setdefault(key, {})
            if q.side not in bucket or q.side == "Over":
                bucket[q.side] = q
            if "line" not in bucket or q.side == "Over":
                bucket["line"] = q  # type: ignore[assignment]

        out: list[ComparisonLine] = []
        for spec in CANONICAL_LINE_PROVIDERS:
            sides = live_by_slug.get(spec.slug)
            if sides:
                over_q = sides.get("Over")
                under_q = sides.get("Under")
                line_q = over_q or under_q or next(iter(sides.values()))
                source = (
                    (over_q or under_q or line_q).source_provider  # type: ignore[union-attr]
                    if line_q
                    else None
                )
                captured = None
                for candidate in (over_q, under_q, line_q):
                    if candidate is not None and getattr(candidate, "captured_at", None):
                        ts = candidate.captured_at
                        if captured is None or (ts and ts > captured):
                            captured = ts
                out.append(
                    ComparisonLine(
                        name=spec.name,
                        slug=spec.slug,
                        kind=spec.kind,
                        line=float(line_q.line),  # type: ignore[union-attr]
                        over=int(over_q.american_odds) if over_q else -110,
                        under=int(under_q.american_odds) if under_q else -110,
                        is_mock=False,
                        connected=True,
                        requires_integration=False,
                        provider=source or "line-aggregator",
                        source_provider=source,
                        notes=f"Live via {source or 'aggregator'}",
                        captured_at=captured,
                    )
                )
                continue

            out.append(
                ComparisonLine(
                    name=spec.name,
                    slug=spec.slug,
                    kind=spec.kind,
                    line=float(baseline_line),
                    over=-110,
                    under=-110,
                    is_mock=True,
                    connected=False,
                    requires_integration=True,
                    provider="unavailable",
                    source_provider=None,
                    notes=spec.notes or "Unavailable from configured line providers — not fabricated.",
                    captured_at=None,
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
            if row.requires_integration:
                continue  # do not persist fabricated placeholders
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
                        captured_at=row.captured_at or now,
                        is_mock=row.is_mock,
                        source_provider=row.source_provider,
                    )
                )
        return quotes


MockComparisonLinesProvider = CatalogComparisonLinesProvider


def get_comparison_lines_provider() -> ComparisonLinesProvider:
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
