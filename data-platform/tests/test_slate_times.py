"""Upcoming slate tip matching + finished-game filter."""

from datetime import datetime, timedelta, timezone

from app.ingestion.slate_times import (
    enrich_and_filter_upcoming_props,
    format_gamelog_time,
    is_upcoming_tip,
    match_schedule_event,
    parse_matchup_label,
    teams_match,
)


def test_parse_matchup_and_team_match():
    away, home = parse_matchup_label("Golden State Valkyries @ Indiana Fever")
    assert away and "Valkyries" in away
    assert home and "Fever" in home
    assert teams_match("Indiana Fever", "Indiana Fever")
    assert teams_match("Fever", "Indiana Fever")


def test_match_schedule_event_finds_tip():
    schedule = [
        {
            "home_team": "Indiana Fever",
            "away_team": "Golden State Valkyries",
            "commence_time": "2026-07-16T00:00:00+00:00",
            "completed": True,
            "state": "post",
        },
        {
            "home_team": "Washington Mystics",
            "away_team": "Portland Fire",
            "commence_time": "2026-07-16T23:00:00+00:00",
            "completed": False,
            "state": "pre",
        },
    ]
    ev = match_schedule_event(
        game_label="Portland Fire @ Washington Mystics", schedule=schedule
    )
    assert ev is not None
    assert ev["commence_time"].startswith("2026-07-16T23:00")


def test_enrich_drops_finished_wnba_props(monkeypatch):
    schedule = [
        {
            "home_team": "Indiana Fever",
            "away_team": "Golden State Valkyries",
            "commence_time": "2026-07-16T00:00:00+00:00",
            "completed": True,
            "state": "post",
        },
        {
            "home_team": "Washington Mystics",
            "away_team": "Portland Fire",
            "commence_time": (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat(),
            "completed": False,
            "state": "pre",
        },
    ]
    monkeypatch.setattr(
        "app.ingestion.slate_times.fetch_wnba_schedule_window",
        lambda days=3: schedule,
    )
    props = [
        {"id": "a", "game": "Golden State Valkyries @ Indiana Fever", "player": "A"},
        {"id": "b", "game": "Portland Fire @ Washington Mystics", "player": "B"},
    ]
    filtered, meta = enrich_and_filter_upcoming_props(props, league="WNBA")
    assert meta["droppedFinished"] == 1
    assert len(filtered) == 1
    assert filtered[0]["id"] == "b"
    assert filtered[0]["tipTime"]


def test_is_upcoming_and_format_time():
    now = datetime(2026, 7, 16, 12, 0, tzinfo=timezone.utc)
    assert is_upcoming_tip("2026-07-16T23:00:00+00:00", now=now)
    assert not is_upcoming_tip("2026-07-16T00:00:00+00:00", now=now, known_completed=True)
    assert format_gamelog_time(datetime(2026, 7, 13, 23, 0, tzinfo=timezone.utc)) == "11:00 PM"
    assert format_gamelog_time(datetime(2026, 7, 13, 0, 0, tzinfo=timezone.utc)) is None
