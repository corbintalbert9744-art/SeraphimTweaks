"""Multi-sport player research profiles from warehouse gamelogs + pick'em props."""

from __future__ import annotations

from statistics import mean
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Player, PlayerGameLog, Prop, PropAnalytics
from app.ingestion.pickem_platform_sync import _market_samples
from app.ingestion.slate_times import format_gamelog_date, format_gamelog_time
from app.providers.propline.markets import normalize_league


def _find_player(db: Session, league: str, player_key: str) -> Optional[Player]:
    code = normalize_league(league)
    key = str(player_key)
    row = db.get(Player, key)
    if row and row.league == code:
        return row
    for cand in (
        key,
        f"{code.lower()}:player:{key}",
        key.split(":")[-1] if ":" in key else key,
    ):
        row = db.execute(
            select(Player).where(Player.league == code, Player.external_id == cand)
        ).scalar_one_or_none()
        if row:
            return row
        row = db.get(Player, cand)
        if row and row.league == code:
            return row
    # Name fallback
    soft = [
        p
        for p in db.execute(select(Player).where(Player.league == code)).scalars().all()
        if (p.full_name or "").lower() == key.lower()
        or (p.external_id or "") == key
        or p.id.endswith(f":{key}")
    ]
    return soft[0] if soft else None


def _log_stat_value(row: PlayerGameLog, market: str) -> Optional[float]:
    samples = _market_samples([row], market)
    return samples[0] if samples else None


