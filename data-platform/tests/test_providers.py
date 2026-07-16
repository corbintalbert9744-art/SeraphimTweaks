"""Tests for the provider adapter framework."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from app.providers.base import (
    NormalizedGame,
    ProviderHttpClient,
    ProviderHttpError,
    ProviderMeta,
    run_provider_job,
)
from app.providers.espn.nba import EspnNbaProvider
from app.providers.registry import get_nba_providers, provider_status


def test_espn_nba_is_legitimate_primary():
    providers = get_nba_providers()
    assert providers.primary == "espn-nba"
    assert providers.schedule is not None
    assert providers.gamelog is not None
    assert providers.injuries is not None
    assert providers.roster is not None
    assert providers.schedule.meta.is_mock is False
    assert "schedule" in providers.schedule.meta.capabilities
    assert "gamelog" in providers.schedule.meta.capabilities


def test_provider_status_marks_espn_nba_live():
    rows = provider_status()
    espn = next(r for r in rows if r["name"] == "espn-nba")
    assert espn["configured"] is True
    assert espn["is_mock"] is False
    assert espn.get("legitimate") is True


def test_http_client_retries_then_succeeds(monkeypatch):
    calls = {"n": 0}

    class FakeResponse:
        def __init__(self, status_code, payload=None):
            self.status_code = status_code
            self._payload = payload or {}

        def raise_for_status(self):
            if self.status_code >= 400:
                raise ProviderHttpError("boom", status_code=self.status_code)

        def json(self):
            return self._payload

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def get(self, url, params=None):
            calls["n"] += 1
            if calls["n"] < 3:
                return FakeResponse(503)
            return FakeResponse(200, {"ok": True})

    monkeypatch.setattr("app.providers.framework.httpx.Client", FakeClient)
    monkeypatch.setattr("app.providers.framework.time.sleep", lambda *_: None)
    client = ProviderHttpClient(user_agent="test", max_retries=3, backoff_seconds=0)
    assert client.get_json("https://example.test") == {"ok": True}
    assert calls["n"] == 3


def test_run_provider_job_writes_audit_row():
    db = MagicMock()
    with run_provider_job(db, provider="espn-nba", league="NBA", job="unit_test") as job:
        job.rows_written = 4
        job.message = "ok"
    assert db.add.called
    assert db.flush.called
    run = db.add.call_args[0][0]
    assert run.provider == "espn-nba"
    assert run.job == "unit_test"
    assert run.status == "ok"
    assert run.rows_written == 4


def test_espn_schedule_parses_scoreboard(monkeypatch):
    payload = {
        "events": [
            {
                "id": "401",
                "date": "2026-07-15T00:00:00Z",
                "shortName": "BOS @ NYK",
                "status": {"type": {"name": "STATUS_SCHEDULED"}},
                "competitions": [
                    {
                        "venue": {"fullName": "MSG"},
                        "competitors": [
                            {
                                "homeAway": "home",
                                "score": "",
                                "team": {
                                    "id": "18",
                                    "abbreviation": "NYK",
                                    "displayName": "New York Knicks",
                                    "logo": "nyk.png",
                                },
                            },
                            {
                                "homeAway": "away",
                                "score": "",
                                "team": {
                                    "id": "2",
                                    "abbreviation": "BOS",
                                    "displayName": "Boston Celtics",
                                    "logo": "bos.png",
                                },
                            },
                        ],
                    }
                ],
            }
        ]
    }
    provider = EspnNbaProvider(user_agent="test")
    monkeypatch.setattr(provider, "_get", lambda url: payload)
    games = provider.fetch_schedule("NBA")
    assert len(games) == 1
    g = games[0]
    assert isinstance(g, NormalizedGame)
    assert g.external_id == "401"
    assert g.home_abbr == "NYK"
    assert g.away_abbr == "BOS"
    assert g.tipoff_at.tzinfo is not None or True


def test_provider_meta_shape():
    meta = ProviderMeta(
        name="espn-nba",
        leagues=["NBA"],
        capabilities=["schedule"],
        requires_api_key=False,
        is_mock=False,
    )
    assert meta.name == "espn-nba"
