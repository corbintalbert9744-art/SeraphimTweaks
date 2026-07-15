"""Provider adapter contracts.

Adapters normalize external feeds into shared DTOs. The application never
calls a vendor SDK directly from API routes — only through these interfaces.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional, Protocol, runtime_checkable


@dataclass
class ProviderMeta:
    name: str
    leagues: list[str]
    capabilities: list[str]  # schedule | gamelog | injuries | odds | team_stats | props
    requires_api_key: bool = False
    is_mock: bool = False
    notes: str = ""


@dataclass
class NormalizedTeam:
    external_id: str
    league: str
    abbreviation: str
    name: str
    city: Optional[str] = None
    logo_url: Optional[str] = None


@dataclass
class NormalizedPlayer:
    external_id: str
    league: str
    full_name: str
    team_external_id: Optional[str] = None
    short_name: Optional[str] = None
    position: Optional[str] = None
    jersey: Optional[str] = None
    headshot_url: Optional[str] = None


@dataclass
class NormalizedGame:
    external_id: str
    league: str
    tipoff_at: datetime
    status: str
    home_team_external_id: str
    away_team_external_id: str
    home_abbr: str
    away_abbr: str
    home_name: str
    away_name: str
    season: Optional[str] = None
    venue: Optional[str] = None
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    home_logo: Optional[str] = None
    away_logo: Optional[str] = None
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class NormalizedGamelog:
    player_external_id: str
    league: str
    played_at: datetime
    opponent: str
    home: bool
    game_external_id: Optional[str] = None
    minutes: Optional[float] = None
    points: Optional[float] = None
    rebounds: Optional[float] = None
    assists: Optional[float] = None
    threes: Optional[float] = None
    steals: Optional[float] = None
    blocks: Optional[float] = None
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class NormalizedInjury:
    league: str
    status: str
    player_external_id: Optional[str] = None
    player_name: Optional[str] = None
    team_external_id: Optional[str] = None
    team_abbr: Optional[str] = None
    detail: Optional[str] = None
    reported_at: Optional[datetime] = None


@dataclass
class NormalizedOddsQuote:
    """One book quote for a player prop market."""

    league: str
    player_external_id: Optional[str]
    player_name: str
    market: str  # Points, Rebounds, ...
    side: str  # Over | Under
    line: float
    american_odds: int
    sportsbook_slug: str
    sportsbook_name: str
    game_external_id: Optional[str] = None
    captured_at: Optional[datetime] = None
    is_mock: bool = False


@runtime_checkable
class ScheduleProvider(Protocol):
    meta: ProviderMeta

    def fetch_schedule(self, league: str, date: Optional[str] = None) -> list[NormalizedGame]:
        ...


@runtime_checkable
class GamelogProvider(Protocol):
    meta: ProviderMeta

    def fetch_gamelog(self, league: str, player_external_id: str) -> list[NormalizedGamelog]:
        ...


@runtime_checkable
class InjuryProvider(Protocol):
    meta: ProviderMeta

    def fetch_injuries(self, league: str, game_external_id: Optional[str] = None) -> list[NormalizedInjury]:
        ...


@runtime_checkable
class OddsProvider(Protocol):
    meta: ProviderMeta

    def fetch_player_prop_odds(self, league: str, date: Optional[str] = None) -> list[NormalizedOddsQuote]:
        ...


@runtime_checkable
class FeaturedAthleteProvider(Protocol):
    """Helper used by NBA featured-prop builder (leaders from game summary)."""

    meta: ProviderMeta

    def pick_featured_athlete(self, game_external_id: str) -> Optional[NormalizedPlayer]:
        ...
