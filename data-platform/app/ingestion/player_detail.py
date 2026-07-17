"""Shared player-detail loader: platform markets + refresh when combos are missing."""

from __future__ import annotations

import logging
from typing import Any, Callable, Optional

from sqlalchemy.orm import Session

from app.ingestion.multisport_player import get_multisport_player_profile
from app.ingestion.pickem_platform_sync import ensure_pickem_platform_board
from app.ingestion.player_markets import markets_look_sparse
from app.ingestion.platform_board import normalize_pickem_app

log = logging.getLogger(__name__)


def _safe_ensure_board(
    db: Session, *, league: str, platform: str, refresh: bool
) -> None:
    try:
        ensure_pickem_platform_board(db, league=league, platform=platform, refresh=refresh)
    except Exception as exc:  # noqa: BLE001
        log.warning(
            "pick'em board ensure failed league=%s platform=%s refresh=%s: %s",
            league,
            platform,
            refresh,
            exc,
        )
        try:
            db.rollback()
        except Exception:  # noqa: BLE001
            pass


def load_platform_player_profile(
    db: Session,
    *,
    league: str,
    player_id: str,
    platform: Optional[str],
    fallback: Optional[Callable[[], Optional[dict[str, Any]]]] = None,
) -> tuple[Optional[dict[str, Any]], Optional[str]]:
    """Return ``(profile, normalized_platform)``.

    When a pick'em app is selected, sync that board and list every market the app
    has for the athlete (Points, Rebounds, PRA, Pts+Rebs, …). If the first pass
    only has core markets, force one live refresh so newly listed PrizePicks
    combos appear on the desk.
    """
    app = normalize_pickem_app(platform) if platform else None
    profile: Optional[dict[str, Any]] = None

    if app:
        _safe_ensure_board(db, league=league, platform=app, refresh=False)
        profile = get_multisport_player_profile(
            db, league=league, player_key=player_id, platform=app
        )
        markets = (profile or {}).get("markets") or []
        if markets_look_sparse(markets):
            _safe_ensure_board(db, league=league, platform=app, refresh=True)
            profile = get_multisport_player_profile(
                db, league=league, player_key=player_id, platform=app
            )
        if profile and (profile.get("markets") or []):
            return profile, app

    if fallback is not None:
        try:
            profile = fallback()
        except Exception as exc:  # noqa: BLE001
            log.warning("player profile fallback failed: %s", exc)
            try:
                db.rollback()
            except Exception:  # noqa: BLE001
                pass
            profile = None
    if not profile or not (profile.get("markets") or []):
        profile = get_multisport_player_profile(
            db, league=league, player_key=player_id, platform=app
        )
    return profile, app
