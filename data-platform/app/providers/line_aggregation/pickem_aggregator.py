"""Pick'em line aggregator — PropLine first, short-circuit fallthrough.

Unlike the sportsbook comparison aggregator (which merges all books), pick'em
boards must use **only** PrizePicks / Underdog / Sleeper quotes. We try
providers in priority order and **stop on the first non-empty** platform-
filtered batch so we do not burn every API quota on every refresh.

Never invents lines. Never substitutes sportsbook odds for pick'em lines.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Protocol, Sequence

from app.providers.base import NormalizedOddsQuote, ProviderRateLimitError
from app.providers.propline import rate_limit as propline_rate_limit
from app.providers.propline.markets import PICKEM_SLUGS

log = logging.getLogger(__name__)

# Providers that can supply DFS / pick'em books (when configured + capable).
DEFAULT_PICKEM_PRIORITY = ("propline", "sharpapi", "the-odds-api", "antelytics")

# In-process cooldown after a provider 429 / hard failure (per source).
_provider_cooldown_until: dict[str, datetime] = {}
_PROVIDER_COOLDOWN = timedelta(minutes=30)


class PickemCapable(Protocol):
    source_id: str

    def is_configured(self) -> bool: ...

    def fetch_pickem_prop_odds(
        self,
        league: str,
        *,
        platforms: set[str],
        date: Optional[str] = None,
        max_events: Optional[int] = None,
        horizon_hours: int = 48,
    ) -> list[NormalizedOddsQuote]: ...


@dataclass
class PickemAttempt:
    source: str
    status: str  # ok | skipped | cooldown | rate_limited | empty | error
    quotes: int = 0
    detail: Optional[str] = None


@dataclass
class PickemFetchResult:
    league: str
    platform: str
    quotes: list[NormalizedOddsQuote] = field(default_factory=list)
    source: Optional[str] = None
    attempts: list[PickemAttempt] = field(default_factory=list)

    def to_meta(self) -> dict[str, Any]:
        return {
            "pickemSource": self.source,
            "pickemAttempts": [
                {
                    "source": a.source,
                    "status": a.status,
                    "quotes": a.quotes,
                    "detail": a.detail,
                }
                for a in self.attempts
            ],
        }


def _on_cooldown(source_id: str) -> bool:
    until = _provider_cooldown_until.get(source_id)
    if until is None:
        return False
    if datetime.now(timezone.utc) >= until:
        _provider_cooldown_until.pop(source_id, None)
        return False
    return True


def trip_provider_cooldown(source_id: str, *, minutes: int = 30) -> None:
    _provider_cooldown_until[source_id] = datetime.now(timezone.utc) + timedelta(
        minutes=minutes
    )


def filter_pickem_quotes(
    quotes: list[NormalizedOddsQuote],
    platforms: set[str],
) -> list[NormalizedOddsQuote]:
    """Keep only requested pick'em books — never sportsbook substitutes."""
    allowed = {p.lower() for p in platforms} & {s.lower() for s in PICKEM_SLUGS}
    if not allowed:
        return []
    out: list[NormalizedOddsQuote] = []
    for q in quotes:
        slug = (q.sportsbook_slug or "").lower()
        if slug in allowed:
            out.append(q)
    return out


class PickemLineAggregator:
    """Short-circuit pick'em fetch across configured DFS-capable providers."""

    def __init__(self, providers: Sequence[PickemCapable]) -> None:
        self.providers = list(providers)

    def fetch(
        self,
        league: str,
        *,
        platforms: set[str],
        date: Optional[str] = None,
        max_events: Optional[int] = None,
        horizon_hours: int = 48,
    ) -> PickemFetchResult:
        platform_label = next(iter(platforms), "pickem")
        result = PickemFetchResult(league=league, platform=platform_label)
        platforms_l = {p.lower() for p in platforms}

        for provider in self.providers:
            sid = provider.source_id
            if not provider.is_configured():
                result.attempts.append(
                    PickemAttempt(sid, "skipped", detail="API key not configured")
                )
                continue
            if sid == "propline" and propline_rate_limit.is_blocked():
                until = propline_rate_limit.blocked_until()
                result.attempts.append(
                    PickemAttempt(
                        sid,
                        "cooldown",
                        detail=f"PropLine daily limit until {until.isoformat() if until else 'reset'}",
                    )
                )
                continue
            if _on_cooldown(sid):
                result.attempts.append(
                    PickemAttempt(sid, "cooldown", detail="provider cooling down after 429")
                )
                continue
            try:
                quotes = provider.fetch_pickem_prop_odds(
                    league,
                    platforms=platforms_l,
                    date=date,
                    max_events=max_events,
                    horizon_hours=horizon_hours,
                )
                filtered = filter_pickem_quotes(quotes, platforms_l)
                if not filtered:
                    result.attempts.append(
                        PickemAttempt(
                            sid,
                            "empty",
                            detail="No pick'em quotes for requested platform",
                        )
                    )
                    continue
                for q in filtered:
                    if not q.source_provider:
                        q.source_provider = sid
                result.quotes = filtered
                result.source = sid
                result.attempts.append(
                    PickemAttempt(sid, "ok", quotes=len(filtered))
                )
                # Short-circuit — do not burn the next provider's quota
                return result
            except ProviderRateLimitError as exc:
                log.warning("pickem aggregator: %s rate limited — %s", sid, exc)
                if sid == "propline":
                    # PropLine adapter / _get already trips daily circuit when applicable
                    pass
                else:
                    trip_provider_cooldown(sid)
                result.attempts.append(
                    PickemAttempt(sid, "rate_limited", detail=str(exc))
                )
                continue
            except Exception as exc:  # noqa: BLE001
                log.warning("pickem aggregator: %s error: %s", sid, exc)
                result.attempts.append(PickemAttempt(sid, "error", detail=str(exc)))
                continue

        return result

    def status(self) -> dict[str, Any]:
        rows = []
        for p in self.providers:
            cool = _provider_cooldown_until.get(p.source_id)
            rows.append(
                {
                    "source": p.source_id,
                    "configured": p.is_configured(),
                    "cooldownUntil": cool.isoformat() if cool and _on_cooldown(p.source_id) else None,
                }
            )
        return {
            "provider": "pickem-aggregator",
            "priority": [p.source_id for p in self.providers],
            "adapters": rows,
            "proplineCircuit": propline_rate_limit.status(),
        }
