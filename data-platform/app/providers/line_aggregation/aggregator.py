"""Multi-provider line aggregation — priority query, merge, fallback.

Providers (PropLine, SharpAPI, Antelytics, The Odds API) implement
``LineMarketProvider``. The aggregator:

1. Queries configured providers in priority order
2. Skips unsupported leagues / unconfigured keys
3. Falls through on rate limits
4. Merges duplicate (book, player, market, side) lines — higher priority wins
5. Tags every quote with ``source_provider`` for UI attribution

Frontend never talks to a vendor — only to warehouse comparison rows.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Optional, Sequence

from app.providers.base import (
    LeagueSupportStatus,
    LineMarketProvider,
    NormalizedOddsQuote,
    ProviderMeta,
    ProviderRateLimitError,
)

log = logging.getLogger(__name__)

DEFAULT_PRIORITY = ("propline", "sharpapi", "the-odds-api", "antelytics")


def merge_quotes(
    batches: Sequence[tuple[str, list[NormalizedOddsQuote]]],
) -> list[NormalizedOddsQuote]:
    """Merge provider batches. First provider in ``batches`` wins on duplicates.

    Dedupe key: (sportsbook_slug, player_name_lower, market_lower, side).
    Lines that differ on the same key keep the higher-priority provider's quote
    (first in batches). Alternate lines from lower priority are dropped for that key.
    """
    seen: dict[tuple[str, str, str, str], NormalizedOddsQuote] = {}
    order: list[tuple[str, str, str, str]] = []
    for source_id, quotes in batches:
        for q in quotes:
            if not q.source_provider:
                q.source_provider = source_id
            key = (
                (q.sportsbook_slug or "").lower(),
                (q.player_name or "").lower().strip(),
                (q.market or "").lower().strip(),
                (q.side or "").lower(),
            )
            if key in seen:
                continue
            seen[key] = q
            order.append(key)
    return [seen[k] for k in order]


@dataclass
class ProviderAttempt:
    source: str
    status: str  # ok | skipped | unsupported | rate_limited | error
    quotes: int = 0
    detail: Optional[str] = None


@dataclass
class AggregationResult:
    league: str
    quotes: list[NormalizedOddsQuote] = field(default_factory=list)
    attempts: list[ProviderAttempt] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "league": self.league,
            "quotes": len(self.quotes),
            "sources": sorted({q.source_provider or "?" for q in self.quotes}),
            "attempts": [
                {"source": a.source, "status": a.status, "quotes": a.quotes, "detail": a.detail}
                for a in self.attempts
            ],
        }


class MultiProviderAggregator:
    """Query line providers in priority order and merge results."""

    meta = ProviderMeta(
        name="line-aggregator",
        leagues=["NBA", "WNBA", "NFL", "MLB", "NHL", "Soccer", "ATP", "WTA"],
        capabilities=["odds", "props", "pickem"],
        requires_api_key=False,
        is_mock=False,
        notes=(
            "Aggregates PropLine, SharpAPI, The Odds API, and Antelytics. "
            "Priority + fallback on rate limits / unsupported sports. "
            "New adapters register without frontend changes."
        ),
    )

    def __init__(self, providers: Sequence[LineMarketProvider]) -> None:
        self.providers = list(providers)

    def fetch_player_prop_odds(
        self, league: str, date: Optional[str] = None
    ) -> list[NormalizedOddsQuote]:
        return self.aggregate(league, date=date).quotes

    def aggregate(self, league: str, date: Optional[str] = None) -> AggregationResult:
        result = AggregationResult(league=league)
        batches: list[tuple[str, list[NormalizedOddsQuote]]] = []

        for provider in self.providers:
            sid = provider.source_id
            if not provider.is_configured():
                result.attempts.append(
                    ProviderAttempt(sid, "skipped", detail="API key not configured")
                )
                continue
            support = provider.supports_league(league)
            if not support.supported:
                result.attempts.append(
                    ProviderAttempt(
                        sid,
                        "unsupported",
                        detail=support.reason or "League not supported",
                    )
                )
                continue
            try:
                quotes = provider.fetch_player_prop_odds(league, date=date)
                for q in quotes:
                    if not q.source_provider:
                        q.source_provider = sid
                batches.append((sid, quotes))
                result.attempts.append(ProviderAttempt(sid, "ok", quotes=len(quotes)))
            except ProviderRateLimitError as exc:
                log.warning("aggregator: %s rate limited — falling through", sid)
                result.attempts.append(
                    ProviderAttempt(sid, "rate_limited", detail=str(exc))
                )
                continue
            except Exception as exc:  # noqa: BLE001
                log.warning("aggregator: %s error: %s", sid, exc)
                result.attempts.append(ProviderAttempt(sid, "error", detail=str(exc)))
                continue

        result.quotes = merge_quotes(batches)
        return result

    def status(self) -> dict[str, Any]:
        rows = []
        for p in self.providers:
            rows.append(
                {
                    "source": p.source_id,
                    "name": p.meta.name,
                    "configured": p.is_configured(),
                    "requiresApiKey": p.meta.requires_api_key,
                    "notes": p.meta.notes,
                    "homepage": p.meta.homepage,
                    "leagues": p.meta.leagues,
                }
            )
        return {"provider": "line-aggregator", "adapters": rows}
