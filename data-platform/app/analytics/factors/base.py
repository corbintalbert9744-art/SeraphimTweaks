"""Factor protocol for Projection Engine V1.

Each factor returns an additive adjustment (in stat units) plus metadata
for explainability. Factors must be debuggable — no black-box ML here.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, Optional, Protocol, runtime_checkable

Impact = Literal["strong", "moderate", "mild", "neutral", "negative"]


@dataclass
class FactorResult:
    """One modular signal contributing to the projection."""

    key: str
    label: str
    adjustment: float  # added to baseline projection (stat units)
    weight: float  # 0–1 relative influence for ranking explanations
    impact: Impact
    detail: str
    raw: dict[str, Any] = field(default_factory=dict)
    available: bool = True  # False when data missing (skipped in blend)


@dataclass
class PredictionContext:
    """Inputs shared across factors — league-agnostic."""

    league: str
    market: str
    values: list[float]  # newest first — historical performance sample
    homes: list[bool]
    played_at: list  # datetime, newest first
    minutes: list[Optional[float]] = field(default_factory=list)
    injury_status: str = "None"
    is_home: Optional[bool] = None
    opponent_abbr: Optional[str] = None
    tipoff_at: Optional[datetime] = None  # upcoming tip — for rest-days calc
    expected_minutes: Optional[float] = None  # projected workload for this game
    # Historical lines vs this opponent (newest first) — matchup proxy
    vs_opponent_values: list[float] = field(default_factory=list)
    # Optional warehouse-backed matchup (None → H2H / rank proxy)
    opponent_def_rank: Optional[int] = None  # 1 = toughest, 30 = softest (NBA)
    opponent_stat_allowed: Optional[float] = None  # e.g. pts allowed to position
    league_avg_allowed: Optional[float] = None
    pace_index: Optional[float] = None  # 1.0 = average
    usage_index: Optional[float] = None  # 1.0 = average; else derived from per-minute rate


@runtime_checkable
class Factor(Protocol):
    key: str
    label: str

    def evaluate(self, ctx: PredictionContext) -> FactorResult:
        ...
