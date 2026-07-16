"""Provider adapter framework — contracts, HTTP client, and job runner.

Application code never calls vendor SDKs from API routes. Adapters implement
these protocols, normalize DTOs, and persist audit rows via ``run_provider_job``.
"""

from __future__ import annotations

import logging
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Generator, Iterable, Optional, Protocol, runtime_checkable

import httpx
from sqlalchemy.orm import Session

from app.db.models import ProviderRun

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Capabilities & metadata
# ---------------------------------------------------------------------------


class ProviderCapability(str, Enum):
    SCHEDULE = "schedule"
    ROSTER = "roster"
    GAMELOG = "gamelog"
    INJURIES = "injuries"
    FEATURED = "featured"
    SLATE = "slate"
    ODDS = "odds"
    PROPS = "props"
    TEAM_STATS = "team_stats"
    PICKEM = "pickem"


@dataclass
class ProviderMeta:
    name: str
    leagues: list[str]
    capabilities: list[str]
    requires_api_key: bool = False
    is_mock: bool = False
    notes: str = ""
    homepage: Optional[str] = None


# ---------------------------------------------------------------------------
# Normalized DTOs
# ---------------------------------------------------------------------------


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
    league: str
    player_external_id: Optional[str]
    player_name: str
    market: str
    side: str
    line: float
    american_odds: int
    sportsbook_slug: str
    sportsbook_name: str
    game_external_id: Optional[str] = None
    captured_at: Optional[datetime] = None
    is_mock: bool = False


# ---------------------------------------------------------------------------
# Protocols (capability contracts)
# ---------------------------------------------------------------------------


@runtime_checkable
class ScheduleProvider(Protocol):
    meta: ProviderMeta

    def fetch_schedule(self, league: str, date: Optional[str] = None) -> list[NormalizedGame]:
        ...


@runtime_checkable
class RosterProvider(Protocol):
    meta: ProviderMeta

    def fetch_team_roster(self, team_external_id: str) -> list[NormalizedPlayer]:
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
class FeaturedAthleteProvider(Protocol):
    meta: ProviderMeta

    def pick_featured_athlete(self, game_external_id: str) -> Optional[NormalizedPlayer]:
        ...


@runtime_checkable
class SlateAthleteProvider(Protocol):
    meta: ProviderMeta

    def pick_slate_athletes(self, game_external_id: str, per_team: int = 2) -> list[NormalizedPlayer]:
        ...


@runtime_checkable
class OddsProvider(Protocol):
    meta: ProviderMeta

    def fetch_player_prop_odds(self, league: str, date: Optional[str] = None) -> list[NormalizedOddsQuote]:
        ...


# ---------------------------------------------------------------------------
# HTTP client with retries
# ---------------------------------------------------------------------------


class ProviderHttpError(RuntimeError):
    def __init__(self, message: str, *, status_code: int | None = None, url: str | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.url = url


class ProviderHttpClient:
    """Shared HTTP client for provider adapters — retries + consistent headers."""

    def __init__(
        self,
        *,
        user_agent: str,
        timeout: float = 30.0,
        max_retries: int = 3,
        backoff_seconds: float = 0.6,
    ) -> None:
        self.user_agent = user_agent
        self.timeout = timeout
        self.max_retries = max_retries
        self.backoff_seconds = backoff_seconds

    def get_json(self, url: str, *, params: dict[str, Any] | None = None) -> Any:
        last_exc: Exception | None = None
        headers = {"User-Agent": self.user_agent, "Accept": "application/json"}
        for attempt in range(1, self.max_retries + 1):
            try:
                with httpx.Client(timeout=self.timeout, headers=headers, follow_redirects=True) as client:
                    res = client.get(url, params=params)
                    if res.status_code in (429, 500, 502, 503, 504) and attempt < self.max_retries:
                        time.sleep(self.backoff_seconds * attempt)
                        continue
                    res.raise_for_status()
                    return res.json()
            except Exception as exc:  # noqa: BLE001 — retry transient network errors
                last_exc = exc
                if attempt < self.max_retries:
                    time.sleep(self.backoff_seconds * attempt)
                    continue
                raise ProviderHttpError(str(exc), url=url) from exc
        raise ProviderHttpError(str(last_exc or "request failed"), url=url)


# ---------------------------------------------------------------------------
# Job runner → provider_runs audit table
# ---------------------------------------------------------------------------


@dataclass
class ProviderJobResult:
    provider: str
    league: str
    job: str
    status: str
    rows_written: int = 0
    message: Optional[str] = None
    is_mock: bool = False
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    finished_at: Optional[datetime] = None
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "league": self.league,
            "job": self.job,
            "status": self.status,
            "rowsWritten": self.rows_written,
            "message": self.message,
            "isMock": self.is_mock,
            "startedAt": self.started_at.isoformat(),
            "finishedAt": self.finished_at.isoformat() if self.finished_at else None,
            "details": self.details,
        }


@contextmanager
def run_provider_job(
    db: Session,
    *,
    provider: str,
    league: str,
    job: str,
    is_mock: bool = False,
) -> Generator[ProviderJobResult, None, None]:
    """Context manager that always writes a ``provider_runs`` row."""
    result = ProviderJobResult(
        provider=provider,
        league=league,
        job=job,
        status="running",
        is_mock=is_mock,
    )
    try:
        yield result
        if result.status == "running":
            result.status = "ok"
    except Exception as exc:
        result.status = "error"
        result.message = str(exc)[:2000]
        log.exception("provider job %s/%s failed", provider, job)
        raise
    finally:
        result.finished_at = datetime.now(timezone.utc)
        db.add(
            ProviderRun(
                id=str(uuid.uuid4()),
                provider=provider,
                league=league,
                job=job,
                status=result.status,
                rows_written=result.rows_written,
                message=result.message,
                is_mock=is_mock,
                started_at=result.started_at,
                finished_at=result.finished_at,
            )
        )
        db.flush()


def list_recent_provider_runs(db: Session, *, limit: int = 25) -> list[dict[str, Any]]:
    from sqlalchemy import select

    rows = db.execute(select(ProviderRun).order_by(ProviderRun.started_at.desc()).limit(limit)).scalars().all()
    return [
        {
            "id": r.id,
            "provider": r.provider,
            "league": r.league,
            "job": r.job,
            "status": r.status,
            "rowsWritten": r.rows_written,
            "message": r.message,
            "isMock": r.is_mock,
            "startedAt": r.started_at.isoformat() if r.started_at else None,
            "finishedAt": r.finished_at.isoformat() if r.finished_at else None,
        }
        for r in rows
    ]


def capability_matrix(metas: Iterable[ProviderMeta]) -> list[dict[str, Any]]:
    return [
        {
            "name": m.name,
            "leagues": m.leagues,
            "capabilities": m.capabilities,
            "requiresApiKey": m.requires_api_key,
            "isMock": m.is_mock,
            "notes": m.notes,
            "homepage": m.homepage,
        }
        for m in metas
    ]
