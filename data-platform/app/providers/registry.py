"""Provider registry — swap vendors without touching API routes."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.config import get_settings
from app.providers.base import ProviderMeta, capability_matrix
from app.providers.espn.nba import EspnNbaProvider
from app.providers.espn.nfl import EspnNflProvider
from app.providers.espn.wnba import EspnWnbaProvider
from app.providers.mlb.statsapi import MlbStatsApiProvider
from app.providers.mock.odds import MockOddsProvider
from app.providers.nba_api.provider import NbaApiProvider, nba_api_installed
from app.providers.nflverse.provider import NflverseProvider, nflverse_installed
from app.providers.nhl.api import NhlApiProvider
from app.providers.soccer.football_data import FootballDataOrgProvider
from app.providers.tennis.tennis_abstract import TennisAbstractProvider
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


def get_odds_provider():
    """Public odds resolver — live The Odds API when keyed, else labeled mock."""
    settings = get_settings()
    if settings.odds_api_key:
        return TheOddsApiProvider(api_key=settings.odds_api_key)
    return MockOddsProvider()


# Back-compat alias used by older call sites
_odds_provider = get_odds_provider


def provider_status() -> list[dict]:
    """Public status for /api/v1/providers — what's live vs needs config."""
    settings = get_settings()
    nba = EspnNbaProvider()
    nfl = EspnNflProvider()
    wnba = EspnWnbaProvider()
    mlb = MlbStatsApiProvider()
    nhl = NhlApiProvider()
    soccer = FootballDataOrgProvider(settings.football_data_api_key or "")
    tennis = TennisAbstractProvider()
    nba_api = NbaApiProvider()
    nflverse = NflverseProvider()
    odds_live = bool(settings.odds_api_key)
    soccer_live = bool(settings.football_data_api_key)

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
            "name": nba_api.meta.name,
            "leagues": nba_api.meta.leagues,
            "capabilities": nba_api.meta.capabilities,
            "requires_api_key": False,
            "is_mock": False,
            "configured": nba_api_installed(),
            "legitimate": nba_api_installed(),
            "installed": nba_api_installed(),
            "notes": nba_api.meta.notes,
            "homepage": nba_api.meta.homepage,
        },
        {
            "name": nflverse.meta.name,
            "leagues": nflverse.meta.leagues,
            "capabilities": nflverse.meta.capabilities,
            "requires_api_key": False,
            "is_mock": False,
            "configured": nflverse_installed(),
            "legitimate": nflverse_installed(),
            "installed": nflverse_installed(),
            "notes": nflverse.meta.notes,
            "homepage": nflverse.meta.homepage,
        },
        {
            "name": mlb.meta.name,
            "leagues": mlb.meta.leagues,
            "capabilities": mlb.meta.capabilities,
            "requires_api_key": False,
            "is_mock": False,
            "configured": True,
            "legitimate": True,
            "notes": mlb.meta.notes,
            "homepage": mlb.meta.homepage,
        },
        {
            "name": nhl.meta.name,
            "leagues": nhl.meta.leagues,
            "capabilities": nhl.meta.capabilities,
            "requires_api_key": False,
            "is_mock": False,
            "configured": True,
            "legitimate": True,
            "notes": nhl.meta.notes,
            "homepage": nhl.meta.homepage,
        },
        {
            "name": soccer.meta.name,
            "leagues": soccer.meta.leagues,
            "capabilities": soccer.meta.capabilities,
            "requires_api_key": True,
            "is_mock": False,
            "configured": soccer_live,
            "legitimate": soccer_live,
            "notes": soccer.meta.notes,
            "homepage": soccer.meta.homepage,
            "envVar": "FOOTBALL_DATA_API_KEY",
        },
        {
            "name": tennis.meta.name,
            "leagues": tennis.meta.leagues,
            "capabilities": tennis.meta.capabilities,
            "requires_api_key": True,
            "is_mock": False,
            "configured": False,
            "legitimate": False,
            "notes": tennis.meta.notes,
            "homepage": tennis.meta.homepage,
        },
        {
            "name": "the-odds-api",
            "leagues": ["NBA", "NFL", "WNBA", "MLB", "NHL", "Soccer", "ATP", "WTA"],
            "capabilities": ["odds", "props"],
            "requires_api_key": True,
            "is_mock": not odds_live,
            "configured": odds_live,
            "legitimate": odds_live,
            "envVar": "ODDS_API_KEY",
            "notes": (
                "Live sportsbook odds when ODDS_API_KEY is set. "
                "Without a key, MockOddsProvider supplies clearly labeled -110 placeholders. "
                "Tennis sport keys are tournament-specific placeholders."
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
        odds=get_odds_provider(),
        featured=espn,
        roster=espn,
        primary=espn.meta.name,
        metas=[espn.meta, get_odds_provider().meta],
    )


def get_nfl_providers() -> ProviderBundle:
    settings = get_settings()
    espn = EspnNflProvider(user_agent=settings.espn_user_agent)
    return ProviderBundle(
        schedule=espn,
        gamelog=espn,
        injuries=espn,
        odds=get_odds_provider(),
        featured=espn,
        roster=espn,
        primary=espn.meta.name,
        metas=[espn.meta, get_odds_provider().meta],
    )


def get_wnba_providers() -> ProviderBundle:
    """Live ESPN WNBA — same basketball patterns as NBA; PrizePicks for pick'em comparison."""
    settings = get_settings()
    espn = EspnWnbaProvider(user_agent=settings.espn_user_agent)
    return ProviderBundle(
        schedule=espn,
        gamelog=espn,
        injuries=espn,
        odds=get_odds_provider(),
        featured=espn,
        roster=espn,
        primary=espn.meta.name,
        metas=[espn.meta, get_odds_provider().meta],
    )


def get_mlb_providers() -> ProviderBundle:
    mlb = MlbStatsApiProvider()
    return ProviderBundle(
        schedule=mlb,
        gamelog=mlb,
        injuries=None,
        odds=get_odds_provider(),
        featured=None,
        roster=mlb,
        primary=mlb.meta.name,
        metas=[mlb.meta, get_odds_provider().meta],
    )


def get_nhl_providers() -> ProviderBundle:
    nhl = NhlApiProvider()
    return ProviderBundle(
        schedule=nhl,
        gamelog=nhl,
        injuries=None,
        odds=get_odds_provider(),
        featured=None,
        roster=nhl,
        primary=nhl.meta.name,
        metas=[nhl.meta, get_odds_provider().meta],
    )


def get_soccer_providers() -> ProviderBundle | None:
    settings = get_settings()
    if not settings.football_data_api_key:
        return None
    soccer = FootballDataOrgProvider(settings.football_data_api_key)
    return ProviderBundle(
        schedule=soccer,
        gamelog=None,
        injuries=None,
        odds=get_odds_provider(),
        featured=None,
        roster=soccer,
        primary=soccer.meta.name,
        metas=[soccer.meta, get_odds_provider().meta],
    )


def list_metas() -> list[ProviderMeta]:
    return [
        EspnNbaProvider().meta,
        EspnNflProvider().meta,
        EspnWnbaProvider().meta,
        MlbStatsApiProvider().meta,
        NhlApiProvider().meta,
        FootballDataOrgProvider("").meta,
        TennisAbstractProvider().meta,
        NbaApiProvider().meta,
        NflverseProvider().meta,
        MockOddsProvider().meta,
        TheOddsApiProvider(api_key="").meta,
    ]


def provider_capability_matrix() -> list[dict]:
    return capability_matrix(list_metas())
