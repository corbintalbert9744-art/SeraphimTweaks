"""SQLAlchemy ORM — PostgreSQL warehouse + app tables.

Aligned with shared/schema.ts (Drizzle). Prefer Alembic / SQL migrations
for Postgres; `init_db()` create_all remains for SQLite local dev.
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
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import JSON


class Base(DeclarativeBase):
    pass


JsonDict = dict[str, Any]


# ---------------------------------------------------------------------------
# Auth / membership
# ---------------------------------------------------------------------------


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    email: Mapped[str] = mapped_column(String(256), unique=True, nullable=False)
    username: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(128))
    role: Mapped[str] = mapped_column(String(32), default="member")
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(128))
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(128))
    membership_status: Mapped[str] = mapped_column(String(32), default="inactive")
    plan: Mapped[Optional[str]] = mapped_column(String(32))
    billing_interval: Mapped[Optional[str]] = mapped_column(String(32))
    current_period_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Subscription(Base):
    __tablename__ = "subscriptions"
    __table_args__ = (
        Index("subscriptions_user_idx", "user_id"),
        Index("subscriptions_status_idx", "status"),
        UniqueConstraint("stripe_subscription_id", name="subscriptions_stripe_sub_idx"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plan: Mapped[str] = mapped_column(String(32), nullable=False)
    billing_interval: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="inactive")
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(128))
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(128))
    stripe_price_id: Mapped[Optional[str]] = mapped_column(String(128))
    current_period_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    current_period_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False)
    canceled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Sports catalog
# ---------------------------------------------------------------------------


class Sport(Base):
    __tablename__ = "sports"

    code: Mapped[str] = mapped_column(String(16), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Team(Base):
    __tablename__ = "teams"
    __table_args__ = (
        UniqueConstraint("league", "abbreviation", name="teams_league_abbr_idx"),
        Index("teams_league_idx", "league"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    league: Mapped[str] = mapped_column(String(16), nullable=False)
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


# ---------------------------------------------------------------------------
# Stats / injuries
# ---------------------------------------------------------------------------


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
    raw: Mapped[Optional[JsonDict]] = mapped_column(JSON)


class Injury(Base):
    __tablename__ = "injuries"
    __table_args__ = (
        Index("injuries_league_idx", "league"),
        Index("injuries_player_idx", "player_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    player_id: Mapped[Optional[str]] = mapped_column(ForeignKey("players.id"))
    team_id: Mapped[Optional[str]] = mapped_column(ForeignKey("teams.id"))
    league: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(64), nullable=False)
    detail: Mapped[Optional[str]] = mapped_column(Text)
    reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    provider: Mapped[str] = mapped_column(String(32), default="espn")


class TeamStat(Base):
    __tablename__ = "team_stats"
    __table_args__ = (UniqueConstraint("team_id", "season", "stat_key", name="team_stats_unique"),)

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


# ---------------------------------------------------------------------------
# Props / lines / projections
# ---------------------------------------------------------------------------


class Sportsbook(Base):
    __tablename__ = "sportsbooks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(32), default="sportsbook")  # sportsbook | pickem
    provider: Mapped[Optional[str]] = mapped_column(String(64), default="manual")
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Prop(Base):
    __tablename__ = "props"
    __table_args__ = (
        Index("props_league_idx", "league"),
        Index("props_player_idx", "player_id"),
        Index("props_game_idx", "game_id"),
        Index("props_status_idx", "status"),
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
    __table_args__ = (
        Index("odds_prop_book_idx", "prop_id", "sportsbook_id"),
        Index("odds_captured_idx", "captured_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    prop_id: Mapped[str] = mapped_column(ForeignKey("props.id"), nullable=False)
    sportsbook_id: Mapped[str] = mapped_column(ForeignKey("sportsbooks.id"), nullable=False)
    side: Mapped[Optional[str]] = mapped_column(String(16))
    american_odds: Mapped[int] = mapped_column(Integer, nullable=False)
    line: Mapped[float] = mapped_column(Float, nullable=False)
    implied_prob: Mapped[Optional[float]] = mapped_column(Float)
    provider: Mapped[str] = mapped_column(String(32), default="mock")
    is_mock: Mapped[bool] = mapped_column(Boolean, default=False)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PropAnalytics(Base):
    """Model projections + research/confidence scores (Seraphim engine)."""

    __tablename__ = "prop_analytics"
    __table_args__ = (
        Index("prop_analytics_league_score_idx", "league", "research_score"),
        Index("prop_analytics_confidence_idx", "confidence_score"),
        Index("prop_analytics_edge_idx", "edge_vs_line"),
    )

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
    streak: Mapped[Optional[int]] = mapped_column(Integer)

    no_vig_prob: Mapped[Optional[float]] = mapped_column(Float)
    ev_percent: Mapped[Optional[float]] = mapped_column(Float)
    research_score: Mapped[Optional[int]] = mapped_column(Integer)
    confidence_score: Mapped[Optional[int]] = mapped_column(Integer)
    data_quality_score: Mapped[Optional[int]] = mapped_column(Integer)

    projected_value: Mapped[Optional[float]] = mapped_column(Float)
    over_probability: Mapped[Optional[float]] = mapped_column(Float)
    under_probability: Mapped[Optional[float]] = mapped_column(Float)
    comparison_line: Mapped[Optional[float]] = mapped_column(Float)
    edge_vs_line: Mapped[Optional[float]] = mapped_column(Float)
    residual_sigma: Mapped[Optional[float]] = mapped_column(Float)
    model_version: Mapped[Optional[str]] = mapped_column(String(32))
    factor_breakdown: Mapped[Optional[list]] = mapped_column(JSON)
    influential_factors: Mapped[Optional[list]] = mapped_column(JSON)

    matchup_note: Mapped[Optional[str]] = mapped_column(Text)
    explain_bullets: Mapped[Optional[list]] = mapped_column(JSON)
    why_payload: Mapped[Optional[JsonDict]] = mapped_column(JSON)
    checks: Mapped[Optional[list]] = mapped_column(JSON)

    is_model_estimate: Mapped[bool] = mapped_column(Boolean, default=True)
    odds_are_mock: Mapped[bool] = mapped_column(Boolean, default=False)
    disclaimer: Mapped[Optional[str]] = mapped_column(Text)

    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LineSnapshot(Base):
    __tablename__ = "line_snapshots"
    __table_args__ = (Index("line_snap_prop_idx", "prop_id", "captured_at"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    prop_id: Mapped[str] = mapped_column(ForeignKey("props.id"), nullable=False)
    sportsbook_id: Mapped[Optional[str]] = mapped_column(ForeignKey("sportsbooks.id"))
    line: Mapped[float] = mapped_column(Float, nullable=False)
    american_odds: Mapped[Optional[int]] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(32), default="derived")
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# User research artifacts
# ---------------------------------------------------------------------------


class SavedParlay(Base):
    __tablename__ = "saved_parlays"
    __table_args__ = (Index("saved_parlays_user_idx", "user_id"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(256))
    legs: Mapped[Any] = mapped_column(JSON, nullable=False)
    avg_hit_rate: Mapped[Optional[float]] = mapped_column(Float)
    combined_ev: Mapped[Optional[float]] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SavedParlayLeg(Base):
    __tablename__ = "saved_parlay_legs"
    __table_args__ = (Index("saved_parlay_legs_parlay_idx", "parlay_id"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    parlay_id: Mapped[str] = mapped_column(ForeignKey("saved_parlays.id", ondelete="CASCADE"), nullable=False)
    prop_id: Mapped[Optional[str]] = mapped_column(ForeignKey("props.id"))
    league: Mapped[Optional[str]] = mapped_column(String(16))
    player: Mapped[Optional[str]] = mapped_column(String(128))
    market: Mapped[Optional[str]] = mapped_column(String(64))
    side: Mapped[Optional[str]] = mapped_column(String(16))
    line: Mapped[Optional[float]] = mapped_column(Float)
    american_odds: Mapped[Optional[int]] = mapped_column(Integer)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (Index("alerts_user_idx", "user_id"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    prop_id: Mapped[Optional[str]] = mapped_column(ForeignKey("props.id"))
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    threshold: Mapped[Optional[float]] = mapped_column(Float)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    payload: Mapped[Optional[JsonDict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Ops
# ---------------------------------------------------------------------------


class ProviderRun(Base):
    __tablename__ = "provider_runs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    league: Mapped[str] = mapped_column(String(16), nullable=False)
    job: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    rows_written: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[Optional[str]] = mapped_column(Text)
    is_mock: Mapped[bool] = mapped_column(Boolean, default=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
