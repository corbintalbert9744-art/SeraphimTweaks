"""NFL ingestion + analytics pipeline (ESPN + odds adapter)."""

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
from app.db.models import Game, PlayerGameLog, PropAnalytics, ProviderRun, Team
from app.ingestion.warehouse import (
    insert_odds,
    upsert_game,
    upsert_gamelog,
    upsert_injury,
    upsert_player,
    upsert_prop,
)
from app.providers.mock.odds import MockOddsProvider
from app.providers.registry import get_nfl_providers

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
            league="NFL",
            job=job,
            status=status,
            rows_written=rows,
            message=message,
            is_mock=is_mock,
            finished_at=datetime.now(timezone.utc),
        )
    )


def import_nfl_schedule(db: Session, date: Optional[str] = None) -> dict[str, Any]:
    providers = get_nfl_providers()
    assert providers.schedule is not None
    games = providers.schedule.fetch_schedule("NFL", date)
    for g in games:
        upsert_game(db, g)
    _run_log(db, provider="espn-nfl", job="import_schedule", status="ok", rows=len(games))
    db.flush()
    return {"league": "NFL", "imported": len(games), "date": date}


def import_nfl_injuries_for_open_games(db: Session) -> dict[str, Any]:
    providers = get_nfl_providers()
    assert providers.injuries is not None
    games = (
        db.execute(select(Game).where(Game.league == "NFL").order_by(Game.tipoff_at.asc()).limit(16))
        .scalars()
        .all()
    )
    total = 0
    for g in games:
        if not g.external_id:
            continue
        for inj in providers.injuries.fetch_injuries("NFL", g.external_id):
            upsert_injury(db, inj)
            total += 1
    _run_log(db, provider="espn-nfl", job="import_injuries", status="ok", rows=total)
    db.flush()
    return {"injuries": total}


def _market_values(logs: list[PlayerGameLog], market: str) -> list[float]:
    """NFL markets map onto warehouse columns / raw JSON."""
    out: list[float] = []
    for row in logs:
        raw = row.raw or {}
        if market == "Passing Yards":
            v = raw.get("passingYards")
            if v is None:
                v = row.points
        elif market == "Rushing Yards":
            v = raw.get("rushingYards")
            if v is None:
                v = row.rebounds
        elif market == "Receiving Yards":
            v = raw.get("receivingYards")
            if v is None:
                v = row.assists
        elif market == "Receptions":
            v = raw.get("receptions")
            if v is None:
                v = row.threes
        else:
            v = row.points
        if v is not None:
            out.append(float(v))
    return out


def _default_market_for_position(position: Optional[str]) -> str:
    pos = (position or "QB").upper()
    if pos == "RB":
        return "Rushing Yards"
    if pos in ("WR", "TE"):
        return "Receiving Yards"
    return "Passing Yards"


