"""Edge % must stay coherent on pick'em 0.5 step markets."""

from app.analytics.prediction import estimate_side_probabilities, model_edge_percent


def test_total_bases_half_line_does_not_explode():
    projected = 2.25
    line = 0.5
    over_p, under_p = estimate_side_probabilities(projected, line, 1.5)
    edge = model_edge_percent(
        projected=projected,
        line=line,
        over_probability=over_p,
        under_probability=under_p,
        side="Over",
    )
    # Old formula was ~(2.25-0.5)/0.5*100 = +350%. Probability edge stays sane.
    assert edge < 50
    assert edge > 0


def test_continuous_line_uses_relative_cap():
    edge = model_edge_percent(
        projected=26.0,
        line=24.5,
        over_probability=0.58,
        under_probability=0.42,
        side="Over",
    )
    assert 0 < edge < 20


def test_under_lean_signed_by_probability():
    edge = model_edge_percent(
        projected=0.3,
        line=0.5,
        over_probability=0.35,
        under_probability=0.65,
        side="Under",
    )
    assert edge > 0
