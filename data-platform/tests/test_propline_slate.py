"""PropLine adapter helpers — upcoming slate selection + rate-limit circuit."""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.providers.base import ProviderRateLimitError
from app.providers.propline import rate_limit as propline_rate_limit
from app.providers.propline.adapter import (
    PropLineAdapter,
    _parse_target_day,
    _select_upcoming_events,
)


def test_select_upcoming_prefers_target_day():
    frozen = datetime(2026, 7, 16, 12, 0, tzinfo=timezone.utc)
    events = [
        {"id": 1, "commence_time": "2026-07-16T18:00:00Z"},
        {"id": 2, "commence_time": "2026-07-17T00:10:00Z"},
        {"id": 3, "commence_time": "2026-07-17T23:00:00Z"},
        {"id": 4, "commence_time": "2026-07-20T18:00:00Z"},
    ]
    target = _parse_target_day("2026-07-17")

    class _FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            return frozen if tz is None else frozen.astimezone(tz)

    with patch("app.providers.propline.adapter.datetime", _FrozenDateTime):
        selected = _select_upcoming_events(
            events, limit=3, horizon_hours=48, target_day=target
        )
    ids = [e["id"] for e in selected]
    assert ids == [2, 3, 1]
    assert 4 not in ids


def test_select_upcoming_filters_horizon():
    now = datetime.now(timezone.utc)
    near = (now + timedelta(hours=6)).strftime("%Y-%m-%dT%H:%M:%SZ")
    far = (now + timedelta(days=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
    events = [
        {"id": "near", "commence_time": near},
        {"id": "far", "commence_time": far},
    ]
    selected = _select_upcoming_events(events, limit=10, horizon_hours=48)
    ids = [e["id"] for e in selected]
    assert "near" in ids
    assert "far" not in ids


def test_rate_limit_circuit_trips_and_blocks_adapter():
    propline_rate_limit.clear()
    try:
        adapter = PropLineAdapter(api_key="test-key")
        with patch("httpx.Client") as Client:
            client = MagicMock()
            Client.return_value.__enter__.return_value = client
            res = MagicMock(status_code=429)
            res.json.return_value = {
                "detail": {
                    "error": "daily_limit_exceeded",
                    "message": "Daily limit of 1,000 requests exceeded.",
                }
            }
            res.text = "rate"
            client.get.return_value = res
            with pytest.raises(ProviderRateLimitError):
                adapter._get("/sports")
        assert propline_rate_limit.is_blocked()
        with pytest.raises(ProviderRateLimitError):
            adapter.fetch_pickem_prop_odds("MLB", platforms={"prizepicks"})
    finally:
        propline_rate_limit.clear()
