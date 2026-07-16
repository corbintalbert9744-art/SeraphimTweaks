"""Predict API — run Seraphim model without sportsbook dependency."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.analytics.factors.base import PredictionContext
from app.analytics.prediction import MODEL_VERSION, predict_prop

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
    # Optional line the user sees elsewhere — comparison only
    comparison_line: Optional[float] = None
    played_at_iso: list[str] = Field(default_factory=list)


@router.get("/model")
def model_info() -> dict[str, Any]:
    return {
        "modelVersion": MODEL_VERSION,
        "type": "rule-based",
        "ml": False,
        "notes": (
            "Modular factor stack: season baseline, recent form, home/away, rest, "
            "injury, matchup, pace/usage, streak. Sportsbook lines are comparison-only."
        ),
        "roadmap": "Add ML later once warehouse has enough labeled history.",
        "outputs": [
            "projectedValue",
            "overProbability",
            "underProbability",
            "researchScore",
            "confidenceScore",
            "explanation",
            "influentialFactors",
        ],
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
        # Synthetic descending timestamps for rest factor when dates omitted
        now = datetime.now(timezone.utc)
        played_at = [now] * len(body.values)

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
        opponent_def_rank=body.opponent_def_rank,
        opponent_stat_allowed=body.opponent_stat_allowed,
        league_avg_allowed=body.league_avg_allowed,
        pace_index=body.pace_index,
        usage_index=body.usage_index,
    )
    pred = predict_prop(ctx, comparison_line=body.comparison_line)
    return {"ok": True, "prediction": pred.to_api_dict()}
