"""Tests for pick'em platform board filtering."""

from types import SimpleNamespace
from unittest.mock import MagicMock

from app.ingestion.platform_board import (
    apply_pickem_platform_filter,
    normalize_pickem_app,
    slugs_for_app,
)


def test_normalize_pickem_app_aliases():
    assert normalize_pickem_app("PrizePicks") == "prizepicks"
    assert normalize_pickem_app("underdog-fantasy") == "underdog"
    assert normalize_pickem_app("UD") == "underdog"
    assert normalize_pickem_app("Sleeper") == "sleeper"
    assert normalize_pickem_app("other") == "other"
    assert normalize_pickem_app("") is None


def test_slugs_for_apps():
    assert slugs_for_app("prizepicks") == frozenset({"prizepicks"})
    assert "parlayplay" in slugs_for_app("other")
    assert "dabble" in slugs_for_app("other")


def test_filter_keeps_only_selected_platform():
    props = [
        {
            "id": "p1",
            "playerId": "a",
            "player": "Alice",
            "team": "AAA",
            "opponent": "BBB",
            "position": "G",
            "market": "Points",
            "side": "Over",
            "line": 20.5,
            "projectedValue": 22.0,
            "confidence": 70,
            "edgeVsLine": 1.5,
        },
        {
            "id": "p2",
            "playerId": "b",
            "player": "Bob",
            "team": "CCC",
            "opponent": "DDD",
            "position": "F",
            "market": "Rebounds",
            "side": "Under",
            "line": 8.5,
            "projectedValue": 7.0,
            "confidence": 60,
            "edgeVsLine": -1.5,
        },
    ]

    book_pp = SimpleNamespace(id="sb-pp", slug="prizepicks", name="PrizePicks")
    book_ud = SimpleNamespace(id="sb-ud", slug="underdog", name="Underdog")
    odds_pp = SimpleNamespace(
        prop_id="p1",
        sportsbook_id="sb-pp",
        line=21.5,
        american_odds=-110,
        side="Over",
        is_mock=False,
        provider="propline",
        captured_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
    )
    odds_ud = SimpleNamespace(
        prop_id="p2",
        sportsbook_id="sb-ud",
        line=8.0,
        american_odds=-115,
        side="Under",
        is_mock=False,
        provider="propline",
        captured_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
    )

    db = MagicMock()

    def execute(stmt):
        # Return both odds rows; filter uses Sportsbook.slug
        result = MagicMock()
        result.all.return_value = [(odds_pp, book_pp), (odds_ud, book_ud)]
        return result

    db.execute.side_effect = execute

    scoped = apply_pickem_platform_filter(db, props, "prizepicks")
    assert scoped["platform"] == "prizepicks"
    assert len(scoped["props"]) == 1
    row = scoped["props"][0]
    assert row["id"] == "p1"
    assert row["line"] == 21.5  # platform line, not generic 20.5
    assert row["edgePercent"] is not None
    assert row["platformSlug"] == "prizepicks"
    # Bob (underdog-only) must not appear
    assert all(p["id"] != "p2" for p in scoped["props"])
    assert len(scoped["players"]) == 1
    assert scoped["players"][0]["id"] == "a"


def test_filter_empty_when_no_platform_odds():
    props = [
        {
            "id": "p1",
            "playerId": "a",
            "player": "Alice",
            "market": "Points",
            "side": "Over",
            "line": 20.5,
            "projectedValue": 22.0,
            "confidence": 70,
        }
    ]
    db = MagicMock()
    result = MagicMock()
    result.all.return_value = []
    db.execute.return_value = result

    scoped = apply_pickem_platform_filter(db, props, "sleeper")
    assert scoped["props"] == []
    assert scoped["note"]
    assert "Sleeper" in scoped["note"]
