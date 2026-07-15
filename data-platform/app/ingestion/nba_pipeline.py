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
    confidence_score,
    data_quality_score,
    expected_value,
    explain_prop,
    hit_rate,
    home_away_split,
    no_vig_pair,
    research_score_from_checks,
    rest_days,
    streak,
)
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
    key = {
        "Points": "points",
        "Rebounds": "rebounds",
        "Assists": "assists",
        "Threes": "threes",
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

    # Derive line from recent average (until live prop lines arrive from odds provider)
    avg = mean(values[:10])
    line = round(avg * 2) / 2
    side = "Over"
    market = "Points"

    # Odds — live or clearly labeled mock
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
        odds_are_mock = True
    elif odds_provider is not None:
        try:
            all_quotes = odds_provider.fetch_player_prop_odds("NBA")  # type: ignore[union-attr]
            quotes = [
                q
                for q in all_quotes
                if q.market == market and player.full_name.lower() in q.player_name.lower()
            ]
            odds_are_mock = False
        except Exception as exc:  # noqa: BLE001
            log.warning("Live odds failed, falling back to mock: %s", exc)
            quotes = MockOddsProvider().quote_for_prop(
                league="NBA",
                player_name=player.full_name,
                player_external_id=athlete.external_id,
                market=market,
                line=line,
                game_external_id=game.external_id,
            )
            odds_are_mock = True

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
    no_vig_over, _ = no_vig_pair(over_odds, under_odds)
    no_vig = no_vig_over if side == "Over" else (1 - no_vig_over)
    ev = expected_value(no_vig, over_odds if side == "Over" else under_odds)

    l5 = hit_rate(values, line, side, 5)
    l10 = hit_rate(values, line, side, 10)
    l20 = hit_rate(values, line, side, 20)
    season = hit_rate(values, line, side, len(values))
    homes = [bool(r.home) for r in logs if getattr(r, "points", None) is not None]
    home_rate, away_rate = home_away_split(values, homes, line, side)
    rest = rest_days([r.played_at for r in logs])
    stk = streak(values, line, side)

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

    opp_abbr = game.away_abbr if player.team_id and game.home_team_external_id in (player.team_id or "") else game.away_abbr
    # Determine opponent relative to player's team
    if athlete.team_external_id == game.home_team_external_id:
        opp_abbr = game.away_abbr
        matchup = f"vs {game.away_abbr} at home"
    else:
        opp_abbr = game.home_abbr
        matchup = f"@ {game.home_abbr}"

    checks = build_research_checks(
        l10=l10,
        l5=l5,
        injury_status=injury_status,
        books_agree=True,
        line_moved_favorably=None,
        minutes_ok=True,
    )
    rs = research_score_from_checks(checks)
    conf = confidence_score(
        l10_rate=l10.rate,
        samples=l10.samples,
        ev_percent=ev,
        injury_penalty=8 if injury_status.lower() not in ("none", "healthy", "active") else 0,
    )
    dqs = data_quality_score(
        has_gamelog=True,
        gamelog_count=len(values),
        has_injury_feed=bool(injuries),
        has_live_odds=not odds_are_mock,
        freshness_minutes=5,
    )
    bullets = explain_prop(
        player=player.full_name,
        market=market,
        side=side,
        line=line,
        l5=l5,
        l10=l10,
        l20=l20,
        no_vig=no_vig,
        ev_percent=ev,
        research_score=rs,
        matchup_note=matchup,
    )
    why = build_prop_of_the_day_why(
        research_score=rs,
        checks=checks,
        no_vig=no_vig,
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
        provider="espn-nba+odds",
        job="featured_prop",
        status="ok",
        rows=1,
        is_mock=odds_are_mock,
        message="odds mock" if odds_are_mock else "live odds",
    )
    db.flush()

    home_team = db.get(Team, game_row.home_team_id) if game_row else None
    away_team = db.get(Team, game_row.away_team_id) if game_row else None

    return {
        "ok": True,
        "source": {
            "schedule": "espn",
            "gamelog": "espn",
            "odds": "mock" if odds_are_mock else "the-odds-api",
            "usedFallbackDate": False,
        },
        "disclaimer": existing.disclaimer,
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
            "why": why,
            "oddsAreMock": odds_are_mock,
            "isModelEstimate": True,
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


def build_command_center(db: Session) -> dict[str, Any]:
    featured = build_and_store_featured_prop(db)
    schedule = get_nba_providers().schedule.fetch_schedule("NBA") if get_nba_providers().schedule else []
    games_soon = [
        {
            "id": g.external_id,
            "shortName": f"{g.away_abbr} @ {g.home_abbr}",
            "tipoffAt": g.tipoff_at.isoformat(),
            "status": g.status,
        }
        for g in sorted(schedule, key=lambda x: x.tipoff_at)[:6]
    ]
    prop = featured.get("prop") if featured.get("ok") else None
    top_props = []
    if prop:
        top_props = [prop]
        # Lightweight variants — labeled as model estimates, not separate live markets yet
        for market, scale, delta_rs in (("Rebounds", 0.28, 6), ("Assists", 0.18, 8)):
            clone = {**prop, "id": f"{prop['id']}-{market.lower()[:3]}", "market": market}
            clone["line"] = max(0.5, round(prop["line"] * scale * 2) / 2)
            clone["researchScore"] = max(60, prop["researchScore"] - delta_rs)
            clone["confidence"] = max(55, prop["confidence"] - delta_rs + 1)
            clone["isModelEstimate"] = True
            top_props.append(clone)

    return {
        "ok": True,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "disclaimer": get_settings().model_disclaimer,
        "propOfTheDay": prop,
        "topProps": top_props,
        "gamesStartingSoon": games_soon,
        "injuryAlerts": featured.get("injuries") or [],
        "savedParlays": [],
        "highestConfidence": prop,
        "featured": featured,
        "providers": {
            "schedule": "espn-nba",
            "odds": "mock" if (prop or {}).get("oddsAreMock", True) else "the-odds-api",
        },
    }
