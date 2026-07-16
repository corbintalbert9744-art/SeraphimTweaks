"""Unit tests for analytics engine (no network)."""

from app.analytics.engine import (
    american_to_implied,
    expected_value,
    hit_rate,
    no_vig_pair,
    research_score_from_checks,
    build_research_checks,
    streak,
    home_away_split,
)


def test_no_vig_symmetric():
    o, u = no_vig_pair(-110, -110)
    assert abs(o - 0.5) < 1e-6
    assert abs(u - 0.5) < 1e-6


def test_hit_rate():
    values = [30, 28, 25, 22, 20, 18, 15, 14, 12, 10]
    w = hit_rate(values, 20.5, "Over", 10)
    assert w.hits == 4
    assert w.samples == 10
    assert w.label == "4/10"


def test_ev_positive_on_fair_plus_price():
    # Fair ~50% at +100 should be ~0 EV; at -110 fair 50% is negative
    ev = expected_value(0.55, -110)
    assert ev > 0


def test_research_score_bounds():
    checks = build_research_checks(
        l10=hit_rate([30] * 10, 20, "Over", 10),
        l5=hit_rate([30] * 5, 20, "Over", 5),
    )
    score = research_score_from_checks(checks)
    assert 35 <= score <= 99


def test_streak_and_splits():
    values = [25, 24, 23, 10, 9]
    assert streak(values, 20, "Over") == 3
    home, away = home_away_split(values, [True, True, False, False, True], 20, "Over")
    assert home is not None and away is not None


def test_american_implied():
    assert abs(american_to_implied(-110) - (110 / 210)) < 1e-9
