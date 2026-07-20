"""Antelytics (antelytics.dev) LineMarketProvider.

Official API: ``https://backend.antehq.com/v1``
Auth: ``Authorization: Bearer ant_live_…``

Primary endpoint for DFS books: ``GET /v1/props?sport=nba``.
Never fabricates lines — empty / tier-gated responses stay empty.
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
from app.providers.propline.markets import market_label

log = logging.getLogger(__name__)

DEFAULT_BASE = "https://backend.antehq.com/v1"

# Seraphim league → Antelytics sport query key
SPORT_KEYS: dict[str, str] = {
    "NBA": "nba",
    "WNBA": "wnba",
    "NFL": "nfl",
    "MLB": "mlb",
    "NHL": "nhl",
    "Soccer": "epl",
    "ATP": "atp",
    "WTA": "wta",
}

# Free tier is NBA-only; higher tiers unlock more sports.
FREE_TIER_SPORTS = frozenset({"nba"})

STAT_LABELS: dict[str, str] = {
    "points": "Points",
    "rebounds": "Rebounds",
    "assists": "Assists",
    "threes": "Threes",
    "three_pointers": "Threes",
    "steals": "Steals",
    "blocks": "Blocks",
    "turnovers": "Turnovers",
    "points_rebounds": "Pts+Rebs",
    "points_assists": "Pts+Asts",
    "rebounds_assists": "Rebs+Asts",
    "points_rebounds_assists": "PRA",
    "steals_blocks": "Steals+Blocks",
    "fantasy_score": "Fantasy Score",
    "fantasy_points": "Fantasy Score",
}


def _norm_league(league: str) -> str:
    if (league or "").upper() == "SOCCER":
        return "Soccer"
    return (league or "").upper()


def _parse_ts(raw: Any) -> datetime:
    if isinstance(raw, str) and raw:
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            pass
    return datetime.now(timezone.utc)


class AntelyticsAdapter:
    """Antelytics DFS props adapter (PrizePicks / Underdog / Sleeper / …)."""

    meta = ProviderMeta(
        name="antelytics",
        leagues=list(SPORT_KEYS.keys()),
        capabilities=["odds", "props", "pickem"],
        requires_api_key=True,
        is_mock=False,
        notes=(
            "Antelytics (https://antelytics.dev) DFS props via backend.antehq.com. "
            "Set ANTELYTICS_API_KEY. Free tier is NBA-only; higher tiers unlock more sports. "
            "Unavailable / empty responses are never fabricated."
        ),
        homepage="https://antelytics.dev",
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
        sport = SPORT_KEYS.get(code)
        if not sport:
            return LeagueSupportStatus(code, False, reason="League not mapped", unavailable=True)
        if not self.api_key:
            return LeagueSupportStatus(
                code,
                False,
                reason="ANTELYTICS_API_KEY not configured — Antelytics lines unavailable.",
                unavailable=True,
            )
        return LeagueSupportStatus(code, True)

    def _get(self, path: str, params: Optional[dict[str, Any]] = None) -> Any:
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "User-Agent": "SeraphimAnalytics/1.0 (+AntelyticsAdapter)",
        }
        with httpx.Client(timeout=self.timeout) as client:
            res = client.get(f"{self.base_url}{path}", params=params or {}, headers=headers)
            if res.status_code == 429:
                raise ProviderRateLimitError("antelytics", "HTTP 429")
            if res.status_code in {401, 403}:
                # Tier gates / bad key — treat as unavailable for this call
                try:
                    body = res.json()
                except Exception:  # noqa: BLE001
                    body = {}
                msg = str((body or {}).get("message") or res.text or f"HTTP {res.status_code}")
                if res.status_code == 403 and "tier" in msg.lower():
                    log.info("Antelytics tier gate: %s", msg)
                    return None
                raise RuntimeError(f"Antelytics unauthorized: {msg}")
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
        sport = SPORT_KEYS[code]
        try:
            payload = self._get(
                "/props",
                {"sport": sport, "limit": "500", "offset": "0"},
            )
        except ProviderRateLimitError:
            raise
        except Exception as exc:  # noqa: BLE001
            log.warning("Antelytics %s /props failed: %s", code, exc)
            return []
        parsed = self._parse_props_payload(code, payload)
        if not parsed:
            log.info(
                "Antelytics returned no player props for %s — treating as unavailable (not fabricated).",
                code,
            )
        return parsed

    def fetch_pickem_prop_odds(
        self,
        league: str,
        *,
        platforms: Optional[set[str]] = None,
        date: Optional[str] = None,
        max_events: Optional[int] = None,
        horizon_hours: int = 48,
    ) -> list[NormalizedOddsQuote]:
        """DFS-only fetch; optional platform filter (prizepicks / underdog / sleeper)."""
        _ = (max_events, horizon_hours, date)
        support = self.supports_league(league)
        if not support.supported:
            return []
        code = _norm_league(league)
        sport = SPORT_KEYS[code]
        allowed = {p.lower() for p in platforms} if platforms else None
        out: list[NormalizedOddsQuote] = []
        # Prefer per-platform pages when filtering — keeps responses smaller.
        platform_iter: list[Optional[str]] = sorted(allowed) if allowed else [None]
        for platform in platform_iter:
            params: dict[str, Any] = {"sport": sport, "limit": "500", "offset": "0"}
            if platform:
                params["platform"] = platform
            try:
                payload = self._get("/props", params)
            except ProviderRateLimitError:
                raise
            except Exception as exc:  # noqa: BLE001
                log.debug("Antelytics pickem %s/%s: %s", code, platform, exc)
                continue
            batch = self._parse_props_payload(code, payload)
            if allowed:
                batch = [q for q in batch if q.sportsbook_slug in allowed]
            out.extend(batch)
        return out

    def _stat_to_market(self, stat_type: str, stat_label: str) -> str:
        key = (stat_type or "").strip().lower()
        if key in STAT_LABELS:
            return STAT_LABELS[key]
        if stat_label:
            return str(stat_label)
        return market_label(f"player_{key}" if key else "Prop")

    def _parse_props_payload(self, league: str, payload: Any) -> list[NormalizedOddsQuote]:
        if not isinstance(payload, dict):
            return []
        rows = payload.get("props") or payload.get("data") or []
        if not isinstance(rows, list):
            return []

        out: list[NormalizedOddsQuote] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            player_obj = row.get("player") if isinstance(row.get("player"), dict) else {}
            market_obj = row.get("market") if isinstance(row.get("market"), dict) else {}
            player = player_obj.get("name") or row.get("player_name")
            if not player:
                continue
            line = market_obj.get("line")
            if line is None:
                line = row.get("line")
            if line is None:
                continue
            direction = str(market_obj.get("direction") or row.get("direction") or "over").lower()
            side = "Over" if direction.startswith("over") else "Under" if direction.startswith("under") else None
            if side is None:
                continue
            platform = str(
                market_obj.get("platform") or row.get("platform") or "prizepicks"
            ).lower()
            market = self._stat_to_market(
                str(market_obj.get("stat_type") or ""),
                str(market_obj.get("stat_label") or ""),
            )
            # DFS pick'em is even-money synthetic pricing.
            american = 100
            captured = _parse_ts(row.get("updated_at") or row.get("start_time"))
            # Emit both sides at the same line so comparison UI can attach Over/Under.
            for emit_side in (side, "Under" if side == "Over" else "Over"):
                out.append(
                    NormalizedOddsQuote(
                        league=league,
                        player_external_id=str(player_obj.get("id") or "") or None,
                        player_name=str(player),
                        market=market,
                        side=emit_side,
                        line=float(line),
                        american_odds=american,
                        sportsbook_slug=platform,
                        sportsbook_name=platform.replace("_", " ").title(),
                        game_external_id=str(row.get("game_id") or "") or None,
                        captured_at=captured,
                        is_mock=False,
                        source_provider="antelytics",
                        quote_external_id=str(row.get("prop_id") or "") or None,
                        home_team=None,
                        away_team=None,
                        sport_key=str(row.get("sport") or SPORT_KEYS.get(league)),
                        raw={"direction": direction, "platform": platform},
                    )
                )
        return out
