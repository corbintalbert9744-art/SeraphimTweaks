"""PropLineAdapter — primary market-line provider (official PropLine API).

Docs: https://prop-line.com/docs
Auth: PROPLINE_API_KEY via X-API-Key header or apiKey query param.
Base: https://api.prop-line.com/v1

Implements OddsProvider so it can replace / sit alongside The Odds API.
Never fabricates lines — unsupported sports/markets return empty + status.
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
from app.providers.propline.markets import (
    PICKEM_SLUGS,
    PROPLINE_BOOKMAKERS,
    SOCCER_EXTRA_SPORTS,
    market_label,
    normalize_league,
    prop_markets_for_league,
    sport_key_for_league,
)

log = logging.getLogger(__name__)

BASE_URL = "https://api.prop-line.com/v1"


class PropLineAdapter:
    """Official PropLine odds adapter — implements LineMarketProvider."""

    meta = ProviderMeta(
        name="propline",
        leagues=["NBA", "WNBA", "NFL", "MLB", "NHL", "Soccer", "ATP", "WTA"],
        capabilities=["odds", "props", "pickem"],
        requires_api_key=True,
        is_mock=False,
        notes=(
            "Primary market-line provider. Live multi-book player props when "
            "PROPLINE_API_KEY is set. PrizePicks, Underdog, FanDuel, DraftKings, "
            "BetMGM, Bovada, Pinnacle, and more in one response. "
            "Unsupported sports/markets are reported as unavailable — never fabricated. "
            "Docs: https://prop-line.com/docs"
        ),
        homepage="https://prop-line.com/",
    )

    def __init__(self, api_key: str, *, max_events: int = 8, timeout: float = 30.0) -> None:
        self.api_key = (api_key or "").strip()
        self.max_events = max_events
        self.timeout = timeout
        self._sports_cache: Optional[list[dict[str, Any]]] = None

    @property
    def source_id(self) -> str:
        return "propline"

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def supports_league(self, league: str) -> LeagueSupportStatus:
        info = self.league_support(league)
        return LeagueSupportStatus(
            league=info["league"],
            supported=bool(info.get("supported")),
            reason=info.get("reason"),
            unavailable=bool(info.get("unavailable")),
        )

    # ------------------------------------------------------------------
    # HTTP
    # ------------------------------------------------------------------

    def _headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "X-API-Key": self.api_key,
            "User-Agent": "SeraphimAnalytics/1.0 (+PropLineAdapter)",
        }

    def _get(self, path: str, params: Optional[dict[str, Any]] = None) -> Any:
        if not self.api_key:
            raise RuntimeError("PROPLINE_API_KEY not configured")
        url = f"{BASE_URL}{path}"
        with httpx.Client(timeout=self.timeout) as client:
            res = client.get(url, params=params or {}, headers=self._headers())
            if res.status_code == 401:
                raise RuntimeError("PropLine API key invalid or missing")
            if res.status_code == 404:
                return None
            if res.status_code == 429:
                raise ProviderRateLimitError("propline", "HTTP 429")
            res.raise_for_status()
            return res.json()

    # ------------------------------------------------------------------
    # Support discovery
    # ------------------------------------------------------------------

    def list_sports(self) -> list[dict[str, Any]]:
        if self._sports_cache is not None:
            return self._sports_cache
        data = self._get("/sports")
        rows = data if isinstance(data, list) else []
        self._sports_cache = rows
        return rows

    def sport_is_active(self, sport_key: str) -> bool:
        for row in self.list_sports():
            if row.get("key") == sport_key and row.get("active"):
                return True
        return False

    def league_support(self, league: str) -> dict[str, Any]:
        """Explain whether PropLine can supply player props for this league."""
        code = normalize_league(league)
        sport = sport_key_for_league(code)
        markets = prop_markets_for_league(code)
        if not sport:
            return {
                "league": code,
                "supported": False,
                "reason": "No PropLine sport key mapped for this league.",
                "sportKey": None,
                "markets": [],
            }
        if not markets:
            return {
                "league": code,
                "supported": False,
                "reason": (
                    f"PropLine does not publish player-prop markets for {code} yet "
                    f"(sport key `{sport}` may still carry game lines). "
                    "We do not fabricate prop lines."
                ),
                "sportKey": sport,
                "markets": [],
                "unavailable": True,
            }
        try:
            active = self.sport_is_active(sport) if self.api_key else None
        except Exception as exc:  # noqa: BLE001
            return {
                "league": code,
                "supported": False,
                "reason": f"PropLine sports lookup failed: {exc}",
                "sportKey": sport,
                "markets": list(markets),
            }
        if active is False:
            return {
                "league": code,
                "supported": False,
                "reason": f"PropLine sport `{sport}` is inactive or not listed. Data unavailable.",
                "sportKey": sport,
                "markets": list(markets),
                "unavailable": True,
            }
        return {
            "league": code,
            "supported": True,
            "reason": None,
            "sportKey": sport,
            "markets": list(markets),
            "active": active,
        }

    # ------------------------------------------------------------------
    # OddsProvider
    # ------------------------------------------------------------------

    def fetch_player_prop_odds(
        self, league: str, date: Optional[str] = None
    ) -> list[NormalizedOddsQuote]:
        """Fetch multi-book player props for a Seraphim league."""
        return self.fetch_pickem_prop_odds(league, platforms=None, date=date)

    def fetch_pickem_prop_odds(
        self,
        league: str,
        *,
        platforms: Optional[set[str]] = None,
        date: Optional[str] = None,
        max_events: Optional[int] = None,
    ) -> list[NormalizedOddsQuote]:
        """Fetch live player props, optionally restricted to pick'em bookmaker keys.

        ``platforms`` e.g. ``{"prizepicks"}`` — only those bookmakers are kept.
        Sportsbook odds are never returned when platforms is a pick'em set.
        Never fabricates lines.
        """
        _ = date
        if not self.api_key:
            return []
        code = normalize_league(league)
        support = self.league_support(code)
        if not support.get("supported"):
            log.info("PropLine skip %s: %s", code, support.get("reason"))
            return []

        sport = support["sportKey"]
        markets = support["markets"]
        sport_keys = [sport]
        if code == "Soccer":
            sport_keys.extend(SOCCER_EXTRA_SPORTS)

        allowed = {p.lower() for p in platforms} if platforms else None
        limit = max_events if max_events is not None else self.max_events
        out: list[NormalizedOddsQuote] = []
        for sk in sport_keys:
            try:
                if not self.sport_is_active(sk):
                    continue
                out.extend(
                    self._fetch_sport_props(
                        code, sk, markets, bookmakers=allowed, max_events=limit
                    )
                )
            except Exception as exc:  # noqa: BLE001
                log.warning("PropLine %s/%s failed: %s", code, sk, exc)
        return out

    def _fetch_sport_props(
        self,
        league: str,
        sport_key: str,
        markets: list[str],
        *,
        bookmakers: Optional[set[str]] = None,
        max_events: Optional[int] = None,
    ) -> list[NormalizedOddsQuote]:
        events = self._get(f"/sports/{sport_key}/events")
        if not events or not isinstance(events, list):
            return []
        out: list[NormalizedOddsQuote] = []
        markets_param = ",".join(markets)
        limit = max_events if max_events is not None else self.max_events
        for event in events[:limit]:
            eid = event.get("id")
            if eid is None:
                continue
            try:
                payload = self._get(
                    f"/sports/{sport_key}/events/{eid}/odds",
                    {"markets": markets_param},
                )
            except Exception as exc:  # noqa: BLE001
                log.debug("PropLine event %s odds: %s", eid, exc)
                continue
            if not payload:
                continue
            # Prefer event-level team names when odds payload omits them
            if isinstance(payload, dict):
                payload.setdefault("home_team", event.get("home_team"))
                payload.setdefault("away_team", event.get("away_team"))
                payload.setdefault("sport_key", sport_key)
            out.extend(
                self._parse_event_odds(
                    league, str(eid), payload, bookmakers=bookmakers, sport_key=sport_key
                )
            )
        return out

    def _parse_event_odds(
        self,
        league: str,
        event_id: str,
        payload: dict[str, Any],
        *,
        bookmakers: Optional[set[str]] = None,
        sport_key: Optional[str] = None,
    ) -> list[NormalizedOddsQuote]:
        now = datetime.now(timezone.utc)
        out: list[NormalizedOddsQuote] = []
        home = payload.get("home_team")
        away = payload.get("away_team")
        sk = sport_key or payload.get("sport_key")
        for book in payload.get("bookmakers") or []:
            slug = str(book.get("key") or "").lower()
            if bookmakers is not None and slug not in bookmakers:
                continue
            title = str(book.get("title") or PROPLINE_BOOKMAKERS.get(slug, {}).get("name") or slug)
            for market in book.get("markets") or []:
                mkey = str(market.get("key") or "")
                # Skip period markets unless full-game (period null)
                if market.get("period"):
                    continue
                label = market_label(mkey)
                last_update = market.get("last_update")
                captured = _parse_ts(last_update) or now
                for outcome in market.get("outcomes") or []:
                    # PrizePicks: prefer standard market line over goblin/demon
                    dfs_type = outcome.get("dfs_odds_type")
                    if slug == "prizepicks" and dfs_type and str(dfs_type).lower() not in {"standard", ""}:
                        continue
                    # Underdog: skip boosted specials for fair comparison
                    if outcome.get("payout_multiplier") not in (None, 1, 1.0):
                        continue
                    point = outcome.get("point")
                    if point is None:
                        continue
                    name = str(outcome.get("name") or "")
                    side = "Over" if "over" in name.lower() else "Under" if "under" in name.lower() else None
                    if side is None:
                        # YES/NO style (anytime goal scorer) — treat YES as Over
                        if name.lower() in {"yes", "to score"}:
                            side = "Over"
                        elif name.lower() in {"no"}:
                            side = "Under"
                        else:
                            continue
                    player = str(outcome.get("description") or "").strip()
                    if not player:
                        continue
                    price = outcome.get("price")
                    american = int(price) if price is not None else (100 if slug in PICKEM_SLUGS else -110)
                    outcome_id = outcome.get("id") or outcome.get("outcome_id") or outcome.get("projection_id")
                    quote_id = (
                        str(outcome_id)
                        if outcome_id is not None
                        else f"{event_id}:{slug}:{mkey}:{player}:{point}:{side}"
                    )
                    out.append(
                        NormalizedOddsQuote(
                            league=league,
                            player_external_id=None,
                            player_name=player,
                            market=label,
                            side=side,
                            line=float(point),
                            american_odds=american,
                            sportsbook_slug=slug,
                            sportsbook_name=title,
                            game_external_id=event_id,
                            captured_at=captured,
                            is_mock=False,
                            source_provider="propline",
                            quote_external_id=quote_id,
                            home_team=str(home) if home else None,
                            away_team=str(away) if away else None,
                            sport_key=str(sk) if sk else None,
                            raw={
                                "dfs_odds_type": dfs_type,
                                "payout_multiplier": outcome.get("payout_multiplier"),
                                "market_key": mkey,
                            },
                        )
                    )
        return out

    def quotes_for_prop(
        self,
        *,
        league: str,
        player_name: str,
        market: str,
        quotes: Optional[list[NormalizedOddsQuote]] = None,
    ) -> list[NormalizedOddsQuote]:
        """Filter a quote batch (or live fetch) to one player + market."""
        batch = quotes if quotes is not None else self.fetch_player_prop_odds(league)
        pname = player_name.lower().strip()
        mlabel = market.strip().lower()
        return [
            q
            for q in batch
            if pname in q.player_name.lower() and q.market.lower() == mlabel
        ]

    def status(self) -> dict[str, Any]:
        configured = bool(self.api_key)
        leagues = {}
        if configured:
            for league in self.meta.leagues:
                try:
                    leagues[league] = self.league_support(league)
                except Exception as exc:  # noqa: BLE001
                    leagues[league] = {"supported": False, "reason": str(exc)}
        return {
            "provider": self.meta.name,
            "configured": configured,
            "requiresApiKey": True,
            "envVar": "PROPLINE_API_KEY",
            "docs": "https://prop-line.com/docs",
            "homepage": self.meta.homepage,
            "leagues": leagues,
            "note": None
            if configured
            else "Set PROPLINE_API_KEY to enable live multi-book market lines. Until then comparison rows stay marked unavailable.",
        }


def _parse_ts(raw: Any) -> Optional[datetime]:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None
