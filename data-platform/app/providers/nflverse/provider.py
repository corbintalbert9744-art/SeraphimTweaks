"""NFLVerse / nfl_data_py adapter — free NFL play-by-play and roster data.

Package: ``nfl_data_py`` (NFLVerse ecosystem). No API key.
Falls back if package missing — ESPN NFL remains primary.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from app.providers.base import NormalizedGamelog, NormalizedPlayer, NormalizedTeam, ProviderMeta

log = logging.getLogger(__name__)

try:
    import nfl_data_py as nfl

    _NFLVERSE_AVAILABLE = True
except ImportError:  # pragma: no cover
    nfl = None  # type: ignore
    _NFLVERSE_AVAILABLE = False


class NflverseProvider:
    meta = ProviderMeta(
        name="nflverse",
        leagues=["NFL"],
        capabilities=["roster", "gamelog", "team_stats", "slate"],
        requires_api_key=False,
        is_mock=False,
        notes=(
            "Free NFLVerse data via nfl_data_py (rosters, weekly stats). "
            "Install: pip install nfl_data_py. No API key. "
            "ESPN NFL remains the schedule/injury primary until parity is complete."
        ),
        homepage="https://github.com/nflverse/nfldata",
    )

    def __init__(self, seasons: Optional[list[int]] = None) -> None:
        self.seasons = seasons or [datetime.now(timezone.utc).year]
        self._available = _NFLVERSE_AVAILABLE

    @property
    def available(self) -> bool:
        return self._available

    def fetch_teams(self, league: str = "NFL") -> list[NormalizedTeam]:
        if not self._available or league.upper() != "NFL":
            return []
        try:
            df = nfl.import_team_desc()
        except Exception as exc:  # noqa: BLE001
            log.warning("nflverse teams failed: %s", exc)
            return []
        out: list[NormalizedTeam] = []
        for _, row in df.iterrows():
            abbr = str(row.get("team_abbr") or "")
            if not abbr:
                continue
            out.append(
                NormalizedTeam(
                    external_id=abbr,
                    league="NFL",
                    abbreviation=abbr,
                    name=str(row.get("team_name") or abbr),
                    city=str(row.get("team_nick") or "") or None,
                    logo_url=str(row.get("team_logo_espn") or "") or None,
                )
            )
        return out

    def fetch_rosters(self, league: str = "NFL") -> list[NormalizedPlayer]:
        if not self._available or league.upper() != "NFL":
            return []
        try:
            df = nfl.import_seasonal_rosters(self.seasons)
        except Exception as exc:  # noqa: BLE001
            log.warning("nflverse rosters failed: %s", exc)
            return []
        out: list[NormalizedPlayer] = []
        for _, row in df.head(800).iterrows():
            pid = str(row.get("gsis_id") or row.get("player_id") or "")
            name = str(row.get("player_name") or row.get("full_name") or "")
            if not pid or not name:
                continue
            out.append(
                NormalizedPlayer(
                    external_id=pid,
                    league="NFL",
                    full_name=name,
                    team_external_id=str(row.get("team") or "") or None,
                    position=str(row.get("position") or "") or None,
                    jersey=str(row.get("jersey_number") or "") or None,
                    headshot_url=str(row.get("headshot_url") or "") or None,
                )
            )
        return out

    def fetch_weekly_stats(self, league: str = "NFL", weeks: Optional[list[int]] = None) -> list[NormalizedGamelog]:
        """Weekly fantasy-relevant stats → gamelog-shaped rows (raw holds NFL metrics)."""
        if not self._available or league.upper() != "NFL":
            return []
        try:
            df = nfl.import_weekly_data(self.seasons)
        except Exception as exc:  # noqa: BLE001
            log.warning("nflverse weekly failed: %s", exc)
            return []
        if weeks:
            df = df[df["week"].isin(weeks)]
        out: list[NormalizedGamelog] = []
        for _, row in df.tail(500).iterrows():
            pid = str(row.get("player_id") or row.get("gsis_id") or "")
            if not pid:
                continue
            season = int(row.get("season") or self.seasons[0])
            week = int(row.get("week") or 0)
            try:
                played = datetime(season, 9, 1, tzinfo=timezone.utc)
            except ValueError:
                played = datetime.now(timezone.utc)
            out.append(
                NormalizedGamelog(
                    player_external_id=pid,
                    league="NFL",
                    played_at=played,
                    opponent=str(row.get("opponent_team") or "OPP"),
                    home=str(row.get("recent_team") or "") != "",
                    game_external_id=f"{season}-W{week}-{pid}",
                    minutes=None,
                    points=_f(row.get("fantasy_points_ppr")),
                    raw={
                        "source": "nflverse",
                        "week": week,
                        "season": season,
                        "passing_yards": _f(row.get("passing_yards")),
                        "rushing_yards": _f(row.get("rushing_yards")),
                        "receiving_yards": _f(row.get("receiving_yards")),
                        "receptions": _f(row.get("receptions")),
                        "passing_tds": _f(row.get("passing_tds")),
                        "position": row.get("position"),
                    },
                )
            )
        return out


def _f(v: Any) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def nflverse_installed() -> bool:
    return _NFLVERSE_AVAILABLE
