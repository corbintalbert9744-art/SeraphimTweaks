"""Serve Cursor-exported PrizePicks board snapshots when live sync is empty.

Local Cursor often has a warm PropLine cache; Render free-tier can be rate-limited
with a cold warehouse. Seed JSON under ``data-platform/seed/`` keeps the member
board looking like the Cursor desk until live lines resume.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional

log = logging.getLogger(__name__)

SEED_DIR = Path(__file__).resolve().parents[2] / "seed"

_LEAGUE_FILE = {
    "WNBA": "wnba_prizepicks_board.json",
    "NBA": "nba_prizepicks_board.json",
    "NFL": "nfl_prizepicks_board.json",
    "MLB": "mlb_prizepicks_board.json",
    "NHL": "nhl_prizepicks_board.json",
    "ATP": "atp_prizepicks_board.json",
    "WTA": "wta_prizepicks_board.json",
    "SOCCER": "soccer_prizepicks_board.json",
}


def load_cursor_board_seed(league: str, platform: str = "prizepicks") -> Optional[dict[str, Any]]:
    """Return a board payload from seed JSON, or None if missing/unusable."""
    app = (platform or "prizepicks").strip().lower()
    if app not in ("prizepicks", "pp"):
        return None
    code = (league or "").strip().upper()
    filename = _LEAGUE_FILE.get(code)
    if not filename:
        return None
    path = SEED_DIR / filename
    if not path.is_file():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        log.warning("cursor seed read failed %s: %s", path.name, exc)
        return None
    props = raw.get("props") or []
    if not props:
        return None
    players = raw.get("players") or []
    label = raw.get("platformLabel") or "PrizePicks"
    return {
        "ok": True,
        "league": raw.get("league") or code,
        "platform": "prizepicks",
        "platformLabel": label,
        "props": props,
        "players": players,
        "count": len(props),
        "teams": raw.get("teams"),
        "markets": raw.get("markets"),
        "live": True,
        "cached": True,
        "fallback": True,
        "fallbackSource": "cursor-seed",
        "source": "cursor-seed",
        "dataSource": "cursor-seed",
        "rateLimited": False,
        "requiresApiKey": False,
        "error": None,
        "note": None,
        "disclaimer": raw.get("disclaimer"),
    }