def get_multisport_player_profile(
    db: Session, *, league: str, player_key: str
) -> Optional[dict[str, Any]]:
    """Build a PlayerPage-compatible profile for MLB/NHL/etc pick'em players."""
    code = normalize_league(league)
    player = _find_player(db, code, player_key)
    if not player:
        return None

    logs = list(
        db.execute(
            select(PlayerGameLog)
            .where(PlayerGameLog.player_id == player.id)
            .order_by(PlayerGameLog.played_at.desc())
            .limit(40)
        )
        .scalars()
        .all()
    )

    props = (
        db.execute(
            select(Prop, PropAnalytics)
            .join(PropAnalytics, PropAnalytics.prop_id == Prop.id)
            .where(
                Prop.player_id == player.id,
                Prop.league == code,
                Prop.status == "open",
            )
            .order_by(PropAnalytics.research_score.desc())
        )
        .all()
    )

    markets: list[dict[str, Any]] = []
    for prop, analytics in props:
        values = _market_samples(logs, prop.market)
        chart = []
        for r in logs[:12]:
            v = _log_stat_value(r, prop.market)
            if v is None:
                continue
            tip_time = format_gamelog_time(r.played_at)
            chart.append(
                {
                    "date": format_gamelog_date(r.played_at),
                    "time": tip_time,
                    "playedAt": r.played_at.isoformat() if r.played_at else None,
                    "label": format_gamelog_date(r.played_at)
                    + (f" {tip_time}" if tip_time else ""),
                    "opponent": r.opponent or "OPP",
                    "home": bool(r.home),
                    "value": float(v),
                    "minutes": float(r.minutes or 0),
                    "hit": (float(v) > float(prop.line))
                    if prop.side == "Over"
                    else (float(v) < float(prop.line)),
                }
            )
        projected = analytics.projected_value
        edge = analytics.edge_vs_line
        line = float(prop.line)
        markets.append(
            {
                "propId": prop.id,
                "market": prop.market,
                "side": prop.side,
                "line": line,
                "americanOdds": -110,
                "projectedValue": float(projected) if projected is not None else line,
                "edgeVsLine": float(edge) if edge is not None else 0.0,
                "edgePercent": (
                    round((float(edge) / line) * 100, 2)
                    if edge is not None and abs(line) > 1e-9
                    else 0.0
                ),
                "researchScore": int(analytics.research_score or 0),
                "confidence": int(analytics.confidence_score or 0),
                "evPercent": float(analytics.ev_percent or 0),
                "explanation": analytics.explain_bullets or [],
                "why": f"{prop.side} {prop.line} {prop.market}",
                "hitWindows": [
                    {
                        "key": "l5",
                        "label": "Last 5",
                        "average": mean(values[:5]) if values else None,
                        "hitRate": float(analytics.l5_rate or 0),
                        "hitPct": int(round((analytics.l5_rate or 0) * 100)),
                        "hits": f"{analytics.l5_hits or 0}/{analytics.l5_samples or 0}",
                    },
                    {
                        "key": "l10",
                        "label": "Last 10",
                        "average": mean(values[:10]) if values else None,
                        "hitRate": float(analytics.l10_rate or 0),
                        "hitPct": int(round((analytics.l10_rate or 0) * 100)),
                        "hits": f"{analytics.l10_hits or 0}/{analytics.l10_samples or 0}",
                    },
                    {
                        "key": "l20",
                        "label": "Last 20",
                        "average": mean(values[:20]) if values else None,
                        "hitRate": float(analytics.l20_rate or 0),
                        "hitPct": int(round((analytics.l20_rate or 0) * 100)),
                        "hits": f"{analytics.l20_hits or 0}/{analytics.l20_samples or 0}",
                    },
                    {
                        "key": "all",
                        "label": "All",
                        "average": mean(values) if values else None,
                        "hitRate": float(analytics.season_rate or 0),
                        "hitPct": int(round((analytics.season_rate or 0) * 100)),
                        "hits": f"{analytics.season_hits or 0}/{analytics.season_samples or 0}",
                    },
                    {
                        "key": "matchup",
                        "label": "Matchup",
                        "average": None,
                        "hitRate": 0,
                        "hitPct": 0,
                        "hits": "0/0",
                    },
                ],
                "chartGames": chart,
            }
        )

    recent = []
    for r in logs[:12]:
        tip_time = format_gamelog_time(r.played_at)
        stats: dict[str, float] = {}
        if r.points is not None:
            stats["pts"] = float(r.points)
        if isinstance(r.raw, dict):
            for label, key in (
                ("H", "hits"),
                ("R", "runs"),
                ("RBI", "rbi"),
                ("BB", "baseOnBalls"),
                ("SO", "strikeOuts"),
                ("TB", "totalBases"),
            ):
                if r.raw.get(key) is not None:
                    try:
                        stats[label] = float(r.raw[key])
                    except (TypeError, ValueError):
                        pass
        recent.append(
            {
                "date": format_gamelog_date(r.played_at),
                "time": tip_time,
                "playedAt": r.played_at.isoformat() if r.played_at else None,
                "opponent": r.opponent or "OPP",
                "home": bool(r.home),
                "stats": stats or {"pts": float(r.points or 0)},
                "minutesOrSnaps": float(r.minutes or 0),
            }
        )

    primary = markets[0] if markets else None
    name = player.full_name or "Player"
    initials = "".join(part[0] for part in name.split()[:2] if part).upper() or "?"
    board_href = {
        "MLB": "/mlb",
        "NHL": "/nhl",
        "Soccer": "/soccer",
        "NBA": "/nba",
        "WNBA": "/wnba",
        "NFL": "/nfl",
    }.get(code, f"/{code.lower()}")

    return {
        "ok": True,
        "live": True,
        "player": {
            "id": player.external_id or player.id,
            "name": name,
            "league": code,
            "team": "—",
            "opponent": "TBD",
            "position": player.position or "",
            "initials": initials,
            "injury": "None",
            "tipTime": "",
            "researchScore": int(primary["researchScore"]) if primary else 0,
            "dataQualityScore": 70,
            "aiExplain": {
                "verdict": "neutral",
                "headline": (
                    primary["explanation"][0]
                    if primary and primary.get("explanation")
                    else f"{code} model lean"
                ),
                "body": f"Warehouse gamelogs + Seraphim projection for {name}.",
            },
            "matchup": {
                "title": "Upcoming slate",
                "defenseRank": "Live pick'em",
                "bullets": [
                    f"{primary['market']} {primary['side']} {primary['line']}"
                    if primary
                    else "Open a prop on the board"
                ],
            },
            "homeSplit": {"label": "Home", "samples": 0, "averages": {}},
            "awaySplit": {"label": "Away", "samples": 0, "averages": {}},
            "recentLogs": recent,
            "markets": markets,
            "boardHref": board_href,
        },
    }
