"""SQLAlchemy ORM models — normalized sports warehouse.

Aligns with shared/schema.ts (Drizzle) and extends it with:
- team_stats, prop_analytics, line_snapshots, provider_runs
- multi-league ready fields
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import JSON


class Base(DeclarativeBase):
    pass


JsonDict = dict[str, Any]


class Team(Base):
    __tablename__ = "teams"
    __table_args__ = (UniqueConstraint("league", "abbreviation", name="teams_league_abbr_idx"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    league: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    abbreviation: Mapped[str] = mapped_column(String(16), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    city: Mapped[Optional[str]] = mapped_column(String(128))
    logo_url: Mapped[Optional[str]] = mapped_column(Text)
    provider: Mapped[str] = mapped_column(String(32), default="espn")
    external_id: Mapped[Optional[str]] = mapped_column(String(64))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Player(Base):
    __tablename__ = "players"
    __table_args__ = (
        UniqueConstraint("provider", "external_id", name="players_provider_ext_idx"),
        Index("players_league_idx", "league"),
        Index("players_team_idx", "team_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    league: Mapped[str] = mapped_column(String(16), nullable=False)
    team_id: Mapped[Optional[str]] = mapped_column(ForeignKey("teams.id"))
    full_name: Mapped[str] = mapped_column(String(128), nullable=False)
    short_name: Mapped[Optional[str]] = mapped_column(String(64))
    position: Mapped[Optional[str]] = mapped_column(String(32))
    jersey: Mapped[Optional[str]] = mapped_column(String(16))
    headshot_url: Mapped[Optional[str]] = mapped_column(Text)
    provider: Mapped[str] = mapped_column(String(32), default="espn")
    external_id: Mapped[Optional[str]] = mapped_column(String(64))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Game(Base):
    __tablename__ = "games"
    __table_args__ = (
        UniqueConstraint("provider", "external_id", name="games_provider_ext_idx"),
        Index("games_league_tipoff_idx", "league", "tipoff_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    league: Mapped[str] = mapped_column(String(16), nullable=False)
    season: Mapped[Optional[str]] = mapped_column(String(16))
    tipoff_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(64), nullable=False)
    home_team_id: Mapped[Optional[str]] = mapped_column(ForeignKey("teams.id"))
    away_team_id: Mapped[Optional[str]] = mapped_column(ForeignKey("teams.id"))
    home_score: Mapped[Optional[int]] = mapped_column(Integer)
    away_score: Mapped[Optional[int]] = mapped_column(Integer)
    venue: Mapped[Optional[str]] = mapped_column(String(256))
    provider: Mapped[str] = mapped_column(String(32), default="espn")
    external_id: Mapped[Optional[str]] = mapped_column(String(64))
    raw: Mapped[Optional[JsonDict]] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Sportsbook(Base):
    __tablename__ = "sportsbooks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Prop(Base):
    __tablename__ = "props"
    __table_args__ = (
        Index("props_league_idx", "league"),
        Index("props_player_idx", "player_id"),
        Index("props_game_idx", "game_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    league: Mapped[str] = mapped_column(String(16), nullable=False)
    game_id: Mapped[Optional[str]] = mapped_column(ForeignKey("games.id"))
    player_id: Mapped[Optional[str]] = mapped_column(ForeignKey("players.id"))
    market: Mapped[str] = mapped_column(String(64), nullable=False)
    side: Mapped[str] = mapped_column(String(16), nullable=False)
    line: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Odds(Base):
    __tablename__ = "odds"
    __table_args__ = (Index("odds_prop_book_idx", "prop_id", "sportsbook_id"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    prop_id: Mapped[str] = mapped_column(ForeignKey("props.id"), nullable=False)
    sportsbook_id: Mapped[str] = mapped_column(ForeignKey("sportsbooks.id"), nullable=False)
    american_odds: Mapped[int] = mapped_column(Integer, nullable=False)
    line: Mapped[float] = mapped_column(Float, nullable=False)
    implied_prob: Mapped[Optional[float]] = mapped_column(Float)
    provider: Mapped[str] = mapped_column(String(32), default="mock")
    is_mock: Mapped[bool] = mapped_column(Boolean, default=False)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PlayerGameLog(Base):
    __tablename__ = "player_game_logs"
    __table_args__ = (Index("pgl_player_played_idx", "player_id", "played_at"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    player_id: Mapped[str] = mapped_column(ForeignKey("players.id"), nullable=False)
    game_id: Mapped[Optional[str]] = mapped_column(ForeignKey("games.id"))
    played_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    opponent: Mapped[Optional[str]] = mapped_column(String(16))
    home: Mapped[Optional[bool]] = mapped_column(Boolean)
    minutes: Mapped[Optional[float]] = mapped_column(Float)
    points: Mapped[Optional[float]] = mapped_column(Float)
    rebounds: Mapped[Optional[float]] = mapped_column(Float)
    assists: Mapped[Optional[float]] = mapped_column(Float)
    threes: Mapped[Optional[float]] = mapped_column(Float)
    steals: Mapped[Optional[float]] = mapped_column(Float)
    blocks: Mapped[Optional[float]] = mapped_column(Float)
    # Tennis / flexible metrics
    raw: Mapped[Optional[JsonDict]] = mapped_column(JSON)


class Injury(Base):
    __tablename__ = "injuries"
    __table_args__ = (Index("injuries_league_idx", "league"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    player_id: Mapped[Optional[str]] = mapped_column(ForeignKey("players.id"))
    team_id: Mapped[Optional[str]] = mapped_column(ForeignKey("teams.id"))
    league: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(64), nullable=False)
    detail: Mapped[Optional[str]] = mapped_column(Text)
    reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    provider: Mapped[str] = mapped_column(String(32), default="espn")


class TeamStat(Base):
    """Team-level defensive / pace / rating snapshots for matchup analysis."""

    __tablename__ = "team_stats"
    __table_args__ = (
        UniqueConstraint("team_id", "season", "stat_key", name="team_stats_unique"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"), nullable=False)
    league: Mapped[str] = mapped_column(String(16), nullable=False)
    season: Mapped[str] = mapped_column(String(16), nullable=False)
    stat_key: Mapped[str] = mapped_column(String(64), nullable=False)
    stat_value: Mapped[float] = mapped_column(Float, nullable=False)
    rank: Mapped[Optional[int]] = mapped_column(Integer)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    provider: Mapped[str] = mapped_column(String(32), default="derived")
    is_mock: Mapped[bool] = mapped_column(Boolean, default=False)


class PropAnalytics(Base):
    """Cached analytics for a prop — recalculated by scheduled jobs."""

    __tablename__ = "prop_analytics"
    __table_args__ = (Index("prop_analytics_league_score_idx", "league", "research_score"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    prop_id: Mapped[str] = mapped_column(ForeignKey("props.id"), unique=True, nullable=False)
    league: Mapped[str] = mapped_column(String(16), nullable=False)

    l5_hits: Mapped[Optional[int]] = mapped_column(Integer)
    l5_samples: Mapped[Optional[int]] = mapped_column(Integer)
    l5_rate: Mapped[Optional[float]] = mapped_column(Float)
    l10_hits: Mapped[Optional[int]] = mapped_column(Integer)
    l10_samples: Mapped[Optional[int]] = mapped_column(Integer)
    l10_rate: Mapped[Optional[float]] = mapped_column(Float)
    l20_hits: Mapped[Optional[int]] = mapped_column(Integer)
    l20_samples: Mapped[Optional[int]] = mapped_column(Integer)
    l20_rate: Mapped[Optional[float]] = mapped_column(Float)
    season_hits: Mapped[Optional[int]] = mapped_column(Integer)
    season_samples: Mapped[Optional[int]] = mapped_column(Integer)
    season_rate: Mapped[Optional[float]] = mapped_column(Float)

    home_rate: Mapped[Optional[float]] = mapped_column(Float)
    away_rate: Mapped[Optional[float]] = mapped_column(Float)
    rest_days: Mapped[Optional[int]] = mapped_column(Integer)
    streak: Mapped[Optional[int]] = mapped_column(Integer)  # +over / -under consecutive

    no_vig_prob: Mapped[Optional[float]] = mapped_column(Float)
    ev_percent: Mapped[Optional[float]] = mapped_column(Float)
    research_score: Mapped[Optional[int]] = mapped_column(Integer)
    confidence_score: Mapped[Optional[int]] = mapped_column(Integer)
    data_quality_score: Mapped[Optional[int]] = mapped_column(Integer)

    matchup_note: Mapped[Optional[str]] = mapped_column(Text)
    explain_bullets: Mapped[Optional[list]] = mapped_column(JSON)
    why_payload: Mapped[Optional[JsonDict]] = mapped_column(JSON)
    checks: Mapped[Optional[list]] = mapped_column(JSON)

    # Explicit labeling for trust / transparency
    is_model_estimate: Mapped[bool] = mapped_column(Boolean, default=True)
    odds_are_mock: Mapped[bool] = mapped_column(Boolean, default=False)
    disclaimer: Mapped[Optional[str]] = mapped_column(Text)

    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LineSnapshot(Base):
    """Historical line ticks for movement charts."""

    __tablename__ = "line_snapshots"
    __table_args__ = (Index("line_snap_prop_idx", "prop_id", "captured_at"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    prop_id: Mapped[str] = mapped_column(ForeignKey("props.id"), nullable=False)
    line: Mapped[float] = mapped_column(Float, nullable=False)
    american_odds: Mapped[Optional[int]] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(32), default="derived")
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProviderRun(Base):
    """Audit log for ingestion / analytics jobs."""

    __tablename__ = "provider_runs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    league: Mapped[str] = mapped_column(String(16), nullable=False)
    job: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)  # ok | error | skipped
    rows_written: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[Optional[str]] = mapped_column(Text)
    is_mock: Mapped[bool] = mapped_column(Boolean, default=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
