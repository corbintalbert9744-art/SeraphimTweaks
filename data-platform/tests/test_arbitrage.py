"""Arbitrage finder unit tests."""

from app.analytics.arbitrage import (
    BookSideQuote,
    build_arb,
    find_best_arb,
    quotes_from_comparison_books,
)
from app.analytics.engine import american_to_implied


def test_arb_exists_when_implied_sum_below_one():
    # +110 / +110 → each implied ~0.476 → sum ~0.952 → ~5% arb
    over = BookSideQuote("FanDuel", "fanduel", 24.5, "Over", 110)
    under = BookSideQuote("DraftKings", "draftkings", 24.5, "Under", 110)
    opp = build_arb(over=over, under=under, total_stake=100)
    assert opp is not None
    assert opp.profit_pct > 4
    assert abs(opp.stake_over + opp.stake_under - 100) < 0.02
    assert opp.expected_return > 100
    assert opp.over_book == "FanDuel"
    assert opp.under_book == "DraftKings"


def test_no_arb_at_standard_juice():
    over = BookSideQuote("FanDuel", "fanduel", 24.5, "Over", -110)
    under = BookSideQuote("DraftKings", "draftkings", 24.5, "Under", -110)
    assert build_arb(over=over, under=under) is None
    assert american_to_implied(-110) * 2 > 1


def test_line_mismatch_rejected():
    over = BookSideQuote("FanDuel", "fanduel", 24.5, "Over", 120)
    under = BookSideQuote("DraftKings", "draftkings", 25.5, "Under", 120)
    assert build_arb(over=over, under=under) is None


def test_find_best_picks_lowest_implied():
    quotes = [
        BookSideQuote("A", "a", 10.5, "Over", -105),
        BookSideQuote("B", "b", 10.5, "Over", 115),  # better over
        BookSideQuote("C", "c", 10.5, "Under", -110),
        BookSideQuote("D", "d", 10.5, "Under", 110),  # better under
    ]
    best = find_best_arb(quotes, total_stake=100)
    assert best is not None
    assert best.over_slug == "b"
    assert best.under_slug == "d"
    assert best.profit_pct > 0


def test_skips_pickem_and_placeholders():
    books = [
        {
            "book": "PrizePicks",
            "slug": "prizepicks",
            "kind": "pickem",
            "line": 20.5,
            "over": -110,
            "under": -110,
            "requiresIntegration": False,
            "isMock": False,
            "connected": True,
        },
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
            "book": "FanDuel",
            "slug": "fanduel",
            "kind": "sportsbook",
            "line": 20.5,
            "over": 105,
            "under": -120,
            "requiresIntegration": False,
            "isMock": False,
            "connected": True,
            "sourceProvider": "the-odds-api",
        },
    ]
    quotes = quotes_from_comparison_books(books)
    assert all(q.slug != "prizepicks" for q in quotes)
    assert all(q.slug != "caesars" for q in quotes)
    assert any(q.slug == "fanduel" and q.side == "Over" for q in quotes)
