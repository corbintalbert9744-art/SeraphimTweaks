"""Positive Expected Value (+EV) engine unit tests."""

from app.analytics.plus_ev import (
    PLUS_EV_THRESHOLD,
    enrich_prop_with_plus_ev,
    evaluate_prop_markets,
    evaluate_side_at_line,
    sort_plus_ev_props,
)


def test_plus_ev_when_model_beats_market():
    # Strong over lean vs soft line at −110 should clear +EV threshold
    row = evaluate_side_at_line(
        projected=24.0,
        line=20.0,
        side="Over",
        sigma=3.0,
        american=-110,
        book="DraftKings",
        slug="draftkings",
        kind="sportsbook",
    )
    assert row.model_edge == 4.0
    assert row.model_probability > 0.55
    assert row.implied_probability is not None
    assert row.expected_value is not None
    assert row.expected_value >= PLUS_EV_THRESHOLD
    assert row.is_plus_ev is True


def test_negative_edge_not_plus_ev():
    row = evaluate_side_at_line(
        projected=18.0,
        line=22.0,
        side="Over",
        sigma=3.0,
        american=-110,
        book="FanDuel",
        slug="fanduel",
        kind="sportsbook",
    )
    assert row.model_edge < 0
    assert row.is_plus_ev is False


def test_skips_unavailable_books():
    evals = evaluate_prop_markets(
        projected=22.0,
        sigma=3.0,
        books=[
            {
                "book": "Caesars",
                "slug": "caesars",
                "kind": "sportsbook",
                "line": 20.5,
                "over": -110,
                "under": -110,
                "requiresIntegration": True,
                "isMock": True,
            },
            {
                "book": "PrizePicks",
                "slug": "prizepicks",
                "kind": "pickem",
                "line": 20.5,
                "over": -110,
                "under": -110,
                "requiresIntegration": False,
                "isMock": False,
            },
        ],
        platform_line=20.5,
        platform_side="Over",
        platform_book="PrizePicks",
        platform_slug="prizepicks",
        platform_kind="pickem",
    )
    slugs = {e.slug for e in evals}
    assert "caesars" not in slugs
    assert "prizepicks" in slugs


def test_enrich_and_sort():
    props = [
        enrich_prop_with_plus_ev(
            {
                "id": "wnba:pickem:prizepicks:a:points",
                "player": "A",
                "line": 18.5,
                "side": "Over",
                "projectedValue": 22.0,
                "americanOdds": -110,
                "platform": "prizepicks",
                "platformName": "PrizePicks",
                "confidence": 70,
                "researchScore": 80,
                "residualSigma": 2.5,
            }
        ),
        enrich_prop_with_plus_ev(
            {
                "id": "wnba:pickem:prizepicks:b:points",
                "player": "B",
                "line": 25.0,
                "side": "Over",
                "projectedValue": 25.2,
                "americanOdds": -110,
                "platform": "prizepicks",
                "platformName": "PrizePicks",
                "confidence": 90,
                "researchScore": 95,
                "residualSigma": 2.5,
            }
        ),
    ]
    by_ev = sort_plus_ev_props(props, sort_by="ev")
    assert by_ev[0]["player"] == "A"  # larger edge → higher EV
    by_conf = sort_plus_ev_props(props, sort_by="confidence")
    assert by_conf[0]["player"] == "B"
