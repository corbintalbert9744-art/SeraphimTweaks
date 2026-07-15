"""Provider registry — swap vendors without touching API routes."""

from __future__ import annotations

from dataclasses import dataclass

from app.config import get_settings
from app.providers.base import ProviderMeta
from app.providers.espn.nba import EspnNbaProvider
from app.providers.mock.odds import MockOddsProvider
from app.providers.the_odds_api.odds import TheOddsApiProvider


@dataclass
class ProviderBundle:
    schedule: object | None = None
    gamelog: object | None = None
    injuries: object | None = None
    odds: object | None = None
    featured: object | None = None


def provider_status() -> list[dict]:
    """Public status for /api/v1/providers — what's live vs needs config."""
    settings = get_settings()
    espn = EspnNbaProvider()
    odds_live = bool(settings.odds_api_key)
    return [
        {
            "name": espn.meta.name,
            "leagues": espn.meta.leagues,
            "capabilities": espn.meta.capabilities,
            "requires_api_key": espn.meta.requires_api_key,
            "is_mock": False,
            "configured": True,
            "notes": espn.meta.notes,
        },
        {
            "name": "the-odds-api",
            "leagues": ["NBA", "NFL", "WNBA", "ATP", "WTA"],
            "capabilities": ["odds", "props"],
            "requires_api_key": True,
            "is_mock": not odds_live,
            "configured": odds_live,
            "notes": (
                "Live sportsbook odds when ODDS_API_KEY is set. "
                "Without a key, MockOddsProvider supplies clearly labeled -110 placeholders."
            ),
        },
        {
            "name": "espn-nfl",
            "leagues": ["NFL"],
            "capabilities": ["schedule", "gamelog", "injuries"],
            "requires_api_key": False,
            "is_mock": True,
            "configured": False,
            "notes": "PLANNED — adapter stub. Select/configure after NBA warehouse is stable.",
        },
        {
            "name": "espn-wnba",
            "leagues": ["WNBA"],
            "capabilities": ["schedule", "gamelog", "injuries"],
            "requires_api_key": False,
            "is_mock": True,
            "configured": False,
            "notes": "PLANNED — reuse ESPN basketball patterns from NBA adapter.",
        },
        {
            "name": "tennis-provider",
            "leagues": ["ATP", "WTA"],
            "capabilities": ["schedule", "gamelog", "odds"],
            "requires_api_key": True,
            "is_mock": True,
            "configured": False,
            "notes": "REQUIRES PROVIDER SELECTION — ATP/WTA need a licensed tennis + odds source.",
        },
    ]


def get_nba_providers() -> ProviderBundle:
    settings = get_settings()
    espn = EspnNbaProvider(user_agent=settings.espn_user_agent)
    if settings.odds_api_key:
        odds: object = TheOddsApiProvider(api_key=settings.odds_api_key)
    else:
        odds = MockOddsProvider()
    return ProviderBundle(
        schedule=espn,
        gamelog=espn,
        injuries=espn,
        odds=odds,
        featured=espn,
    )


def list_metas() -> list[ProviderMeta]:
    return [EspnNbaProvider().meta, MockOddsProvider().meta, TheOddsApiProvider(api_key="").meta]
