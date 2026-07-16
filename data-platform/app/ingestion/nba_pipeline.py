"""NBA ingestion + analytics pipeline."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from statistics import mean
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.engine import (
    MODEL_DISCLAIMER,
    build_prop_of_the_day_why,
    build_research_checks,
    checks_to_dicts,
    expected_value,
    home_away_split,
    no_vig_pair,
    rest_days,
    streak,
)
from app.analytics.factors.base import PredictionContext
from app.analytics.prediction import predict_prop
from app.config import get_settings
from app.db.models import Game, Player, PlayerGameLog, PropAnalytics, ProviderRun, Team
from app.ingestion.warehouse import (
    insert_odds,
    upsert_game,
    upsert_gamelog,
    upsert_injury,
    upsert_player,
    upsert_prop,
)
from app.providers.mock.odds import MockOddsProvider
from app.providers.registry import get_nba_providers

log = logging.getLogger(__name__)


def _run_log(
    db: Session,
    *,
    provider: str,
    job: str,
    status: str,
    rows: int = 0,
    message: str | None = None,
    is_mock: bool = False,
) -> None:
    db.add(
        ProviderRun(
            id=str(uuid.uuid4()),
            provider=provider,
            league="NBA",
            job=job,
            status=status,
            rows_written=rows,
            message=message,
            is_mock=is_mock,
            finished_at=datetime.now(timezone.utc),
        )
    )


def import_nba_schedule(db: Session, date: Optional[str] = None) -> dict[str, Any]:
    providers = get_nba_providers()
    assert providers.schedule is not None
    games = providers.schedule.fetch_schedule("NBA", date)
    for g in games:
        upsert_game(db, g)
    _run_log(db, provider="espn-nba", job="import_schedule", status="ok", rows=len(games))
    db.flush()
    return {"league": "NBA", "imported": len(games), "date": date}


def import_nba_injuries_for_open_games(db: Session) -> dict[str, Any]:
    providers = get_nba_providers()
    assert providers.injuries is not None
    games = db.execute(
        select(Game).where(Game.league == "NBA").order_by(Game.tipoff_at.desc()).limit(12)
    ).scalars().all()
    total = 0
    for g in games:
        if not g.external_id:
            continue
        injuries = providers.injuries.fetch_injuries("NBA", g.external_id)
        for inj in injuries:
            upsert_injury(db, inj)
            total += 1
    _run_log(db, provider="espn-nba", job="import_injuries", status="ok", rows=total)
    db.flush()
    return {"injuries": total}


def _market_values(logs: list[PlayerGameLog], market: str) -> list[float]:
    if market in ("PRA", "Pts+Rebs+Asts"):
        vals = []
        for row in logs:
            if row.points is None and row.rebounds is None and row.assists is None:
                continue
            vals.append(float(row.points or 0) + float(row.rebounds or 0) + float(row.assists or 0))
        return vals
    if market in ("PR", "Pts+Rebs"):
        return [
            float(row.points or 0) + float(row.rebounds or 0)
            for row in logs
            if row.points is not None or row.rebounds is not None
        ]
    if market in ("PA", "Pts+Asts"):
        return [
            float(row.points or 0) + float(row.assists or 0)
            for row in logs
            if row.points is not None or row.assists is not None
        ]
    if market in ("RA", "Rebs+Asts"):
        return [
            float(row.rebounds or 0) + float(row.assists or 0)
            for row in logs
            if row.rebounds is not None or row.assists is not None
        ]
    key = {
        "Points": "points",
        "Rebounds": "rebounds",
        "Assists": "assists",
        "Threes": "threes",
        "3-PT Made": "threes",
        "Steals": "steals",
        "Blocks": "blocks",
    }.get(market, "points")
    vals = []
    for row in logs:
        v = getattr(row, key, None)
        if v is not None:
            vals.append(float(v))
    return vals


def build_and_store_featured_prop(db: Session, game_external_id: Optional[str] = None) -> dict[str, Any]:
    """Pull ESPN featured athlete + gamelog, attach odds (live or mock), compute analytics, persist."""
    settings = get_settings()
    providers = get_nba_providers()
    assert providers.schedule and providers.featured and providers.gamelog

    schedule = providers.schedule.fetch_schedule("NBA")
    if not schedule:
        _run_log(db, provider="espn-nba", job="featured_prop", status="skipped", message="No games")
        return {"ok": False, "error": "No NBA games on scoreboard"}

    game = next((g for g in schedule if g.external_id == game_external_id), schedule[0])
    upsert_game(db, game)

    athlete = providers.featured.pick_featured_athlete(game.external_id)
    if not athlete:
        return {"ok": False, "error": "No featured athlete from ESPN summary"}

    team_id = None
    if athlete.team_external_id:
        team_id = f"nba:team:{athlete.team_external_id}"
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
    values = _market_values(logs, "Points")
    if len(values) < 5:
        return {"ok": False, "error": "Insufficient gamelog samples", "player": player.full_name}

    market = "Points"
    injuries = providers.injuries.fetch_injuries("NBA", game.external_id) if providers.injuries else []
    for inj in injuries:
        upsert_injury(db, inj)
    injury_status = "None"
    for inj in injuries:
        if inj.player_external_id == athlete.external_id or (
            inj.player_name and inj.player_name.lower() in player.full_name.lower()
        ):
            injury_status = inj.status
            break

    if athlete.team_external_id == game.home_team_external_id:
        opp_abbr = game.away_abbr
        matchup = f"vs {game.away_abbr} at home"
        is_home = True
    else:
        opp_abbr = game.home_abbr
        matchup = f"@ {game.home_abbr}"
        is_home = False

    # --- Seraphim Projection Engine V1 (independent of sportsbooks) ---
    point_logs = [r for r in logs if r.points is not None]
    homes = [bool(r.home) for r in point_logs]
    minutes = [r.minutes for r in point_logs]
    played_at = [r.played_at for r in point_logs]
    vs_opp: list[float] = []
    for r in point_logs:
        if (r.opponent or "").upper() == opp_abbr.upper() and r.points is not None:
            # Featured prop is Points-first; board path uses market-aware helper
            vs_opp.append(float(r.points))
    mins_clean = [m for m in minutes if m is not None and m > 0]
    expected_minutes = mean(mins_clean[:5]) if len(mins_clean) >= 3 else (mean(mins_clean) if mins_clean else None)
    ctx = PredictionContext(
        league="NBA",
        market=market,
        values=values,
        homes=homes,
        played_at=played_at,
        minutes=minutes,
        injury_status=injury_status,
        is_home=is_home,
        opponent_abbr=opp_abbr,
        tipoff_at=game.tipoff_at,
        expected_minutes=expected_minutes,
        vs_opponent_values=vs_opp,
        opponent_def_rank=None,
        pace_index=None,
        usage_index=None,
    )
    # Optional comparison line: consensus-style half-point near recent mean (NOT our projection)
    comparison_line = round(mean(values[:10]) * 2) / 2
    prediction = predict_prop(ctx, comparison_line=comparison_line)
    side = "Over" if prediction.projected_value >= comparison_line else "Under"
    line = comparison_line  # stored for user comparison; model projection is separate

    # Odds quotes are comparison-only (mock until ODDS_API_KEY)
    odds_provider = providers.odds
    quotes = []
    odds_are_mock = True
    if hasattr(odds_provider, "quote_for_prop"):
        quotes = odds_provider.quote_for_prop(  # type: ignore[union-attr]
            league="NBA",
            player_name=player.full_name,
            player_external_id=athlete.external_id,
            market=market,
            line=line,
            game_external_id=game.external_id,
        )
    elif odds_provider is not None:
        try:
            all_quotes = odds_provider.fetch_player_prop_odds("NBA")  # type: ignore[union-attr]
            quotes = [
                q
                for q in all_quotes
                if q.market == market and player.full_name.lower() in q.player_name.lower()
            ]
            odds_are_mock = False
            if quotes and quotes[0].line:
                comparison_line = float(quotes[0].line)
                prediction = predict_prop(ctx, comparison_line=comparison_line)
                line = comparison_line
                side = "Over" if prediction.projected_value >= comparison_line else "Under"
        except Exception as exc:  # noqa: BLE001
            log.warning("Live odds failed, falling back to mock: %s", exc)
            quotes = []

    if not quotes:
        quotes = MockOddsProvider().quote_for_prop(
            league="NBA",
            player_name=player.full_name,
            player_external_id=athlete.external_id,
            market=market,
            line=line,
            game_external_id=game.external_id,
        )
        odds_are_mock = True

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
    under_odds = next((q.american_odds for q in quotes if q.side == "Under"), -110)
    # Optional EV vs book price using *model* over probability (not book no-vig)
    model_side_prob = (
        prediction.over_probability if side == "Over" else prediction.under_probability
    )
    book_price = over_odds if side == "Over" else under_odds
    ev = expected_value(model_side_prob, book_price)
    # Keep no-vig for transparency when comparing books — labeled separately
    no_vig_over, _ = no_vig_pair(over_odds, under_odds)
    no_vig = no_vig_over if side == "Over" else (1 - no_vig_over)

    l5, l10, l20, season = prediction.l5, prediction.l10, prediction.l20, prediction.season
    assert l5 and l10 and l20 and season
    home_rate, away_rate = home_away_split(values, homes, line, side)
    rest = rest_days(played_at)
    stk = streak(values, line, side)
    rs = prediction.research_score
    conf = prediction.confidence_score
    dqs = prediction.data_quality_score
    bullets = prediction.explanation
    checks = build_research_checks(
        l10=l10,
        l5=l5,
        injury_status=injury_status,
        books_agree=True,
        line_moved_favorably=None,
        minutes_ok=True,
    )
    why = build_prop_of_the_day_why(
        research_score=rs,
        checks=checks,
        no_vig=prediction.over_probability,
        ev_percent=ev,
        l5=l5,
        l10=l10,
        l20=l20,
        side=side,
        line=line,
        market=market,
        matchup=matchup,
        open_line=line,
        current_line=line,
        injury_status=injury_status,
    )
    why["headline"] = (
        f"Model projects {prediction.projected_value:.1f} {market} "
        f"({side} lean vs comparison {line})."
    )
    why["influentialFactors"] = prediction.influential_factors

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
    existing.no_vig_prob = no_vig
    existing.ev_percent = round(ev, 2)
    existing.research_score = rs
    existing.confidence_score = conf
    existing.data_quality_score = dqs
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
    existing.explain_bullets = bullets
    existing.why_payload = why
    existing.checks = checks_to_dicts(checks)
    existing.is_model_estimate = True
    existing.odds_are_mock = odds_are_mock
    existing.disclaimer = settings.model_disclaimer or MODEL_DISCLAIMER
    existing.computed_at = datetime.now(timezone.utc)

    _run_log(
        db,
        provider="espn-nba+model",
        job="featured_prop",
        status="ok",
        rows=1,
        is_mock=odds_are_mock,
        message=f"{prediction.model_version}; odds={'mock' if odds_are_mock else 'live'}",
    )
    db.flush()

    home_team = db.get(Team, game_row.home_team_id) if game_row else None
    away_team = db.get(Team, game_row.away_team_id) if game_row else None

    return {
        "ok": True,
        "source": {
            "schedule": "espn",
            "gamelog": "espn",
            "prediction": prediction.model_version,
            "odds": "mock" if odds_are_mock else "the-odds-api",
            "oddsRole": "comparison-only",
            "usedFallbackDate": False,
        },
        "disclaimer": existing.disclaimer,
        "prediction": prediction.to_api_dict(),
        "game": {
            "id": game.external_id,
            "shortName": f"{game.away_abbr} @ {game.home_abbr}",
            "tipoffAt": game.tipoff_at.isoformat(),
            "home": {"abbreviation": game.home_abbr, "name": game.home_name},
            "away": {"abbreviation": game.away_abbr, "name": game.away_name},
        },
        "athlete": {
            "id": athlete.external_id,
            "fullName": player.full_name,
            "shortName": player.short_name,
            "headshot": player.headshot_url,
            "position": player.position,
            "teamAbbr": (home_team.abbreviation if home_team and player.team_id == home_team.id else None)
            or (away_team.abbreviation if away_team else None)
            or opp_abbr,
        },
        "injuries": [
            {
                "player": i.player_name,
                "status": i.status,
                "detail": i.detail,
                "team": i.team_abbr,
            }
            for i in injuries[:12]
        ],
        "prop": {
            "id": prop.id,
            "league": "NBA",
            "playerId": player.id,
            "player": player.full_name,
            "shortName": player.short_name,
            "headshot": player.headshot_url,
            "team": athlete.team_external_id,
            "opponent": opp_abbr,
            "position": player.position or "G",
            "market": market,
            "side": side,
            "line": line,
            "comparisonLine": comparison_line,
            "projectedValue": round(prediction.projected_value, 2),
            "overProbability": round(prediction.over_probability, 4),
            "underProbability": round(prediction.under_probability, 4),
            "edgeVsLine": round(prediction.edge_vs_line, 2) if prediction.edge_vs_line is not None else None,
            "tipTime": game.tipoff_at.isoformat(),
            "gameLabel": f"{game.away_abbr} @ {game.home_abbr}",
            "americanOdds": over_odds if side == "Over" else under_odds,
            "noVigProb": round(no_vig, 4),
            "evPercent": round(ev, 2),
            "confidence": conf,
            "researchScore": rs,
            "dqs": dqs,
            "l5": l5.label,
            "l10": l10.label,
            "l20": l20.label,
            "season": season.label,
            "homeRate": home_rate,
            "awayRate": away_rate,
            "restDays": rest,
            "streak": stk,
            "checks": checks_to_dicts(checks),
            "explanation": bullets,
            "influentialFactors": prediction.influential_factors,
            "why": why,
            "oddsAreMock": odds_are_mock,
            "oddsRole": "comparison-only",
            "isModelEstimate": True,
            "modelVersion": prediction.model_version,
            "disclaimer": existing.disclaimer,
            "recent": [
                {
                    "value": float(r.points),
                    "opponent": r.opponent,
                    "hit": (float(r.points) > line) if side == "Over" else (float(r.points) < line),
                }
                for r in logs[:10]
                if r.points is not None
            ],
            "books": [
                {
                    "name": q.sportsbook_name,
                    "american": q.american_odds,
                    "line": q.line,
                    "isMock": q.is_mock,
                    "role": "comparison-only",
                }
                for q in quotes
                if q.side == side
            ],
        },
    }


def recalculate_open_prop_analytics(db: Session) -> dict[str, Any]:
    """Recompute analytics for open props that already have gamelogs (batch job)."""
    # For v1, rebuild featured prop which also refreshes analytics cache.
    result = build_and_store_featured_prop(db)
    return {"recalculated": 1 if result.get("ok") else 0, "featured": result.get("ok")}


def _parse_hit_fraction(label: str | None) -> tuple[int, int]:
    if not label or "/" not in str(label):
        return 0, 0
    try:
        hits_s, samples_s = str(label).split("/", 1)
        return int(hits_s), int(samples_s)
    except (TypeError, ValueError):
        return 0, 0


def _tip_date(prop: dict[str, Any]):
    raw = prop.get("tipTime") or prop.get("tipoffAt") or ""
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        try:
            from zoneinfo import ZoneInfo

            return dt.astimezone(ZoneInfo("America/New_York")).date()
        except Exception:
            return dt.astimezone(timezone.utc).date()
    except Exception:
        return None


def _tip_date_utc(prop: dict[str, Any]):
    raw = prop.get("tipTime") or prop.get("tipoffAt") or ""
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).date()
    except Exception:
        return None


def _hit_likelihood(prop: dict[str, Any]) -> tuple[float, float, float]:
    """Rank key: lean-side hit probability, then confidence, then research score."""
    side = str(prop.get("side") or "Over")
    if side == "Under":
        prob = prop.get("underProbability")
    else:
        prob = prop.get("overProbability")
    if prob is None:
        prob = prop.get("noVigProb")
    if prob is None:
        hits, samples = _parse_hit_fraction(prop.get("l10"))
        prob = (hits / samples) if samples else 0.0
    conf = float(prop.get("confidence") or 0) / 100.0
    rs = float(prop.get("researchScore") or 0)
    return (float(prob), conf, rs)


def _collect_today_board_props(db: Session) -> tuple[list[dict[str, Any]], Any]:
    """Gather open warehouse props whose tip date is today (US/Eastern or UTC)."""
    try:
        from zoneinfo import ZoneInfo

        today_et = datetime.now(ZoneInfo("America/New_York")).date()
    except Exception:
        today_et = datetime.now(timezone.utc).date()
    today_utc = datetime.now(timezone.utc).date()

    boards: list[dict[str, Any]] = []
    try:
        from app.ingestion.nba_board import list_nba_props_from_warehouse

        for p in list_nba_props_from_warehouse(db) or []:
            boards.append({**p, "league": p.get("league") or "NBA"})
    except Exception:
        pass
    try:
        from app.ingestion.wnba_board import list_wnba_props_from_warehouse

        for p in list_wnba_props_from_warehouse(db) or []:
            boards.append({**p, "league": p.get("league") or "WNBA"})
    except Exception:
        pass
    try:
        from app.ingestion.nfl_board import list_nfl_props_from_warehouse

        for p in list_nfl_props_from_warehouse(db) or []:
            boards.append({**p, "league": p.get("league") or "NFL"})
    except Exception:
        pass
    try:
        from app.ingestion.generic_board import list_league_props

        for league in ("MLB", "NHL", "Soccer"):
            for p in list_league_props(db, league) or []:
                boards.append({**p, "league": p.get("league") or league})
    except Exception:
        pass

    def is_today(p: dict[str, Any]) -> bool:
        return _tip_date(p) == today_et or _tip_date_utc(p) == today_utc

    todays = [p for p in boards if is_today(p)]
    # Dedupe by id, prefer higher hit likelihood
    by_id: dict[str, dict[str, Any]] = {}
    for p in todays:
        pid = str(p.get("id") or "")
        if not pid:
            continue
        prev = by_id.get(pid)
        if not prev or _hit_likelihood(p) > _hit_likelihood(prev):
            by_id[pid] = p
    ranked = sorted(by_id.values(), key=_hit_likelihood, reverse=True)
    for p in ranked:
        prob, _, _ = _hit_likelihood(p)
        p["hitProbability"] = round(prob, 4)
        p["hitPct"] = int(round(prob * 100))
    return ranked, today_et


def build_command_center(db: Session) -> dict[str, Any]:
    featured = build_and_store_featured_prop(db)
    schedule = get_nba_providers().schedule.fetch_schedule("NBA") if get_nba_providers().schedule else []
    today_props, board_date = _collect_today_board_props(db)
    if not isinstance(board_date, str):
        board_date = board_date.isoformat() if board_date else datetime.now(timezone.utc).date().isoformat()

    # Prefer live ESPN schedule date when it matches today; else keep Eastern "today".
    if schedule:
        try:
            sched_day = schedule[0].tipoff_at.date().isoformat()
            if sched_day == board_date:
                pass
        except Exception:
            pass

    games_soon = [
        {
            "id": g.external_id,
            "shortName": f"{g.away_abbr} @ {g.home_abbr}",
            "tipoffAt": g.tipoff_at.isoformat(),
            "status": g.status,
            "statusDetail": g.status,
        }
        for g in sorted(schedule, key=lambda x: x.tipoff_at)[:6]
    ]

    featured_prop = featured.get("prop") if featured.get("ok") else None

    # Prop of the Day + top 6 most likely to hit — must be from today's slate.
    prop: dict[str, Any] | None = None
    top_props: list[dict[str, Any]] = []
    if today_props:
        prop = today_props[0]
        # Prefer featured why writeup when same player/market
        if featured_prop and str(featured_prop.get("player")) == str(prop.get("player")):
            if featured_prop.get("why") and not prop.get("why"):
                prop = {**prop, "why": featured_prop["why"]}
        top_props = today_props[1:7] if len(today_props) > 1 else today_props[:6]
        if prop and top_props and top_props[0].get("id") == prop.get("id"):
            top_props = today_props[1:7]
    elif featured_prop and _tip_date(featured_prop) == datetime.fromisoformat(board_date).date():
        prop = featured_prop
        top_props = [featured_prop][:6]
    elif featured_prop:
        # Featured ESPN prop is not from today — keep schedule context but don't
        # advertise a stale Prop of the Day.
        prop = None
        top_props = []

    best_ev = (
        max(today_props, key=lambda p: float(p.get("evPercent") or 0)) if today_props else prop
    )
    highest = (
        max(today_props, key=lambda p: float(p.get("confidence") or 0)) if today_props else prop
    )

    # OddsIQ-style no-vig board: strongest juice-free lean edges on today's slate.
    best_no_vig = _rank_novig_picks(today_props, limit=8)
    generated_at = datetime.now(timezone.utc).isoformat()
    notifications: list[dict[str, Any]] = []
    for p in best_no_vig[:6]:
        edge_pct = float(p.get("noVigEdgePct") or 0)
        if edge_pct < 5:
            continue
        notifications.append(
            {
                "id": f"novig:{p.get('id')}",
                "kind": "novig",
                "tone": "research",
                "title": f"No-vig pick · {p.get('player')}",
                "detail": (
                    f"{p.get('side')} {p.get('line')} {p.get('market')} · "
                    f"+{edge_pct:.1f}% no-vig edge"
                    + (f" · {p.get('league')}" if p.get("league") else "")
                ),
                "propId": p.get("id"),
                "league": p.get("league") or "NBA",
                "noVigEdgePct": edge_pct,
                "createdAt": generated_at,
            }
        )
    for inj in (featured.get("injuries") or [])[:4]:
        notifications.append(
            {
                "id": f"injury:{inj.get('player') or inj.get('player_name') or len(notifications)}",
                "kind": "injury",
                "tone": "injury",
                "title": f"Injury · {inj.get('player') or inj.get('player_name') or 'Player'}",
                "detail": (
                    f"{inj.get('team') or ''} {inj.get('status') or ''} "
                    f"{inj.get('detail') or ''}"
                ).strip()
                or "Injury update",
                "propId": None,
                "league": "NBA",
                "createdAt": generated_at,
            }
        )

    return {
        "ok": True,
        "generatedAt": generated_at,
        "disclaimer": get_settings().model_disclaimer,
        "board": {
            "date": board_date,
            "games": [
                {
                    "id": g.external_id,
                    "shortName": f"{g.away_abbr} @ {g.home_abbr}",
                    "tipoffAt": g.tipoff_at.isoformat(),
                    "status": g.status,
                    "statusDetail": g.status,
                }
                for g in schedule
            ],
        },
        "propOfTheDay": prop,
        "topProps": top_props,
        "bestNoVigPicks": best_no_vig,
        "bestEvToday": best_ev,
        "gamesStartingSoon": games_soon,
        "injuryAlerts": featured.get("injuries") or [],
        "notifications": notifications,
        "savedParlays": [],
        "highestConfidence": highest,
        "featured": featured,
        "providers": {
            "schedule": "espn-nba",
            "odds": "mock" if (prop or {}).get("oddsAreMock", True) else "line-aggregator",
            "slate": "warehouse-today",
            "novigRefreshSeconds": 300,
        },
    }


def _novig_lean_prob(prop: dict[str, Any]) -> float:
    """Lean-side no-vig probability (0–1). Board rows usually already store lean noVigProb."""
    side = str(prop.get("side") or "Over")
    raw = prop.get("noVigProb")
    if raw is None:
        if side == "Under":
            raw = prop.get("underProbability")
        else:
            raw = prop.get("overProbability")
    try:
        return max(0.0, min(1.0, float(raw or 0)))
    except (TypeError, ValueError):
        return 0.0


def _rank_novig_picks(props: list[dict[str, Any]], *, limit: int = 8) -> list[dict[str, Any]]:
    """Rank today's props by no-vig edge vs a fair coin (0.5)."""
    ranked: list[dict[str, Any]] = []
    for p in props:
        lean = _novig_lean_prob(p)
        edge = lean - 0.5
        if edge < 0.04:  # require at least ~4% juice-free edge
            continue
        row = {
            **p,
            "noVigProb": round(lean, 4),
            "noVigEdge": round(edge, 4),
            "noVigEdgePct": round(edge * 100, 2),
            "noVigPct": int(round(lean * 100)),
        }
        ranked.append(row)
    ranked.sort(
        key=lambda r: (
            float(r.get("noVigEdge") or 0),
            float(r.get("evPercent") or 0),
            float(r.get("researchScore") or 0),
        ),
        reverse=True,
    )
    return ranked[:limit]
