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
from app.ingestion.player_markets import prop_source_rank
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


def _round_half(value: float) -> float:
    return round(value * 2) / 2


def _hit_windows_from_values(values: list[float], *, line: float, side: str) -> list[dict[str, Any]]:
    def window(n: int, key: str, label: str) -> dict[str, Any]:
        chunk = values[:n]
        if not chunk:
            return {
                "key": key,
                "label": label,
                "average": None,
                "hitRate": 0.0,
                "hitPct": 0,
                "hits": "0/0",
            }
        hits = sum(1 for v in chunk if (v > line if side == "Over" else v < line))
        return {
            "key": key,
            "label": label,
            "average": round(mean(chunk), 1),
            "hitRate": round(hits / len(chunk), 4),
            "hitPct": int(round(100 * hits / len(chunk))),
            "hits": f"{hits}/{len(chunk)}",
        }

    return [
        window(5, "l5", "Last 5"),
        window(10, "l10", "Last 10"),
        window(20, "l20", "Last 20"),
        window(len(values) or 1, "all", "All"),
        {
            "key": "matchup",
            "label": "Matchup",
            "average": None,
            "hitRate": 0.0,
            "hitPct": 0,
            "hits": "0/0",
        },
    ]


def _research_combo_markets(
    *,
    league: str,
    player: Player,
    logs: list[PlayerGameLog],
    existing: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Fill missing basketball combo tabs from core pick'em lines + gamelogs."""
    by_label = {
        str(m.get("market") or "").strip().lower(): m
        for m in existing
        if m.get("market")
    }
    core_line = {
        label: float(by_label[label]["line"])
        for label in ("points", "rebounds", "assists")
        if label in by_label and by_label[label].get("line") is not None
    }
    wanted: list[tuple[str, tuple[str, ...]]] = [
        ("Pts+Rebs", ("points", "rebounds")),
        ("Pts+Asts", ("points", "assists")),
        ("Rebs+Asts", ("rebounds", "assists")),
        ("PRA", ("points", "rebounds", "assists")),
    ]
    out: list[dict[str, Any]] = []
    ext = player.external_id or player.id
    for market, parts in wanted:
        if market.lower() in by_label:
            continue
        values = _market_samples(logs, market)
        if len(values) < 3:
            continue
        projected = float(mean(values[:10]))
        if all(p in core_line for p in parts):
            line = _round_half(sum(core_line[p] for p in parts))
        else:
            line = _round_half(projected)
        if line <= 0:
            continue
        side = "Over" if projected >= line else "Under"
        edge = projected - line
        chart = []
        for r in logs[:12]:
            v = _log_stat_value(r, market)
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
                    "hit": float(v) > line if side == "Over" else float(v) < line,
                }
            )
        slug = market.lower().replace(" ", "")
        out.append(
            {
                "propId": f"{league.lower()}:research:{ext}:{slug}",
                "market": market,
                "side": side,
                "line": line,
                "americanOdds": -110,
                "projectedValue": round(projected, 2),
                "edgeVsLine": round(edge, 2),
                "edgePercent": round((edge / line) * 100, 2) if line else 0.0,
                "overProbability": None,
                "underProbability": None,
                "researchScore": int(by_label.get("points", {}).get("researchScore") or 70),
                "confidence": int(by_label.get("points", {}).get("confidence") or 55),
                "evPercent": 0.0,
                "explanation": [
                    f"Research {market} desk from gamelogs"
                    + (
                        f" · line estimated from PrizePicks {' + '.join(parts)}"
                        if all(p in core_line for p in parts)
                        else " · line from recent average"
                    )
                    + "."
                ],
                "why": f"{side} {line} {market}",
                "hitWindows": _hit_windows_from_values(values, line=line, side=side),
                "chartGames": chart,
                "platformLine": None,
            }
        )
    return out


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
        )
        .order_by(PropAnalytics.research_score.desc())
    )
    # Board lists stay upcoming-only; the player desk keeps platform markets even if
    # a tip just flipped to closed so combo tabs do not disappear mid-research.
    if not app:
        prop_q = prop_q.where(Prop.status == "open")
    prop_rows = list(db.execute(prop_q).all())

    if app:
        token = f":pickem:{app}:"
        scoped = [
            (prop, analytics)
            for prop, analytics in prop_rows
            if token in (prop.id or "").lower()
            or f"pickem:{app}:" in (prop.id or "").lower()
        ]
        # Prefer open rows; if the platform slate was just closed, keep closed rows.
        open_scoped = [r for r in scoped if (r[0].status or "") == "open"]
        prop_rows = open_scoped or scoped

    # Deduplicate by market — prefer selected pick'em app, then research score.
    best_by_market: dict[str, tuple[Prop, PropAnalytics]] = {}
    for prop, analytics in prop_rows:
        label = str(prop.market or "").strip()
        if not label:
            continue
        key = label.lower()
        prev = best_by_market.get(key)
        if prev is None:
            best_by_market[key] = (prop, analytics)
            continue
        prev_prop, prev_an = prev
        prev_rank = prop_source_rank(prev_prop.id or "", app)
        next_rank = prop_source_rank(prop.id or "", app)
        prev_score = float(prev_an.research_score or 0)
        next_score = float(analytics.research_score or 0)
        prev_open = 0 if (prev_prop.status or "") == "open" else 1
        next_open = 0 if (prop.status or "") == "open" else 1
        if (next_rank, next_open, -next_score) < (prev_rank, prev_open, -prev_score):
            best_by_market[key] = (prop, analytics)
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

    # When PrizePicks (etc.) only synced cores, still offer combo research tabs
    # (Pts+Rebs / Pts+Asts / Rebs+Asts / PRA) so the desk matches what athletes
    # usually have on pick'em. Prefer summing live core lines; never invent books.
    if code in {"NBA", "WNBA"} and logs:
        markets.extend(
            _research_combo_markets(
                league=code,
                player=player,
                logs=logs,
                existing=markets,
            )
        )
        markets.sort(
            key=lambda m: (
                _CORE_ORDER.index(str(m.get("market") or "").lower())
                if str(m.get("market") or "").lower() in _CORE_ORDER
                else len(_CORE_ORDER),
                str(m.get("market") or "").lower(),
            )
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
