"""Antelytics adapter stub — LineMarketProvider.

No public sports-odds OpenAPI was found for Antelytics at integration time.
This adapter:

- Requires ANTELYTICS_API_KEY (+ optional ANTELYTICS_BASE_URL)
- Attempts a configurable REST odds path when keyed
- Returns clear *unavailable* when not configured or the upstream shape is empty
- Never fabricates lines

When Antelytics publishes official prop docs, map their payload in
``_parse_payload`` without changing the aggregator or frontend.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from app.providers.base import (
    LeagueSupportStatus,
    NormalizedOddsQuote,
    ProviderMeta,
    ProviderRateLimitError,
)

log = logging.getLogger(__name__)

DEFAULT_BASE = "https://api.antelytics.com/v1"

LEAGUES = ("NBA", "WNBA", "NFL", "MLB", "NHL", "Soccer", "ATP", "WTA")


def _norm_league(league: str) -> str:
    if (league or "").upper() == "SOCCER":
        return "Soccer"
    return (league or "").upper()


class AntelyticsAdapter:
    """Configurable Antelytics LineMarketProvider (stub until official docs land)."""

    meta = ProviderMeta(
        name="antelytics",
        leagues=list(LEAGUES),
        capabilities=["odds", "props"],
        requires_api_key=True,
        is_mock=False,
        notes=(
            "Antelytics adapter scaffold. Set ANTELYTICS_API_KEY and optional "
            "ANTELYTICS_BASE_URL. Until the official player-prop schema is confirmed, "
            "unsupported responses are marked unavailable — never fabricated."
        ),
        homepage=None,
    )

    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = DEFAULT_BASE,
        timeout: float = 30.0,
    ) -> None:
        self.api_key = (api_key or "").strip()
        self.base_url = (base_url or DEFAULT_BASE).rstrip("/")
        self.timeout = timeout

    @property
    def source_id(self) -> str:
        return "antelytics"

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def supports_league(self, league: str) -> LeagueSupportStatus:
        code = _norm_league(league)
        if code not in LEAGUES:
            return LeagueSupportStatus(code, False, reason="League not mapped", unavailable=True)
        if not self.api_key:
            return LeagueSupportStatus(
                code,
                False,
                reason="ANTELYTICS_API_KEY not configured — Antelytics lines unavailable.",
                unavailable=True,
            )
        # Optimistic: try fetch; empty results stay empty without fabricating.
        return LeagueSupportStatus(code, True)

    def _get(self, path: str, params: Optional[dict[str, Any]] = None) -> Any:
        headers = {
            "Accept": "application/json",
            "X-API-Key": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
            "User-Agent": "SeraphimAnalytics/1.0 (+AntelyticsAdapter)",
        }
        with httpx.Client(timeout=self.timeout) as client:
            res = client.get(f"{self.base_url}{path}", params=params or {}, headers=headers)
            if res.status_code == 429:
                raise ProviderRateLimitError("antelytics", "HTTP 429")
            if res.status_code in {401, 403}:
                raise RuntimeError("Antelytics API key invalid or unauthorized")
            if res.status_code == 404:
                return None
            res.raise_for_status()
            return res.json()

    def fetch_player_prop_odds(
        self, league: str, date: Optional[str] = None
    ) -> list[NormalizedOddsQuote]:
        _ = date
        support = self.supports_league(league)
        if not support.supported:
            return []
        code = _norm_league(league)
        # Common REST shapes to try — first non-empty parse wins.
        candidates = (
            (f"/leagues/{code.lower()}/props", {}),
            (f"/odds", {"league": code.lower(), "market": "player_prop"}),
            (f"/player-props", {"league": code.lower()}),
        )
        for path, params in candidates:
            try:
                payload = self._get(path, params)
            except ProviderRateLimitError:
                raise
            except Exception as exc:  # noqa: BLE001
                log.debug("Antelytics %s %s: %s", code, path, exc)
                continue
            parsed = self._parse_payload(code, payload)
            if parsed:
                return parsed
        log.info(
            "Antelytics returned no player props for %s — treating as unavailable (not fabricated).",
            code,
        )
        return []

    def _parse_payload(self, league: str, payload: Any) -> list[NormalizedOddsQuote]:
        if payload is None:
            return []
        rows: list[Any]
        if isinstance(payload, list):
            rows = payload
        elif isinstance(payload, dict):
            rows = payload.get("data") or payload.get("props") or payload.get("odds") or []
        else:
            return []
        if not isinstance(rows, list):
            return []

        out: list[NormalizedOddsQuote] = []
        now = datetime.now(timezone.utc)
        for row in rows:
            if not isinstance(row, dict):
                continue
            player = row.get("player_name") or row.get("player") or row.get("description")
            market = row.get("market") or row.get("market_name") or row.get("stat")
            side_raw = str(row.get("side") or row.get("selection") or row.get("name") or "")
            side = "Over" if "over" in side_raw.lower() else "Under" if "under" in side_raw.lower() else None
            point = row.get("line") or row.get("point")
            price = row.get("american_odds") or row.get("price") or row.get("odds")
            slug = str(row.get("sportsbook") or row.get("book") or row.get("bookmaker") or "").lower()
            if not player or not market or side is None or point is None or price is None or not slug:
                continue
            out.append(
                NormalizedOddsQuote(
                    league=league,
                    player_external_id=None,
                    player_name=str(player),
                    market=str(market),
                    side=side,
                    line=float(point),
                    american_odds=int(price),
                    sportsbook_slug=slug,
                    sportsbook_name=str(row.get("sportsbook_name") or row.get("book_title") or slug.title()),
                    game_external_id=str(row.get("game_id") or row.get("event_id") or "") or None,
                    captured_at=now,
                    is_mock=False,
                    source_provider="antelytics",
                )
            )
        return out
