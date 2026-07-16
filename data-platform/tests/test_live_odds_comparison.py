"""Live Odds Comparison — catalog adapters + line-diff annotations."""

from datetime import datetime, timezone

from app.ingestion.comparison_books import _annotate_line_diffs
from app.providers.base import NormalizedOddsQuote
from app.providers.comparison_lines import (
    CANONICAL_LINE_PROVIDERS,
    CatalogComparisonLinesProvider,
    normalize_book_slug,
)


def test_canonical_catalog_includes_major_books():
    slugs = {s.slug for s in CANONICAL_LINE_PROVIDERS}
    for expected in (
        "prizepicks",
        "underdog",
        "fanduel",
        "draftkings",
        "betmgm",
        "caesars",
        "fanatics",
        "espnbet",
    ):
        assert expected in slugs


def test_slug_aliases():
    assert normalize_book_slug("williamhill_us") == "caesars"
    assert normalize_book_slug("espn_bet") == "espnbet"
    assert normalize_book_slug("FanDuel") == "fanduel"


def test_quote_lines_marks_live_and_unavailable():
    now = datetime.now(timezone.utc)
    live = [
        NormalizedOddsQuote(
            league="WNBA",
            player_external_id="1",
            player_name="Test Player",
            market="Points",
            side="Over",
            line=18.5,
            american_odds=-110,
            sportsbook_slug="prizepicks",
            sportsbook_name="PrizePicks",
            captured_at=now,
            is_mock=False,
            source_provider="propline",
        ),
        NormalizedOddsQuote(
            league="WNBA",
            player_external_id="1",
            player_name="Test Player",
            market="Points",
            side="Over",
            line=19.5,
            american_odds=-115,
            sportsbook_slug="draftkings",
            sportsbook_name="DraftKings",
            captured_at=now,
            is_mock=False,
            source_provider="the-odds-api",
        ),
    ]
    rows = CatalogComparisonLinesProvider().quote_lines(
        league="WNBA",
        player_name="Test Player",
        player_external_id="1",
        market="Points",
        baseline_line=18.5,
        projected_value=20.0,
        live_quotes=live,
    )
    by_slug = {r.slug: r for r in rows}
    assert by_slug["prizepicks"].requires_integration is False
    assert by_slug["prizepicks"].line == 18.5
    assert by_slug["prizepicks"].captured_at == now
    assert by_slug["draftkings"].requires_integration is False
    assert by_slug["caesars"].requires_integration is True


def test_annotate_line_diffs_highlights_best_and_disagreement():
    books = [
        {
            "book": "PrizePicks",
            "line": 18.5,
            "requiresIntegration": False,
            "edgeVsProjection": 1.5,
            "capturedAt": "2026-07-16T12:00:00+00:00",
        },
        {
            "book": "DraftKings",
            "line": 19.5,
            "requiresIntegration": False,
            "edgeVsProjection": 0.5,
            "capturedAt": "2026-07-16T12:05:00+00:00",
        },
        {
            "book": "Caesars",
            "line": 18.5,
            "requiresIntegration": True,
            "edgeVsProjection": 0,
            "capturedAt": None,
        },
    ]
    meta = _annotate_line_diffs(books, model_side="Over")
    assert meta["linesDiffer"] is True
    assert meta["bestLineBook"] == "PrizePicks"
    assert meta["linesUpdatedAt"] == "2026-07-16T12:05:00+00:00"
    assert books[0]["isBestValue"] is True
    assert books[1]["lineDiffFromConsensus"] is not None
