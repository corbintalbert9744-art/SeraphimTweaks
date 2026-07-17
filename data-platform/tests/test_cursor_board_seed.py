from app.ingestion.cursor_board_seed import load_cursor_board_seed


def test_load_wnba_cursor_seed():
    seed = load_cursor_board_seed("WNBA", "prizepicks")
    assert seed is not None
    assert seed["count"] == 187
    assert len(seed["props"]) == 187
    assert seed["source"] == "cursor-seed"
    assert seed["rateLimited"] is False


def test_load_seed_ignores_other_platform():
    assert load_cursor_board_seed("WNBA", "underdog") is None
