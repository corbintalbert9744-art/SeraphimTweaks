"""Player desk market helpers — cores + combo coverage."""

from app.ingestion.player_markets import (
    COMBO_MARKETS,
    dedupe_market_rows,
    markets_look_sparse,
    prop_source_rank,
)


def test_prop_source_rank_prefers_selected_pickem():
    assert prop_source_rank("wnba:pickem:prizepicks:x:points", "prizepicks") == 0
    assert prop_source_rank("wnba:pickem:sleeper:x:points", "prizepicks") == 2
    assert prop_source_rank("wnba:prop:x:points", "prizepicks") == 3


def test_dedupe_keeps_prizepicks_over_duplicates():
    rows = [
        {"id": "wnba:prop:1:points", "market": "Points", "line": 20, "researchScore": 99},
        {"id": "wnba:pickem:prizepicks:1:points", "market": "Points", "line": 17.5, "researchScore": 80},
        {"id": "wnba:pickem:prizepicks:1:pts+rebs", "market": "Pts+Rebs", "line": 21.5},
    ]
    out = dedupe_market_rows(rows, prefer_platform="prizepicks", id_key="id")
    by = {r["market"]: r for r in out}
    assert by["Points"]["line"] == 17.5
    assert "Pts+Rebs" in by


def test_sparse_ignores_research_only_combos():
    assert markets_look_sparse(
        [
            {"propId": "wnba:pickem:prizepicks:1:points", "market": "Points"},
            {"propId": "wnba:pickem:prizepicks:1:rebounds", "market": "Rebounds"},
            {"propId": "wnba:research:1:pra", "market": "PRA"},
        ]
    )
    assert not markets_look_sparse(
        [
            {"propId": "wnba:pickem:prizepicks:1:points", "market": "Points"},
            {"propId": "wnba:pickem:prizepicks:1:pts+rebs", "market": "Pts+Rebs"},
        ]
    )
    assert "PRA" in COMBO_MARKETS
