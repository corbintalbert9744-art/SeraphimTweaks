"""Predict API — Projection Engine V1 without sportsbook dependency."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.analytics.factors import default_factor_stack
from app.analytics.factors.base import PredictionContext
from app.analytics.prediction import MODEL_VERSION, V1_FACTOR_KEYS, predict_prop

router = APIRouter(prefix="/predict", tags=["predict"])


class PredictRequest(BaseModel):
    league: str = "NBA"
    market: str = "Points"
    values: list[float] = Field(..., description="Historical stat values, newest first")
    homes: list[bool] = Field(default_factory=list)
    minutes: list[Optional[float]] = Field(default_factory=list)
    injury_status: str = "None"
    is_home: Optional[bool] = None
    opponent_abbr: Optional[str] = None
    opponent_def_rank: Optional[int] = None
    opponent_stat_allowed: Optional[float] = None
    league_avg_allowed: Optional[float] = None
    pace_index: Optional[float] = None
    usage_index: Optional[float] = None
    expected_minutes: Optional[float] = None
    vs_opponent_values: list[float] = Field(default_factory=list)
    tipoff_at_iso: Optional[str] = None
    # Optional line the user sees elsewhere — comparison only
    comparison_line: Optional[float] = None
    played_at_iso: list[str] = Field(default_factory=list)


@router.get("/model")
def model_info() -> dict[str, Any]:
    stack = default_factor_stack()
    return {
        "modelVersion": MODEL_VERSION,
        "name": "Seraphim Projection Engine V1",
        "type": "rule-based",
        "ml": False,
        "factors": [
            {"key": f.key, "label": f.label}
            for f in stack
        ],
        "requiredFactors": list(V1_FACTOR_KEYS),
        "notes": (
            "V1 projects every player prop from historical performance, recent form, "
            "home/away splits, opponent strength, expected minutes, usage, injuries, "
            "and rest days. Sportsbook lines are comparison-only."
        ),
        "outputs": [
            "projectedValue",
            "confidenceScore",
            "researchScore",
            "explanation",
            "overProbability",
            "underProbability",
            "influentialFactors",
            "factorBreakdown",
        ],
        "roadmap": "Add ML later once warehouse has enough labeled history.",
    }


@router.post("/prop")
def predict_prop_endpoint(body: PredictRequest) -> dict[str, Any]:
    played_at = []
    for s in body.played_at_iso:
        try:
            played_at.append(datetime.fromisoformat(s.replace("Z", "+00:00")))
        except ValueError:
            continue
    if not played_at and body.values:
        now = datetime.now(timezone.utc)
        played_at = [now] * len(body.values)

    tipoff_at = None
    if body.tipoff_at_iso:
        try:
            tipoff_at = datetime.fromisoformat(body.tipoff_at_iso.replace("Z", "+00:00"))
        except ValueError:
            tipoff_at = None

    homes = body.homes or [True] * len(body.values)
    if len(homes) < len(body.values):
        homes = homes + [True] * (len(body.values) - len(homes))

    ctx = PredictionContext(
        league=body.league.upper(),
        market=body.market,
        values=list(body.values),
        homes=homes[: len(body.values)],
        played_at=played_at[: len(body.values)],
        minutes=body.minutes,
        injury_status=body.injury_status,
        is_home=body.is_home,
        opponent_abbr=body.opponent_abbr,
        tipoff_at=tipoff_at,
        expected_minutes=body.expected_minutes,
        vs_opponent_values=list(body.vs_opponent_values),
        opponent_def_rank=body.opponent_def_rank,
        opponent_stat_allowed=body.opponent_stat_allowed,
        league_avg_allowed=body.league_avg_allowed,
        pace_index=body.pace_index,
        usage_index=body.usage_index,
    )
    pred = predict_prop(ctx, comparison_line=body.comparison_line)
    payload = pred.to_api_dict()
    return {
        "ok": True,
        "projection": payload["projectedValue"],
        "confidenceScore": payload["confidenceScore"],
        "researchScore": payload["researchScore"],
        "explanation": payload["explanation"],
        "prediction": payload,
    }
