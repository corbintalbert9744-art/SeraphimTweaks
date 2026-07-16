"""Process-wide PropLine daily-limit circuit breaker.

Free tier is 1,000 requests/day. Once PropLine returns daily_limit_exceeded,
stop calling the API until the next UTC day so we do not burn the remaining
quota on retries / scheduler ticks.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

_blocked_until: Optional[datetime] = None
_last_message: Optional[str] = None


def is_blocked() -> bool:
    global _blocked_until
    if _blocked_until is None:
        return False
    now = datetime.now(timezone.utc)
    if now >= _blocked_until:
        _blocked_until = None
        return False
    return True


def blocked_until() -> Optional[datetime]:
    return _blocked_until if is_blocked() else None


def last_message() -> Optional[str]:
    return _last_message if is_blocked() else None


def trip(message: str = "daily_limit_exceeded") -> None:
    """Block PropLine until the next UTC midnight (+1h buffer)."""
    global _blocked_until, _last_message
    now = datetime.now(timezone.utc)
    next_midnight = (now + timedelta(days=1)).replace(
        hour=0, minute=5, second=0, microsecond=0
    )
    _blocked_until = next_midnight
    _last_message = message


def clear() -> None:
    global _blocked_until, _last_message
    _blocked_until = None
    _last_message = None


def status() -> dict:
    until = blocked_until()
    return {
        "blocked": until is not None,
        "blockedUntil": until.isoformat() if until else None,
        "message": last_message(),
    }
