"""Provider registry — swap vendors without touching API routes."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.config import get_settings
from app.providers.base import ProviderMeta, capability_matrix
from app.providers.espn.nba import EspnNbaProvider
from app.providers.espn.nfl import EspnNflProvider
from app.providers.espn.wnba import EspnWnbaProvider
from app.providers.mock.odds import MockOddsProvider
from app.providers.the_odds_api.odds import TheOddsApiProvider


@dataclass
class ProviderBundle:
    """Resolved adapters for one league. All slots are optional protocols."""

    schedule: object | None = None
    gamelog: object | None = None
    injuries: object | None = None
    odds: object | None = None
    featured: object | None = None
    roster: object | None = None
    primary: str = ""
    metas: list[ProviderMeta] = field(default_factory=list)


def _odds_provider():
    settings = get_settings()
    if settings.odds_api_key:
        return TheOddsApiProvider(api_key=settings.odds_api_key)
    return MockOddsProvider()


def provider_status() -> list[dict]:
    """Public status for /api/v1/providers — what's live vs needs config."""
    settings = get_settings()
    nba = EspnNbaProvider()
    nfl = EspnNflProvider()
    wnba = EspnWnbaProvider()
    odds_live = bool(settings.odds_api_key)
    rows = [
        {
            "name": nba.meta.name,
            "leagues": nba.meta.leagues,
            "capabilities": nba.meta.capabilities,
            "requires_api_key": False,
            "is_mock": False,
            "configured": True,
            "legitimate": True,
            "notes": nba.meta.notes,
            "homepage": nba.meta.homepage,
        },
        {
            "name": nfl.meta.name,
            "leagues": nfl.meta.leagues,
            "capabilities": nfl.meta.capabilities,
            "requires_api_key": False,
            "is_mock": False,
            "configured": True,
            "legitimate": True,
            "notes": nfl.meta.notes,
        },
        {
            "name": wnba.meta.name,
            "leagues": wnba.meta.leagues,
            "capabilities": wnba.meta.capabilities,
            "requires_api_key": False,
            "is_mock": False,
            "configured": True,
            "legitimate": True,
            "notes": wnba.meta.notes,
            "homepage": wnba.meta.homepage,
        },
        {
            "name": "the-odds-api",
            "leagues": ["NBA", "NFL", "WNBA", "ATP", "WTA"],
            "capabilities": ["odds", "props"],
            "requires_api_key": True,
            "is_mock": not odds_live,
            "configured": odds_live,
            "legitimate": odds_live,
            "notes": (
                "Live sportsbook odds when ODDS_API_KEY is set. "
                "Without a key, MockOddsProvider supplies clearly labeled -110 placeholders."
            ),
        },
        {
            "name": "catalog-comparison-lines",
            "leagues": ["NBA", "NFL", "WNBA", "MLB", "NHL", "Soccer", "ATP", "WTA"],
            "capabilities": ["odds", "props", "pickem"],
            "requires_api_key": False,
            "is_mock": True,
            "configured": True,
            "legitimate": False,
            "notes": (
                "Canonical line catalog: PrizePicks, Underdog, FanDuel, DraftKings, BetMGM, "
                "Caesars, Fanatics Sportsbook, ESPN BET. Unconnected operators show placeholders "
                "marked requires_integration. Swap adapters without UI changes."
            ),
            "operators": [
                "PrizePicks",
                "Underdog",
                "FanDuel",
                "DraftKings",
                "BetMGM",
                "Caesars",
                "Fanatics Sportsbook",
                "ESPN BET",
            ],
        },
        {
            "name": "mlb-provider",
            "leagues": ["MLB"],
            "capabilities": ["schedule", "gamelog", "injuries", "odds"],
            "requires_api_key": True,
            "is_mock": True,
            "configured": False,
            "legitimate": False,
            "notes": "REQUIRES PROVIDER — MLB stats + odds adapter not connected.",
        },
        {
            "name": "nhl-provider",
            "leagues": ["NHL"],
            "capabilities": ["schedule", "gamelog", "injuries", "odds"],
            "requires_api_key": True,
            "is_mock": True,
            "configured": False,
            "legitimate": False,
            "notes": "REQUIRES PROVIDER — NHL stats + odds adapter not connected.",
        },
        {
            "name": "soccer-provider",
            "leagues": ["Soccer"],
            "capabilities": ["schedule", "gamelog", "injuries", "odds"],
            "requires_api_key": True,
            "is_mock": True,
            "configured": False,
            "legitimate": False,
            "notes": "REQUIRES PROVIDER — Soccer (EPL/MLS/etc.) adapter not connected.",
        },
        {
            "name": "tennis-provider",
            "leagues": ["ATP", "WTA"],
            "capabilities": ["schedule", "gamelog", "odds"],
            "requires_api_key": True,
            "is_mock": True,
            "configured": False,
            "legitimate": False,
            "notes": "REQUIRES PROVIDER SELECTION — ATP/WTA need a licensed tennis + odds source.",
        },
    ]
    return rows


def get_nba_providers() -> ProviderBundle:
    """First legitimate sports data provider: ESPN NBA (public APIs, no key)."""
    settings = get_settings()
    espn = EspnNbaProvider(user_agent=settings.espn_user_agent)
    return ProviderBundle(
        schedule=espn,
        gamelog=espn,
        injuries=espn,
        odds=_odds_provider(),
        featured=espn,
        roster=espn,
        primary=espn.meta.name,
        metas=[espn.meta, _odds_provider().meta],
    )


def get_nfl_providers() -> ProviderBundle:
    settings = get_settings()
    espn = EspnNflProvider(user_agent=settings.espn_user_agent)
    return ProviderBundle(
        schedule=espn,
        gamelog=espn,
        injuries=espn,
        odds=_odds_provider(),
        featured=espn,
        roster=espn,
        primary=espn.meta.name,
        metas=[espn.meta, _odds_provider().meta],
    )


def get_wnba_providers() -> ProviderBundle:
    """Live ESPN WNBA — same basketball patterns as NBA; PrizePicks for pick'em comparison."""
    settings = get_settings()
    espn = EspnWnbaProvider(user_agent=settings.espn_user_agent)
    return ProviderBundle(
        schedule=espn,
        gamelog=espn,
        injuries=espn,
        odds=_odds_provider(),
        featured=espn,
        roster=espn,
        primary=espn.meta.name,
        metas=[espn.meta, _odds_provider().meta],
    )


def list_metas() -> list[ProviderMeta]:
    return [
        EspnNbaProvider().meta,
        EspnNflProvider().meta,
        EspnWnbaProvider().meta,
        MockOddsProvider().meta,
        TheOddsApiProvider(api_key="").meta,
    ]


def provider_capability_matrix() -> list[dict]:
    return capability_matrix(list_metas())
