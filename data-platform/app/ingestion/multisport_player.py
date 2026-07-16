"""Multi-sport player research profiles from warehouse gamelogs + pick'em props."""

from __future__ import annotations

from statistics import mean
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Player, PlayerGameLog, Prop, PropAnalytics
from app.ingestion.pickem_platform_sync import _market_samples
from app.ingestion.platform_board import normalize_pickem_app
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


def _peer_player_ids(db: Session, player: Player) -> list[str]:
    """Same athlete may have ESPN + pick'em stub rows — gather all ids."""
    ids = {player.id}
    name = (player.full_name or "").strip().lower()
    if not name:
        return list(ids)
    for peer in db.execute(
        select(Player).where(Player.league == player.league)
    ).scalars():
        if (peer.full_name or "").strip().lower() == name:
            ids.add(peer.id)
    return list(ids)


def _log_stat_value(row: PlayerGameLog, market: str) -> Optional[float]:
    samples = _market_samples([row], market)
    return samples[0] if samples else None


def get_multisport_player_profile(
    db: Session,
    *,
    league: str,
    player_key: str,
    platform: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    """Build a PlayerPage-compatible profile (flat markets list).

    When ``platform`` is set (prizepicks / underdog / sleeper), only that app's
    open pick'em props are listed — every market PrizePicks (etc.) has for the
    athlete, not a Points/Rebounds subset.
    """
    code = normalize_league(league)
    app = normalize_pickem_app(platform) if platform else None
    player = _find_player(db, code, player_key)
    if not player:
        return None

    peer_ids = _peer_player_ids(db, player)

    logs = list(
        db.execute(
            select(PlayerGameLog)
            .where(PlayerGameLog.player_id.in_(peer_ids))
            .order_by(PlayerGameLog.played_at.desc())
            .limit(40)
        )
        .scalars()
        .all()
    )

    prop_q = (
        select(Prop, PropAnalytics)
        .join(PropAnalytics, PropAnalytics.prop_id == Prop.id)
        .where(
            Prop.player_id.in_(peer_ids),
            Prop.league == code,
            Prop.status == "open",
        )
        .order_by(PropAnalytics.research_score.desc())
    )
    prop_rows = list(db.execute(prop_q).all())

    if app:
        token = f":pickem:{app}:"
        prop_rows = [
            (prop, analytics)
            for prop, analytics in prop_rows
            if token in (prop.id or "").lower()
            or f"pickem:{app}:" in (prop.id or "").lower()
        ]

    # Deduplicate by market — keep highest research-score row per market label.
    best_by_market: dict[str, tuple[Prop, PropAnalytics]] = {}
    for prop, analytics in prop_rows:
        label = str(prop.market or "").strip()
        if not label:
            continue
        prev = best_by_market.get(label.lower())
        if prev is None or (analytics.research_score or 0) >= (prev[1].research_score or 0):
            best_by_market[label.lower()] = (prop, analytics)
    prop_rows = list(best_by_market.values())
    # Stable desk order: cores → combos → everything else alphabetical
    _CORE_ORDER = (
        "points",
        "rebounds",
        "assists",
        "threes",
        "steals",
        "blocks",
        "turnovers",
        "fantasy score",
        "pts+rebs",
        "pts+asts",
        "rebs+asts",
        "pra",
        "steals+blocks",
        "blocks+rebs",
        "asts+tos",
        "double double",
        "triple double",
    )

    def _sort_key(item: tuple[Prop, PropAnalytics]) -> tuple[int, str]:
        label = str(item[0].market or "").lower()
        try:
            return (_CORE_ORDER.index(label), label)
        except ValueError:
            return (len(_CORE_ORDER), label)

    prop_rows.sort(key=_sort_key)

    markets: list[dict[str, Any]] = []
    for prop, analytics in prop_rows:
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
                "overProbability": analytics.over_probability,
                "underProbability": analytics.under_probability,
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

    if not markets:
        return None

    recent = []
    for r in logs[:12]:
        tip_time = format_gamelog_time(r.played_at)
        stats: dict[str, float] = {}
        if r.points is not None:
            stats["pts"] = float(r.points)
        if r.rebounds is not None:
            stats["reb"] = float(r.rebounds)
        if r.assists is not None:
            stats["ast"] = float(r.assists)
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

    primary = markets[0]
    name = player.full_name or "Player"
    initials = "".join(part[0] for part in name.split()[:2] if part).upper() or "?"
    board_href = {
        "MLB": "/mlb",
        "NHL": "/nhl",
        "Soccer": "/soccer",
        "NBA": "/nba",
        "WNBA": "/wnba",
        "NFL": "/nfl",
        "ATP": "/tennis",
        "WTA": "/tennis",
    }.get(code, f"/{code.lower()}")

    # Flat PlayerResearchProfile shape (not nested under "player")
    return {
        "id": player.external_id or player.id,
        "name": name,
        "league": code,
        "team": "—",
        "opponent": "TBD",
        "position": player.position or "",
        "initials": initials,
        "injury": "None",
        "tipTime": "",
        "researchScore": int(primary["researchScore"]),
        "dataQualityScore": 70,
        "aiExplain": {
            "verdict": "neutral",
            "headline": (
                primary["explanation"][0]
                if primary.get("explanation")
                else f"{code} model lean"
            ),
            "body": (
                f"All open {app or 'board'} markets for {name} with Seraphim projections."
            ),
        },
        "matchup": {
            "title": "Upcoming slate",
            "defenseRank": f"{app or 'Live'} pick'em" if app else "Live board",
            "bullets": [
                f"{len(markets)} markets listed"
                + (f" on {app}" if app else ""),
                f"{primary['market']} {primary['side']} {primary['line']}",
            ],
        },
        "homeSplit": {"label": "Home", "samples": 0, "averages": {}},
        "awaySplit": {"label": "Away", "samples": 0, "averages": {}},
        "recentLogs": recent,
        "markets": markets,
        "boardHref": board_href,
        "live": True,
        "platform": app,
    }