def build_and_store_featured_nfl_prop(
    db: Session,
    game_external_id: Optional[str] = None,
) -> dict[str, Any]:
    settings = get_settings()
    providers = get_nfl_providers()
    assert providers.schedule and providers.featured and providers.gamelog

    schedule = providers.schedule.fetch_schedule("NFL")
    if not schedule:
        _run_log(db, provider="espn-nfl", job="featured_prop", status="skipped", message="No games")
        return {"ok": False, "error": "No NFL games on scoreboard"}

    game = next((g for g in schedule if g.external_id == game_external_id), schedule[0])
    upsert_game(db, game)

    athlete = providers.featured.pick_featured_athlete(game.external_id)
    if not athlete:
        return {"ok": False, "error": "No featured NFL athlete from ESPN summary/roster"}

    team_id = f"nfl:team:{athlete.team_external_id}" if athlete.team_external_id else None
    player = upsert_player(db, athlete, team_id=team_id)

    market = _default_market_for_position(athlete.position)
    gamelogs = providers.gamelog.fetch_gamelog("NFL", athlete.external_id)
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
    if len(values) < 3:
        # Try alternate markets if QB log sparse
        for alt in ("Passing Yards", "Rushing Yards", "Receiving Yards", "Receptions"):
            values = _market_values(logs, alt)
            if len(values) >= 3:
                market = alt
                break
    if len(values) < 3:
        return {
            "ok": False,
            "error": "Insufficient NFL gamelog samples",
            "player": player.full_name,
            "samples": len(values),
        }

    avg = mean(values[: min(10, len(values))])
    comparison_line = round(avg * 2) / 2

    injuries = providers.injuries.fetch_injuries("NFL", game.external_id) if providers.injuries else []
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

    homes = [bool(r.home) for r in logs[: len(values)]]
    minutes = [r.minutes for r in logs[: len(values)]]
    played_at = [r.played_at for r in logs[: len(values)]]
    mins_clean = [m for m in minutes if m is not None and m > 0]
    expected_minutes = mean(mins_clean[:5]) if len(mins_clean) >= 3 else (mean(mins_clean) if mins_clean else None)
    vs_opp = [
        float(v)
        for r, v in zip(logs[: len(values)], values)
        if (r.opponent or "").upper() == opp_abbr.upper()
    ]
    ctx = PredictionContext(
        league="NFL",
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
    )
    prediction = predict_prop(ctx, comparison_line=comparison_line)
    side = "Over" if prediction.projected_value >= comparison_line else "Under"
    line = comparison_line

    odds_provider = providers.odds
    odds_are_mock = True
    quotes = []
    if hasattr(odds_provider, "quote_for_prop"):
        quotes = odds_provider.quote_for_prop(  # type: ignore[union-attr]
            league="NFL",
            player_name=player.full_name,
            player_external_id=athlete.external_id,
            market=market,
            line=line,
            game_external_id=game.external_id,
        )
    elif odds_provider is not None:
        try:
            all_quotes = odds_provider.fetch_player_prop_odds("NFL")  # type: ignore[union-attr]
            quotes = [
                q
                for q in all_quotes
                if q.market.lower() in market.lower() and player.full_name.lower() in q.player_name.lower()
            ]
            odds_are_mock = False
            if quotes and quotes[0].line is not None:
                comparison_line = float(quotes[0].line)
                prediction = predict_prop(ctx, comparison_line=comparison_line)
                line = comparison_line
                side = "Over" if prediction.projected_value >= comparison_line else "Under"
        except Exception as exc:  # noqa: BLE001
            log.warning("NFL live odds failed, mock fallback: %s", exc)
            quotes = []

    if not quotes:
        quotes = MockOddsProvider().quote_for_prop(
            league="NFL",
            player_name=player.full_name,
            player_external_id=athlete.external_id,
            market=market,
            line=line,
            game_external_id=game.external_id,
        )
        odds_are_mock = True

    game_row = db.get(Game, f"nfl:game:{game.external_id}")
    prop = upsert_prop(
        db,
        league="NFL",
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
    model_side_prob = (
        prediction.over_probability if side == "Over" else prediction.under_probability
    )
    ev = expected_value(model_side_prob, over_odds if side == "Over" else under_odds)
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
        existing = PropAnalytics(id=str(uuid.uuid4()), prop_id=prop.id, league="NFL")
        db.add(existing)

    existing.l5_hits, existing.l5_samples, existing.l5_rate = l5.hits, l5.samples, l5.rate
    existing.l10_hits, existing.l10_samples, existing.l10_rate = l10.hits, l10.samples, l10.rate
    existing.l20_hits, existing.l20_samples, existing.l20_rate = l20.hits, l20.samples, l20.rate
    existing.season_hits, existing.season_samples, existing.season_rate = (
        season.hits,
        season.samples,
        season.rate,
    )
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
        provider="espn-nfl+model",
        job="featured_prop",
        status="ok",
        rows=1,
        is_mock=odds_are_mock,
        message=f"{prediction.model_version}; odds={'mock' if odds_are_mock else 'live'}",
    )
    db.flush()

    home_team = db.get(Team, game_row.home_team_id) if game_row else None
    away_team = db.get(Team, game_row.away_team_id) if game_row else None
    team_abbr = None
    if home_team and player.team_id == home_team.id:
        team_abbr = home_team.abbreviation
    elif away_team and player.team_id == away_team.id:
        team_abbr = away_team.abbreviation

    return {
        "ok": True,
        "source": {
            "schedule": "espn",
            "gamelog": "espn",
            "prediction": prediction.model_version,
            "odds": "mock" if odds_are_mock else "the-odds-api",
            "oddsRole": "comparison-only",
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
            "teamAbbr": team_abbr,
        },
        "injuries": [
            {"player": i.player_name, "status": i.status, "detail": i.detail, "team": i.team_abbr}
            for i in injuries[:12]
        ],
        "prop": {
            "id": prop.id,
            "league": "NFL",
            "playerId": player.id,
            "player": player.full_name,
            "shortName": player.short_name,
            "headshot": player.headshot_url,
            "team": team_abbr,
            "opponent": opp_abbr,
            "position": player.position or "QB",
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
                    "value": _market_values([r], market)[0],
                    "opponent": r.opponent,
                    "hit": (_market_values([r], market)[0] > line)
                    if side == "Over"
                    else (_market_values([r], market)[0] < line),
                }
                for r in logs[:10]
                if _market_values([r], market)
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


def recalculate_nfl_analytics(db: Session) -> dict[str, Any]:
    result = build_and_store_featured_nfl_prop(db)
    return {"recalculated": 1 if result.get("ok") else 0, "featured": result.get("ok")}
