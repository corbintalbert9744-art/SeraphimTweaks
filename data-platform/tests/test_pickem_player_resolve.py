"""Tests for ESPN athlete search + pick'em matchup / player resolution helpers."""

from unittest.mock import MagicMock, patch

from app.ingestion.pickem_platform_sync import (
    _team_opponent_from_matchup_note,
    _espn_name_cache,
)
from app.providers.base import NormalizedPlayer
from app.providers.espn.search import search_espn_athlete


def setup_function():
    _espn_name_cache.clear()


def test_matchup_note_parses_away_at_home():
    team, opp = _team_opponent_from_matchup_note("Portland Fire @ Washington Mystics")
    assert team == "Portland Fire"
    assert opp == "Washington Mystics"


def test_matchup_note_tbd():
    assert _team_opponent_from_matchup_note(None) == ("—", "TBD")
    assert _team_opponent_from_matchup_note("TBD") == ("—", "TBD")


def test_espn_search_filters_league():
    payload = {
        "items": [
            {
                "id": "1",
                "type": "player",
                "league": "nba",
                "displayName": "Bridget Carleton",
            },
            {
                "id": "3906972",
                "type": "player",
                "league": "wnba",
                "displayName": "Bridget Carleton",
                "shortName": "B. Carleton",
            },
        ]
    }
    http = MagicMock()
    http.get_json.return_value = payload
    found = search_espn_athlete("Bridget Carleton", league="WNBA", http=http)
    assert found is not None
    assert found.external_id == "3906972"
    assert found.league == "WNBA"


def test_lookup_uses_espn_when_no_db_peer():
    from app.ingestion.pickem_platform_sync import _lookup_provider_external_id

    db = MagicMock()
    db.execute.return_value.scalars.return_value.all.return_value = []
    with patch(
        "app.providers.espn.search.search_espn_athlete",
        return_value=NormalizedPlayer(
            external_id="3906972",
            league="WNBA",
            full_name="Bridget Carleton",
        ),
    ):
        ext = _lookup_provider_external_id(db, league="WNBA", name="Bridget Carleton")
    assert ext == "3906972"
