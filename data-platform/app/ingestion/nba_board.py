"""NBA board ingest + warehouse serializers for live frontend.

Builds a multi-player prop board from ESPN schedule → roster/leaders →
gamelogs → Seraphim prediction engine. Sportsbook lines are comparison-only.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from statistics import mean
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.engine import expected_value, home_away_split, rest_days, streak
from app.analytics.factors.base import PredictionContext
from app.analytics.prediction import predict_prop
from app.config import get_settings
from app.db.models import Game, Injury, Odds, Player, PlayerGameLog, Prop, PropAnalytics, Sportsbook, Team
from app.ingestion.nba_pipeline import _market_values, _run_log
from app.ingestion.warehouse import (
    insert_odds,
    upsert_game,
    upsert_gamelog,
    upsert_injury,
    upsert_player,
    upsert_prop,
)
from app.providers.base import NormalizedGame, NormalizedPlayer
from app.providers.mock.odds import MockOddsProvider
from app.providers.registry import get_nba_providers

log = logging.getLogger(__name__)

MARKETS_FOR_BOARD = ("Points", "Rebounds", "Assists")


def _team_abbr(db: Session, team_id: Optional[str]) -> str:
    if not team_id:
        return "TEAM"
    t = db.get(Team, team_id)
    return t.abbreviation if t else "TEAM"


def _injury_bucket(status: str) -> str:
    s = (status or "None").lower()
    if s in ("none", "healthy", "active", ""):
        return "None"
    if "probable" in s:
        return "Probable"
    return "Questionable"


def _build_one_prop(
    db: Session,
    *,
    game: NormalizedGame,
    athlete: NormalizedPlayer,
    market: str,
    injury_status: str,
) -> Optional[dict[str, Any]]:
    providers = get_nba_providers()
    assert providers.gamelog

    team_id = f"nba:team:{athlete.team_external_id}" if athlete.team_external_id else None
    player = upsert_player(db, athlete, team_id=team_id)
    gamelogs = providers.gamelog.fetch_gamelog("NBA", athlete.external_id)
    for gl in gamelogs:
        upsert_gamelog(db, gl, player.id)
    db.flush()

    logs = (
        db.execute(
            select(PlayerGameLog)
            .where(PlayerGameLog.player_id == player.id)
            .order_by(PlayerGameLog.played_at.desc())
            .limit(40)
        )
        .scalars()
        .all()
    )
    values = _market_values(logs, market)
    if len(values) < 5:
        return None

    is_home = athlete.team_external_id == game.home_team_external_id
    opp_abbr = game.away_abbr if is_home else game.home_abbr
    team_abbr = game.home_abbr if is_home else game.away_abbr
    matchup = f"vs {opp_abbr} at home" if is_home else f"@ {opp_abbr}"

    point_logs = logs  # already newest-first
    homes = [bool(r.home) for r in point_logs[: len(values)]]
    minutes = [r.minutes for r in point_logs[: len(values)]]
    played_at = [r.played_at for r in point_logs[: len(values)]]

    ctx = PredictionContext(
        league="NBA",
        market=market,
        values=values,
        homes=homes if len(homes) == len(values) else [True] * len(values),
        played_at=played_at if len(played_at) == len(values) else [datetime.now(timezone.utc)] * len(values),
        minutes=minutes,
        injury_status=injury_status,
        is_home=is_home,
        opponent_abbr=opp_abbr,
    )
    comparison_line = round(mean(values[:10]) * 2) / 2
    prediction = predict_prop(ctx, comparison_line=comparison_line)
    side = "Over" if prediction.projected_value >= comparison_line else "Under"
    line = comparison_line

    quotes = MockOddsProvider().quote_for_prop(
        league="NBA",
        player_name=player.full_name,
        player_external_id=athlete.external_id,
        market=market,
        line=line,
        game_external_id=game.external_id,
    )
    odds_are_mock = True
    odds_provider = providers.odds
    if odds_provider is not None and not hasattr(odds_provider, "quote_for_prop"):
        try:
            live = [
                q
                for q in odds_provider.fetch_player_prop_odds("NBA")  # type: ignore[union-attr]
                if q.market == market and player.full_name.lower() in q.player_name.lower()
            ]
            if live:
                quotes = live
                odds_are_mock = False
                comparison_line = float(live[0].line)
                prediction = predict_prop(ctx, comparison_line=comparison_line)
                line = comparison_line
                side = "Over" if prediction.projected_value >= comparison_line else "Under"
        except Exception as exc:  # noqa: BLE001
            log.warning("board odds live failed: %s", exc)

    game_row = db.get(Game, f"nba:game:{game.external_id}")
    prop = upsert_prop(
        db,
        league="NBA",
        game_id=game_row.id if game_row else None,
        player_id=player.id,
        market=market,
        side=side,
        line=line,
    )
    db.flush()
    for q in quotes:
        insert_odds(db, q, prop.id)

    over_odds = next((q.american_odds for q in quotes if q.side == "Over"), -110)
    model_side = prediction.over_probability if side == "Over" else prediction.under_probability
    ev = expected_value(model_side, over_odds if side == "Over" else next((q.american_odds for q in quotes if q.side == "Under"), -110))

    l5, l10, l20, season = prediction.l5, prediction.l10, prediction.l20, prediction.season
    assert l5 and l10 and l20 and season
    home_rate, away_rate = home_away_split(values, ctx.homes, line, side)
    rest = rest_days(ctx.played_at)
    stk = streak(values, line, side)

    existing = db.execute(select(PropAnalytics).where(PropAnalytics.prop_id == prop.id)).scalar_one_or_none()
    if not existing:
        existing = PropAnalytics(id=str(uuid.uuid4()), prop_id=prop.id, league="NBA")
        db.add(existing)
    existing.l5_hits, existing.l5_samples, existing.l5_rate = l5.hits, l5.samples, l5.rate
    existing.l10_hits, existing.l10_samples, existing.l10_rate = l10.hits, l10.samples, l10.rate
    existing.l20_hits, existing.l20_samples, existing.l20_rate = l20.hits, l20.samples, l20.rate
    existing.season_hits, existing.season_samples, existing.season_rate = season.hits, season.samples, season.rate
    existing.home_rate = home_rate
    existing.away_rate = away_rate
    existing.rest_days = rest
    existing.streak = stk
    existing.no_vig_prob = prediction.over_probability
    existing.ev_percent = round(ev, 2)
    existing.research_score = prediction.research_score
    existing.confidence_score = prediction.confidence_score
    existing.data_quality_score = prediction.data_quality_score
    existing.projected_value = prediction.projected_value
    existing.over_probability = prediction.over_probability
    existing.under_probability = prediction.under_probability
    existing.comparison_line = comparison_line
    existing.edge_vs_line = prediction.edge_vs_line
    existing.residual_sigma = prediction.residual_sigma
    existing.model_version = prediction.model_version
    existing.factor_breakdown = prediction.to_api_dict()["factorBreakdown"]
    existing.influential_factors = prediction.influential_factors
    existing.matchup_note = matchup
    existing.explain_bullets = prediction.explanation
    existing.why_payload = {
        "headline": f"Model projects {prediction.projected_value:.1f} {market}",
        "verdict": "solid",
        "pillars": [],
        "influentialFactors": prediction.influential_factors,
    }
    existing.checks = []
    existing.is_model_estimate = True
    existing.odds_are_mock = odds_are_mock
    existing.disclaimer = get_settings().model_disclaimer
    existing.computed_at = datetime.now(timezone.utc)
    db.flush()

    proj_min = mean([m for m in minutes if m is not None][:5]) if any(minutes) else 32.0

    return {
        "id": prop.id,
        "playerId": athlete.external_id,
        "playerWarehouseId": player.id,
        "player": player.full_name,
        "team": team_abbr,
        "opponent": opp_abbr,
        "position": player.position or "G",
        "market": market,
        "side": side,
        "line": line,
        "americanOdds": over_odds if side == "Over" else -110,
        "noVigProb": round(prediction.over_probability if side == "Over" else prediction.under_probability, 4),
        "evPercent": round(ev, 2),
        "confidence": prediction.confidence_score,
        "researchScore": prediction.research_score,
        "dqs": prediction.data_quality_score,
        "l5": l5.label,
        "l10": l10.label,
        "l20": l20.label,
        "season": season.label,
        "tipTime": game.tipoff_at.isoformat(),
        "projectedMinutes": round(proj_min, 1),
        "injury": _injury_bucket(injury_status),
        "projectedValue": round(prediction.projected_value, 2),
        "overProbability": round(prediction.over_probability, 4),
        "underProbability": round(prediction.under_probability, 4),
        "comparisonLine": comparison_line,
        "edgeVsLine": round(prediction.edge_vs_line, 2) if prediction.edge_vs_line is not None else None,
        "modelVersion": prediction.model_version,
        "isModelEstimate": True,
        "oddsAreMock": odds_are_mock,
        "oddsRole": "comparison-only",
        "explanation": prediction.explanation,
        "influentialFactors": prediction.influential_factors,
        "headshot": player.headshot_url,
        "matchupNote": matchup,
    }


def import_nba_slate(
    db: Session,
    *,
    date: Optional[str] = None,
    max_games: int = 4,
    per_team: int = 2,
    markets: tuple[str, ...] = ("Points",),
) -> dict[str, Any]:
    """Full NBA slate: schedule → teams/players → gamelogs → injuries → props."""
    providers = get_nba_providers()
    assert providers.schedule and providers.featured

    games = providers.schedule.fetch_schedule("NBA", date)
    for g in games:
        upsert_game(db, g)
    db.flush()

    built: list[dict[str, Any]] = []
    players_touched = 0
    injuries_n = 0

    for game in games[:max_games]:
        injury_map: dict[str, str] = {}
        if providers.injuries:
            for inj in providers.injuries.fetch_injuries("NBA", game.external_id):
                upsert_injury(db, inj)
                injuries_n += 1
                if inj.player_external_id:
                    injury_map[inj.player_external_id] = inj.status

        athletes = []
        if hasattr(providers.featured, "pick_slate_athletes"):
            athletes = providers.featured.pick_slate_athletes(game.external_id, per_team=per_team)  # type: ignore[union-attr]
        else:
            feat = providers.featured.pick_featured_athlete(game.external_id)
            if feat:
                athletes = [feat]

        for athlete in athletes:
            players_touched += 1
            status = injury_map.get(athlete.external_id, "None")
            for market in markets:
                try:
                    row = _build_one_prop(
                        db,
                        game=game,
                        athlete=athlete,
                        market=market,
                        injury_status=status,
                    )
                    if row:
                        built.append(row)
                except Exception:
                    log.exception("slate prop failed %s %s", athlete.full_name, market)

    _run_log(
        db,
        provider="espn-nba+model",
        job="import_slate",
        status="ok",
        rows=len(built),
        message=f"games={min(len(games), max_games)} players={players_touched} injuries={injuries_n}",
    )
    db.flush()
    return {
        "ok": True,
        "games": min(len(games), max_games),
        "players": players_touched,
        "props": len(built),
        "injuries": injuries_n,
        "board": built,
    }


def list_nba_props_from_warehouse(db: Session) -> list[dict[str, Any]]:
    rows = (
        db.execute(
            select(Prop, PropAnalytics, Player)
            .join(PropAnalytics, PropAnalytics.prop_id == Prop.id)
            .outerjoin(Player, Player.id == Prop.player_id)
            .where(Prop.league == "NBA")
            .order_by(PropAnalytics.research_score.desc())
        )
        .all()
    )
    out: list[dict[str, Any]] = []
    for prop, analytics, player in rows:
        game = db.get(Game, prop.game_id) if prop.game_id else None
        team_abbr = _team_abbr(db, player.team_id if player else None)
        opp = "OPP"
        tip = datetime.now(timezone.utc).isoformat()
        if game:
            tip = game.tipoff_at.isoformat()
            home = _team_abbr(db, game.home_team_id)
            away = _team_abbr(db, game.away_team_id)
            if player and player.team_id == game.home_team_id:
                team_abbr = home
                opp = away
            else:
                team_abbr = away if player and player.team_id == game.away_team_id else team_abbr
                opp = home

        # Latest injury for player
        injury = "None"
        if player:
            inj = (
                db.execute(
                    select(Injury)
                    .where(Injury.player_id == player.id)
                    .order_by(Injury.reported_at.desc())
                    .limit(1)
                )
                .scalar_one_or_none()
            )
            if inj:
                injury = _injury_bucket(inj.status)

        odds_row = (
            db.execute(select(Odds).where(Odds.prop_id == prop.id).order_by(Odds.captured_at.desc()).limit(1))
            .scalar_one_or_none()
        )
        american = odds_row.american_odds if odds_row else -110

        logs = []
        if player:
            logs = (
                db.execute(
                    select(PlayerGameLog)
                    .where(PlayerGameLog.player_id == player.id)
                    .order_by(PlayerGameLog.played_at.desc())
                    .limit(10)
                )
                .scalars()
                .all()
            )
        mins = [r.minutes for r in logs if r.minutes is not None]
        proj_min = round(mean(mins[:5]), 1) if mins else 32.0

        out.append(
            {
                "id": prop.id,
                "playerId": (player.external_id if player and player.external_id else (player.id if player else "")),
                "playerWarehouseId": player.id if player else None,
                "player": player.full_name if player else "Player",
                "team": team_abbr,
                "opponent": opp,
                "position": (player.position if player else None) or "G",
                "market": prop.market,
                "side": prop.side,
                "line": prop.line,
                "americanOdds": american,
                "noVigProb": analytics.over_probability
                if prop.side == "Over"
                else analytics.under_probability or analytics.no_vig_prob or 0.5,
                "evPercent": analytics.ev_percent or 0,
                "confidence": analytics.confidence_score or 50,
                "researchScore": analytics.research_score or 50,
                "dqs": analytics.data_quality_score or 50,
                "l5": f"{analytics.l5_hits or 0}/{analytics.l5_samples or 0}",
                "l10": f"{analytics.l10_hits or 0}/{analytics.l10_samples or 0}",
                "l20": f"{analytics.l20_hits or 0}/{analytics.l20_samples or 0}",
                "season": f"{analytics.season_hits or 0}/{analytics.season_samples or 0}",
                "tipTime": tip,
                "projectedMinutes": proj_min,
                "injury": injury,
                "projectedValue": analytics.projected_value,
                "overProbability": analytics.over_probability,
                "underProbability": analytics.under_probability,
                "comparisonLine": analytics.comparison_line,
                "edgeVsLine": analytics.edge_vs_line,
                "modelVersion": analytics.model_version,
                "isModelEstimate": True,
                "oddsAreMock": analytics.odds_are_mock,
                "oddsRole": "comparison-only",
                "explanation": analytics.explain_bullets or [],
                "influentialFactors": analytics.influential_factors or [],
                "headshot": player.headshot_url if player else None,
                "matchupNote": analytics.matchup_note,
            }
        )
    return out


def get_nba_prop_detail(db: Session, prop_id: str) -> Optional[dict[str, Any]]:
    board = {p["id"]: p for p in list_nba_props_from_warehouse(db)}
    base = board.get(prop_id)
    if not base:
        return None
    analytics = db.execute(select(PropAnalytics).where(PropAnalytics.prop_id == prop_id)).scalar_one_or_none()
    odds = db.execute(select(Odds).where(Odds.prop_id == prop_id).order_by(Odds.captured_at.desc())).scalars().all()
    by_book: dict[str, dict] = {}
    for o in odds:
        book = db.get(Sportsbook, o.sportsbook_id)
        name = book.name if book else "Book"
        slot = by_book.setdefault(
            name,
            {"book": name, "line": o.line, "over": -110, "under": -110, "isMock": o.is_mock},
        )
        # Odds rows are comparison quotes for the prop side; mirror for the opposite.
        american = o.american_odds if o.american_odds is not None else -110
        if base.get("side") == "Under":
            slot["under"] = american
            slot["over"] = -110 if american <= -100 else -round(abs(american) * 0.92)
        else:
            slot["over"] = american
            slot["under"] = -110 if american <= -100 else -round(abs(american) * 0.92)
        slot["line"] = o.line
        slot["isMock"] = o.is_mock
    books = list(by_book.values()) or [
        {
            "book": "DraftKings",
            "line": base["line"],
            "over": base["americanOdds"] if base.get("side") == "Over" else -110,
            "under": base["americanOdds"] if base.get("side") == "Under" else -110,
            "isMock": True,
        }
    ]

    line = base["line"]
    movement = [
        {"label": "Open", "line": line + 0.5, "odds": -110},
        {"label": "AM", "line": line, "odds": -110},
        {"label": "Now", "line": line, "odds": base["americanOdds"]},
    ]

    return {
        **base,
        "league": "NBA",
        "noVigOpposite": round(1 - float(base.get("noVigProb") or 0.5), 4),
        "why": (analytics.why_payload or {}).get("headline") if analytics else base.get("matchupNote"),
        "checks": analytics.checks if analytics and analytics.checks else [],
        "books": books,
        "movement": movement,
        "analysis": analytics.explain_bullets if analytics else [],
        "opponentDefense": {
            "rank": 15,
            "of": 30,
            "label": f"vs {base['opponent']}",
            "note": base.get("matchupNote")
            or "Matchup rankings fill as team_stats land in the warehouse.",
        },
        "similarPropIds": [p["id"] for p in board.values() if p["id"] != prop_id][:4],
        "prediction": {
            "projectedValue": base.get("projectedValue"),
            "overProbability": base.get("overProbability"),
            "underProbability": base.get("underProbability"),
            "influentialFactors": base.get("influentialFactors"),
            "modelVersion": base.get("modelVersion"),
            "disclaimer": analytics.disclaimer if analytics else get_settings().model_disclaimer,
        },
    }


def _player_card_from_props(props: list[dict[str, Any]], player_ext_id: str) -> Optional[dict[str, Any]]:
    mine = [p for p in props if p.get("playerId") == player_ext_id]
    if not mine:
        return None
    top = max(mine, key=lambda p: p.get("researchScore") or 0)
    name = top["player"]
    initials = "".join(part[0] for part in name.split()[:2]).upper()
    # Season avg from Points prop recent — approximate via projected for pts/reb/ast props
    pts = next((p.get("projectedValue") for p in mine if p["market"] == "Points"), None)
    reb = next((p.get("projectedValue") for p in mine if p["market"] == "Rebounds"), None)
    ast = next((p.get("projectedValue") for p in mine if p["market"] == "Assists"), None)
    return {
        "id": player_ext_id,
        "name": name,
        "team": top["team"],
        "opponent": top["opponent"],
        "position": top["position"],
        "headshotInitials": initials or "NB",
        "projectedMinutes": top.get("projectedMinutes") or 32,
        "seasonAvg": {
            "pts": round(float(pts or 0), 1),
            "reb": round(float(reb or 0), 1),
            "ast": round(float(ast or 0), 1),
        },
        "topPropId": top["id"],
        "confidence": top.get("confidence") or 50,
        "matchupNote": top.get("matchupNote") or f"vs {top['opponent']}",
        "headshot": top.get("headshot"),
    }


def list_nba_player_cards(db: Session) -> list[dict[str, Any]]:
    props = list_nba_props_from_warehouse(db)
    seen: set[str] = set()
    cards = []
    for p in props:
        pid = p.get("playerId")
        if not pid or pid in seen:
            continue
        seen.add(pid)
        card = _player_card_from_props(props, pid)
        if card:
            cards.append(card)
    return cards


def _split_averages(logs: list[PlayerGameLog], *, home: bool) -> dict[str, Any]:
    subset = [r for r in logs if bool(r.home) is home]
    pts = [float(r.points) for r in subset if r.points is not None]
    reb = [float(r.rebounds) for r in subset if r.rebounds is not None]
    ast = [float(r.assists) for r in subset if r.assists is not None]
    return {
        "label": "Home" if home else "Away",
        "samples": len(subset),
        "averages": {
            "pts": round(mean(pts), 1) if pts else 0.0,
            "reb": round(mean(reb), 1) if reb else 0.0,
            "ast": round(mean(ast), 1) if ast else 0.0,
        },
    }


def _points_streak(logs: list[PlayerGameLog], line: float) -> list[dict[str, Any]]:
    """Derive a simple over/under streak vs the primary points line."""
    if not logs or line <= 0:
        return []
    streak_len = 0
    over = None
    for r in logs:
        if r.points is None:
            break
        hit_over = float(r.points) > line
        if over is None:
            over = hit_over
            streak_len = 1
            continue
        if hit_over == over:
            streak_len += 1
        else:
            break
    if streak_len < 2:
        return []
    tone = "hot" if over else "cold"
    side = "Over" if over else "Under"
    return [
        {
            "label": f"{streak_len}-game {side} streak",
            "detail": f"Points {side.lower()} {line} in last {streak_len} logged games.",
            "tone": tone,
        }
    ]


def get_nba_player_profile(db: Session, player_key: str) -> Optional[dict[str, Any]]:
    """Accept ESPN external id or warehouse id. Shape matches frontend PlayerProfile."""
    player = db.execute(
        select(Player).where(
            (Player.external_id == player_key)
            | (Player.id == player_key)
            | (Player.id == f"nba:player:{player_key}")
        )
    ).scalar_one_or_none()

    board_props = list_nba_props_from_warehouse(db)

    if not player:
        card = _player_card_from_props(board_props, player_key)
        if not card:
            return None
        mine = [p for p in board_props if p.get("playerId") == player_key]
        chart_line = float(mine[0]["line"]) if mine else float(card["seasonAvg"].get("pts") or 0)
        return {
            "id": player_key,
            "name": card["name"],
            "league": "NBA",
            "team": card["team"],
            "opponent": card["opponent"],
            "position": card["position"],
            "initials": card["headshotInitials"],
            "injury": "None",
            "injuryNote": "No injury designation in warehouse.",
            "tipTime": mine[0].get("tipTime") if mine else "Tonight",
            "projectedWorkload": f"{card['projectedMinutes']} min",
            "bio": "Live profile assembled from ESPN gamelogs + Seraphim model.",
            "seasonAverages": card["seasonAvg"],
            "hitRates": [
                {
                    "market": p["market"],
                    "line": p["line"],
                    "side": p["side"],
                    "l5": p["l5"],
                    "l10": p["l10"],
                    "l20": p["l20"],
                    "season": p["season"],
                }
                for p in mine
            ],
            "homeSplit": {"label": "Home", "samples": 0, "averages": card["seasonAvg"]},
            "awaySplit": {"label": "Away", "samples": 0, "averages": card["seasonAvg"]},
            "recentLogs": [],
            "chartLine": chart_line,
            "chartStatLabel": "Points",
            "streaks": [],
            "h2h": {
                "record": "—",
                "note": "Head-to-head fills as more gamelogs land in the warehouse.",
                "meetings": [],
            },
            "matchup": {
                "title": f"vs {card['opponent']}",
                "defenseRank": "Pending",
                "bullets": [card["matchupNote"]],
            },
            "researchScore": card["confidence"],
            "dataQualityScore": 70,
            "aiExplain": {
                "verdict": "neutral",
                "headline": "Model-backed profile",
                "body": "Open a linked prop for full factor explanation.",
            },
            "checks": [],
            "propIds": [p["id"] for p in mine],
            "recommendedPropIds": [card["topPropId"]],
            "headshot": card.get("headshot"),
            "live": True,
        }

    logs = (
        db.execute(
            select(PlayerGameLog)
            .where(PlayerGameLog.player_id == player.id)
            .order_by(PlayerGameLog.played_at.desc())
            .limit(25)
        )
        .scalars()
        .all()
    )
    pts = [float(r.points) for r in logs if r.points is not None]
    reb = [float(r.rebounds) for r in logs if r.rebounds is not None]
    ast = [float(r.assists) for r in logs if r.assists is not None]
    props = [
        p
        for p in board_props
        if p.get("playerWarehouseId") == player.id or p.get("playerId") == player.external_id
    ]
    card = _player_card_from_props(props, player.external_id or player.id) if props else None
    team = _team_abbr(db, player.team_id)
    opp = props[0]["opponent"] if props else "OPP"
    tip = props[0]["tipTime"] if props else ""
    points_prop = next((p for p in props if p.get("market") == "Points"), props[0] if props else None)
    chart_line = float(points_prop["line"]) if points_prop else (round(mean(pts) * 2) / 2 if pts else 0.0)

    recent = [
        {
            "date": r.played_at.strftime("%b %d"),
            "opponent": r.opponent or "OPP",
            "home": bool(r.home),
            "result": "—",
            "stats": {
                "pts": float(r.points or 0),
                "reb": float(r.rebounds or 0),
                "ast": float(r.assists or 0),
            },
            "minutesOrSnaps": float(r.minutes or 0),
            "primary": float(r.points or 0),
        }
        for r in logs[:12]
    ]

    hit_rates = [
        {
            "market": p["market"],
            "line": p["line"],
            "side": p["side"],
            "l5": p["l5"],
            "l10": p["l10"],
            "l20": p["l20"],
            "season": p["season"],
        }
        for p in props
    ]

    explain = (props[0].get("explanation") or []) if props else []
    conf = int(props[0].get("researchScore") or props[0].get("confidence") or 60) if props else 60
    verdict = "strong" if conf >= 75 else "weak" if conf < 55 else "neutral"

    inj = (
        db.execute(
            select(Injury)
            .where(Injury.player_id == player.id)
            .order_by(Injury.reported_at.desc())
            .limit(1)
        ).scalar_one_or_none()
    )
    injury = _injury_bucket(inj.status) if inj else "None"
    injury_note = (inj.detail or inj.status) if inj else "No injury designation in warehouse."

    return {
        "id": player.external_id or player.id,
        "name": player.full_name,
        "league": "NBA",
        "team": team,
        "opponent": opp,
        "position": player.position or "G",
        "initials": "".join(p[0] for p in player.full_name.split()[:2]).upper(),
        "injury": injury,
        "injuryNote": injury_note,
        "tipTime": tip,
        "projectedWorkload": f"{card['projectedMinutes'] if card else 32} min",
        "bio": "Live Seraphim profile from ESPN gamelogs.",
        "seasonAverages": {
            "pts": round(mean(pts), 1) if pts else 0.0,
            "reb": round(mean(reb), 1) if reb else 0.0,
            "ast": round(mean(ast), 1) if ast else 0.0,
        },
        "hitRates": hit_rates,
        "homeSplit": _split_averages(logs, home=True),
        "awaySplit": _split_averages(logs, home=False),
        "recentLogs": recent,
        "chartLine": chart_line,
        "chartStatLabel": "Points",
        "streaks": _points_streak(logs, chart_line),
        "h2h": {
            "record": "—",
            "note": "Head-to-head fills as more gamelogs land in the warehouse.",
            "meetings": [],
        },
        "matchup": {
            "title": f"vs {opp}",
            "defenseRank": "Pending team_stats",
            "bullets": [props[0].get("matchupNote") or "Matchup context pending"] if props else [],
        },
        "researchScore": conf,
        "dataQualityScore": int(props[0].get("dqs") or 70) if props else 60,
        "aiExplain": {
            "verdict": verdict,
            "headline": explain[0] if explain else "Live model profile",
            "body": " ".join(explain[1:3]) if len(explain) > 1 else "Open linked props for factor-level explanations.",
        },
        "checks": (props[0].get("checks") if props and isinstance(props[0].get("checks"), list) else []) or [],
        "propIds": [p["id"] for p in props],
        "recommendedPropIds": [props[0]["id"]] if props else [],
        "headshot": player.headshot_url,
        "live": True,
    }


def ensure_nba_board(db: Session, force: bool = False) -> dict[str, Any]:
    """Return warehouse board; ingest slate if empty or force=True."""
    existing = list_nba_props_from_warehouse(db)
    if existing and not force:
        return {
            "ok": True,
            "source": "warehouse",
            "props": existing,
            "players": list_nba_player_cards(db),
            "count": len(existing),
        }
    result = import_nba_slate(db, max_games=4, per_team=2, markets=("Points", "Rebounds", "Assists"))
    props = list_nba_props_from_warehouse(db) or result.get("board") or []
    return {
        "ok": True,
        "source": "ingested",
        "props": props,
        "players": list_nba_player_cards(db),
        "count": len(props),
        "ingest": {k: result.get(k) for k in ("games", "players", "props", "injuries")},
    }
