"""ESPN athlete name search (public common search API)."""

from __future__ import annotations

from typing import Optional
from urllib.parse import quote

from app.providers.base import NormalizedPlayer, ProviderHttpClient

ESPN_SEARCH = "https://site.web.api.espn.com/apis/common/v3/search"

# Seraphim league → ESPN search league slug
_LEAGUE_SLUGS = {
    "NBA": "nba",
    "WNBA": "wnba",
    "NFL": "nfl",
}


def search_espn_athlete(
    name: str,
    *,
    league: str,
    http: ProviderHttpClient | None = None,
) -> Optional[NormalizedPlayer]:
    """Resolve a display name to an ESPN athlete id for the given league.

    Never fabricates — returns None when search has no matching player.
    """
    q = (name or "").strip()
    code = (league or "").upper()
    if code == "SOCCER":
        code = "Soccer"
    slug = _LEAGUE_SLUGS.get(code)
    if not q or not slug:
        return None
    client = http or ProviderHttpClient(user_agent="SeraphimAnalytics/1.0")
    url = f"{ESPN_SEARCH}?query={quote(q)}&limit=8&type=player"
    try:
        data = client.get_json(url)
    except Exception:  # noqa: BLE001
        return None
    items = data.get("items") if isinstance(data, dict) else None
    if not isinstance(items, list):
        return None
    target = q.lower()
    best: Optional[dict] = None
    for item in items:
        if not isinstance(item, dict):
            continue
        if str(item.get("type") or "").lower() != "player":
            continue
        item_league = str(item.get("league") or "").lower()
        # Also accept leagueRelationships abbreviation
        rels = item.get("leagueRelationships") or []
        rel_slugs = {
            str((r.get("core") or {}).get("slug") or "").lower()
            for r in rels
            if isinstance(r, dict)
        }
        if item_league != slug and slug not in rel_slugs:
            continue
        display = str(item.get("displayName") or "").strip()
        if not display:
            continue
        if display.lower() == target:
            best = item
            break
        if best is None and (
            target in display.lower() or display.lower() in target
        ):
            best = item
    if not best or not best.get("id"):
        return None
    return NormalizedPlayer(
        external_id=str(best["id"]),
        league=code,
        full_name=str(best.get("displayName") or q),
        short_name=str(best.get("shortName") or best.get("displayName") or q),
        position=None,
        headshot_url=None,
        team_external_id=None,
    )
