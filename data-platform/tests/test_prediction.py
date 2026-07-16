"""Tests for the rule-based prediction engine."""

from datetime import datetime, timedelta, timezone

from app.analytics.factors.base import PredictionContext
from app.analytics.prediction import estimate_side_probabilities, predict_prop


def _ctx(**kwargs) -> PredictionContext:
    now = datetime.now(timezone.utc)
    values = kwargs.pop("values", [28, 26, 30, 22, 24, 27, 21, 25, 23, 29, 20, 26])
    n = len(values)
    defaults = dict(
        league="NBA",
        market="Points",
        values=values,
        homes=[True, False] * (n // 2) + [True] * (n % 2),
        played_at=[now - timedelta(days=i * 2) for i in range(n)],
        minutes=[36 - (i % 5) for i in range(n)],
        injury_status="None",
        is_home=True,
        opponent_abbr="ORL",
    )
    defaults.update(kwargs)
    return PredictionContext(**defaults)


def test_projection_near_season_mean():
    ctx = _ctx()
    pred = predict_prop(ctx, comparison_line=25.5)
    assert 20 < pred.projected_value < 35
    assert pred.model_version == "rule-based-v1"
    assert pred.is_model_estimate is True


def test_over_under_sum_to_one():
    over, under = estimate_side_probabilities(27.0, 25.5, 5.0)
    assert abs(over + under - 1.0) < 1e-6
    assert over > under  # projected above line


def test_injury_lowers_projection():
    healthy = predict_prop(_ctx(injury_status="None"), comparison_line=25.5)
    hurt = predict_prop(_ctx(injury_status="Questionable"), comparison_line=25.5)
    assert hurt.projected_value < healthy.projected_value


def test_influential_factors_present():
    pred = predict_prop(_ctx(), comparison_line=25.5)
    assert pred.influential_factors
    assert pred.explanation
    assert "projectedValue" in pred.to_api_dict()
    assert pred.research_score >= 35
    assert pred.confidence_score >= 40


def test_hot_form_raises_projection():
    cold = [15, 14, 16, 18, 17, 22, 23, 24, 25, 26, 27, 28]
    hot = [32, 34, 30, 31, 29, 22, 23, 24, 25, 26, 27, 28]
    p_cold = predict_prop(_ctx(values=cold), comparison_line=24.5)
    p_hot = predict_prop(_ctx(values=hot), comparison_line=24.5)
    assert p_hot.projected_value > p_cold.projected_value
