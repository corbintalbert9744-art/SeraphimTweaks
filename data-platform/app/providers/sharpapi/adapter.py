"""SharpAPI adapter — https://docs.sharpapi.io/

Auth: SHARPAPI_API_KEY via X-API-Key / Bearer / api_key.
Base: https://api.sharpapi.io/api/v1

Fetches player_prop market rows from GET /odds?league=…&market=player_prop.
Unsupported / unconfigured → clear unavailable (never fabricated).
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

BASE_URL = "https://api.sharpapi.io/api/v1"

# Seraphim league → SharpAPI league query param
LEAGUE_PARAMS: dict[str, str] = {
    "NBA": "nba",
    "WNBA": "wnba",
    "NFL": "nfl",
    "MLB": "mlb",
    "NHL": "nhl",
    "Soccer": "epl",
    "ATP": "atp",
    "WTA": "wta",
}

BOOK_TITLES = {
    "draftkings": "DraftKings",
    "fanduel": "FanDuel",
    "betmgm": "BetMGM",
    "pinnacle": "Pinnacle",
    "caesars": "Caesars",
    "betrivers": "BetRivers",
    "bovada": "Bovada",
    "prizepicks": "PrizePicks",
    "underdog": "Underdog",
}


def _norm_league(league: str) -> str:
    if (league or "").upper() == "SOCCER":
        return "Soccer"
    return (league or "").upper()


class SharpApiAdapter:
    """SharpAPI LineMarketProvider — real-time odds aggregation."""

    meta = ProviderMeta(
        name="sharpapi",
        leagues=list(LEAGUE_PARAMS.keys()),
        capabilities=["odds", "props"],
        requires_api_key=True,
        is_mock=False,
        notes=(
            "SharpAPI (https://docs.sharpapi.io/) — multi-book odds + player props when "
            "SHARPAPI_API_KEY is set. Used as fallback / complement to PropLine."
        ),
        homepage="https://sharpapi.io/",
    )

    def __init__(self, api_key: str, *, timeout: float = 30.0, page_limit: int = 200) -> None:
        self.api_key = (api_key or "").strip()
        self.timeout = timeout
        self.page_limit = page_limit

    @property
    def source_id(self) -> str:
        return "sharpapi"

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def supports_league(self, league: str) -> LeagueSupportStatus:
        code = _norm_league(league)
        if code not in LEAGUE_PARAMS:
            return LeagueSupportStatus(
                code, False, reason=f"No SharpAPI league mapping for {code}", unavailable=True
            )
        if not self.api_key:
            return LeagueSupportStatus(code, False, reason="SHARPAPI_API_KEY not configured")
        return LeagueSupportStatus(code, True)

    def _get(self, path: str, params: Optional[dict[str, Any]] = None) -> Any:
        headers = {
            "Accept": "application/json",
            "X-API-Key": self.api_key,
            "User-Agent": "SeraphimAnalytics/1.0 (+SharpApiAdapter)",
        }
        with httpx.Client(timeout=self.timeout) as client:
            res = client.get(f"{BASE_URL}{path}", params=params or {}, headers=headers)
            if res.status_code == 429:
                raise ProviderRateLimitError("sharpapi", "HTTP 429")
            if res.status_code in {401, 403}:
                raise RuntimeError("SharpAPI API key invalid or unauthorized")
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
        league_param = LEAGUE_PARAMS[code]
        # Prefer player_prop filter; if API returns empty, we do not fabricate.
        try:
            payload = self._get(
                "/odds",
                {
                    "league": league_param,
                    "market": "player_prop",
                    "limit": self.page_limit,
                },
            )
        except ProviderRateLimitError:
            raise
        except Exception as exc:  # noqa: BLE001
            log.warning("SharpAPI odds fetch failed for %s: %s", code, exc)
            return []

        rows = payload.get("data") if isinstance(payload, dict) else payload
        if not isinstance(rows, list):
            return []

        out: list[NormalizedOddsQuote] = []
        now = datetime.now(timezone.utc)
        for row in rows:
            if not isinstance(row, dict):
                continue
            market_type = str(row.get("market_type") or row.get("market") or "").lower()
            if market_type and "prop" not in market_type and market_type not in {
                "player_prop",
                "player_points",
                "player_rebounds",
                "player_assists",
            }:
                # Skip pure game lines when filter was ignored
                if market_type in {"moneyline", "spread", "total", "h2h", "spreads", "totals"}:
                    continue
            selection = str(row.get("selection") or "")
            sel_type = str(row.get("selection_type") or "").lower()
            side = "Over" if sel_type == "over" or "over" in selection.lower() else None
            if side is None:
                side = "Under" if sel_type == "under" or "under" in selection.lower() else None
            if side is None:
                continue
            point = row.get("line")
            if point is None:
                continue
            # Player name: often in selection ("LeBron James Over") or player field
            player = (
                row.get("player_name")
                or row.get("player")
                or _player_from_selection(selection, side)
            )
            if not player:
                continue
            slug = str(row.get("sportsbook") or "book").lower()
            american = row.get("odds_american")
            if american is None and isinstance(row.get("odds"), dict):
                american = row["odds"].get("american")
            if american is None:
                continue
            market_label = _market_label(row)
            captured = _parse_ts(row.get("timestamp")) or now
            out.append(
                NormalizedOddsQuote(
                    league=code,
                    player_external_id=None,
                    player_name=str(player).strip(),
                    market=market_label,
                    side=side,
                    line=float(point),
                    american_odds=int(american),
                    sportsbook_slug=slug,
                    sportsbook_name=BOOK_TITLES.get(slug, slug.title()),
                    game_external_id=str(row.get("event_id") or "") or None,
                    captured_at=captured,
                    is_mock=False,
                    source_provider="sharpapi",
                )
            )
        return out


def _player_from_selection(selection: str, side: str) -> str:
    s = selection
    for token in (f" {side}", f" {side.lower()}", f" {side.upper()}"):
        if token in s:
            s = s.replace(token, "")
    return s.strip(" -–|")


def _market_label(row: dict[str, Any]) -> str:
    raw = str(row.get("market_name") or row.get("market_type") or "Prop")
    mapping = {
        "player_points": "Points",
        "player_rebounds": "Rebounds",
        "player_assists": "Assists",
        "player_prop": "Prop",
        "points": "Points",
        "rebounds": "Rebounds",
        "assists": "Assists",
    }
    key = raw.lower().replace(" ", "_")
    return mapping.get(key, raw.replace("_", " ").title())


def _parse_ts(raw: Any) -> Optional[datetime]:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None
