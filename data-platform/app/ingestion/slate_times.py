"""Upcoming slate tip times — enrich pick'em boards and drop finished games.

When PropLine is rate-limited we still have warehouse props from earlier syncs.
Those often lack commence_time. For WNBA we match matchup labels to the ESPN
scoreboard (today + tomorrow) so we can show tip times and hide Final games.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx

log = logging.getLogger(__name__)

ESPN_WNBA_SCOREBOARD = (
    "https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard"
)


def _norm_team(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", " ", (name or "").lower()).strip()
    # Drop common suffixes for fuzzy contains checks
    for junk in (" wnba",):
        s = s.replace(junk, "")
    return s


def _team_tokens(name: str) -> set[str]:
    parts = [p for p in _norm_team(name).split() if len(p) > 2]
    return set(parts)


def teams_match(a: str, b: str) -> bool:
    na, nb = _norm_team(a), _norm_team(b)
    if not na or not nb:
        return False
    if na == nb or na in nb or nb in na:
        return True
    ta, tb = _team_tokens(a), _team_tokens(b)
    if not ta or not tb:
        return False
    # Share distinctive token (Fever, Valkyries, Liberty, …)
    return bool(ta & tb)


def parse_matchup_label(label: str) -> tuple[Optional[str], Optional[str]]:
    """Parse 'Away @ Home' or 'Home vs Away' style labels."""
    raw = (label or "").strip()
    if not raw or raw in {"TBD", "—"}:
        return None, None
    if " @ " in raw:
        away, home = raw.split(" @ ", 1)
        return away.strip(), home.strip()
    if " vs " in raw.lower():
        # "A vs B" — order ambiguous; treat left as team, right as opponent
        left, right = re.split(r"\s+vs\s+", raw, maxsplit=1, flags=re.I)
        return left.strip(), right.strip()
    return None, None


def fetch_wnba_schedule_window(days: int = 3) -> list[dict[str, Any]]:
    """ESPN scoreboard for today..(today+days-1) UTC calendar dates."""
    now = datetime.now(timezone.utc)
    out: list[dict[str, Any]] = []
    with httpx.Client(timeout=20.0) as client:
        for offset in range(-1, max(days, 1)):  # include yesterday (finals) + upcoming
            day = (now + timedelta(days=offset)).strftime("%Y%m%d")
            try:
                res = client.get(ESPN_WNBA_SCOREBOARD, params={"dates": day})
                res.raise_for_status()
                data = res.json()
            except Exception as exc:  # noqa: BLE001
                log.debug("espn wnba scoreboard %s: %s", day, exc)
                continue
            for event in data.get("events") or []:
                tip = event.get("date")
                tip_dt = None
                if tip:
                    try:
                        tip_dt = datetime.fromisoformat(str(tip).replace("Z", "+00:00"))
                    except ValueError:
                        tip_dt = None
                comps = (event.get("competitions") or [{}])[0]
                competitors = comps.get("competitors") or []
                home = next((c for c in competitors if c.get("homeAway") == "home"), None)
                away = next((c for c in competitors if c.get("homeAway") == "away"), None)
                home_name = ((home or {}).get("team") or {}).get("displayName") or ""
                away_name = ((away or {}).get("team") or {}).get("displayName") or ""
                status = ((event.get("status") or {}).get("type") or {})
                out.append(
                    {
                        "id": event.get("id"),
                        "commence_time": tip_dt.isoformat() if tip_dt else tip,
                        "commence_dt": tip_dt,
                        "home_team": home_name,
                        "away_team": away_name,
                        "name": event.get("name"),
                        "state": status.get("state"),  # pre|in|post
                        "description": status.get("description"),
                        "completed": bool(status.get("completed")),
                    }
                )
    return out


def match_schedule_event(
    *,
    game_label: Optional[str],
    home_team: Optional[str] = None,
    away_team: Optional[str] = None,
    schedule: list[dict[str, Any]],
) -> Optional[dict[str, Any]]:
    away, home = parse_matchup_label(game_label or "")
    if home_team:
        home = home or home_team
    if away_team:
        away = away or away_team
    if not home and not away:
        return None
    for ev in schedule:
        eh, ea = ev.get("home_team") or "", ev.get("away_team") or ""
        if home and away:
            if teams_match(home, eh) and teams_match(away, ea):
                return ev
            if teams_match(home, ea) and teams_match(away, eh):
                return ev
        elif home and (teams_match(home, eh) or teams_match(home, ea)):
            return ev
        elif away and (teams_match(away, eh) or teams_match(away, ea)):
            return ev
    return None


def is_upcoming_tip(
    tip_iso: Optional[str],
    *,
    now: Optional[datetime] = None,
    grace_minutes: int = 15,
    known_completed: bool = False,
) -> bool:
    if known_completed:
        return False
    if not tip_iso:
        return True  # unknown — keep until we can classify
    try:
        tip = datetime.fromisoformat(str(tip_iso).replace("Z", "+00:00"))
    except ValueError:
        return True
    if tip.tzinfo is None:
        tip = tip.replace(tzinfo=timezone.utc)
    ref = now or datetime.now(timezone.utc)
    return tip >= ref - timedelta(minutes=grace_minutes)


def enrich_and_filter_upcoming_props(
    props: list[dict[str, Any]],
    *,
    league: str,
    drop_unknown_when_upcoming_exist: bool = False,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Attach tip times (WNBA via ESPN) and keep upcoming slate only."""
    code = (league or "").upper()
    meta: dict[str, Any] = {"enriched": 0, "droppedFinished": 0, "scheduleSource": None}
    schedule: list[dict[str, Any]] = []
    if code == "WNBA":
        schedule = fetch_wnba_schedule_window(3)
        meta["scheduleSource"] = "espn-wnba"

    enriched: list[dict[str, Any]] = []
    for row in props:
        tip = row.get("tipTime") or row.get("commenceTime")
        completed = False
        if schedule:
            ev = match_schedule_event(
                game_label=str(row.get("game") or ""),
                home_team=str(row.get("team") or "") if False else None,
                schedule=schedule,
            )
            if ev:
                if ev.get("commence_time") and not tip:
                    tip = ev["commence_time"]
                    meta["enriched"] += 1
                elif ev.get("commence_time"):
                    tip = tip or ev["commence_time"]
                completed = bool(ev.get("completed")) or (ev.get("state") == "post")
                if ev.get("away_team") and ev.get("home_team"):
                    row = {
                        **row,
                        "game": f"{ev['away_team']} @ {ev['home_team']}",
                    }
        row = {**row, "tipTime": tip, "commenceTime": tip or row.get("commenceTime")}
        row["_completed"] = completed
        enriched.append(row)

    upcoming = [
        r
        for r in enriched
        if is_upcoming_tip(r.get("tipTime"), known_completed=bool(r.get("_completed")))
    ]
    meta["droppedFinished"] = len(enriched) - len(upcoming)

    # If we successfully classified tips and have a future slate, drop unknown-tip leftovers
    classified = [r for r in upcoming if r.get("tipTime")]
    if drop_unknown_when_upcoming_exist and classified:
        unknowns = [r for r in upcoming if not r.get("tipTime")]
        upcoming = classified
        meta["droppedUnknown"] = len(unknowns)

    for r in upcoming:
        r.pop("_completed", None)

    # Sort soonest tip first
    def sort_key(r: dict[str, Any]) -> tuple:
        t = r.get("tipTime")
        try:
            dt = datetime.fromisoformat(str(t).replace("Z", "+00:00")) if t else None
        except ValueError:
            dt = None
        return (0 if dt else 1, dt or datetime.max.replace(tzinfo=timezone.utc))

    upcoming.sort(key=sort_key)
    return upcoming, meta


def format_gamelog_time(played_at: datetime) -> Optional[str]:
    """Human tip/start time for a gamelog row; None when only a date is known."""
    if played_at is None:
        return None
    dt = played_at
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    # Midnight-only dates (MLB hitting logs) have no real tip clock
    if dt.hour == 0 and dt.minute == 0 and dt.second == 0:
        return None
    return dt.strftime("%I:%M %p").lstrip("0")


def format_gamelog_date(played_at: datetime) -> str:
    return played_at.strftime("%b %d")
