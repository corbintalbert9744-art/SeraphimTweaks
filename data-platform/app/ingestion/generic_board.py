"""Build analytics boards from warehouse game logs via Projection Engine V1.

Used for leagues whose primary board is not ESPN-driven (MLB, NHL, Soccer, etc.).
Only emits props when real game-log history exists — never fabricates lines.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from statistics import mean
from typing import Any, Mapping, Optional, Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.engine import expected_value, home_away_split, rest_days, streak
from app.analytics.factors.base import PredictionContext
from app.analytics.prediction import predict_prop
from app.config import get_settings
from app.db.models import Player, PlayerGameLog, Prop, PropAnalytics, Team
from app.ingestion.warehouse import insert_odds, upsert_prop
from app.providers.comparison_lines import get_comparison_lines_provider

log = logging.getLogger(__name__)


def normalize_league(league: str) -> str:
    """Canonical league codes used in Prop.league / Player.league."""
    raw = (league or "").strip()
    if not raw:
        return raw
    upper = raw.upper()
    if upper == "SOCCER":
        return "Soccer"
    return upper


# Default markets when callers do not pass an explicit list.
# Values are (market_name, raw_stat_key | None). None = use PlayerGameLog.points.
DEFAULT_LEAGUE_MARKETS: dict[str, tuple[tuple[str, Optional[str]], ...]] = {
    "MLB": (
        ("Hits", "hits"),
        ("Home Runs", "homeRuns"),
        ("RBIs", "rbi"),
        ("Total Bases", "totalBases"),
        ("Strikeouts", "strikeOuts"),
    ),
    "NHL": (
        ("Points", None),
        ("Goals", "goals"),
        ("Assists", "assists"),
        ("Shots", "shots"),
    ),
    "Soccer": (
        ("Goals", "goals"),
        ("Assists", "assists"),
        ("Shots", "shots"),
        ("Shots on Target", "shots_on_target"),
    ),
    "ATP": (
        ("Aces", "aces"),
        ("Double Faults", "double_faults"),
    ),
    "WTA": (
        ("Aces", "aces"),
        ("Double Faults", "double_faults"),
    ),
}


def _round_line(value: float) -> float:
    return round(value * 2) / 2


def market_values_from_logs(
    logs: Sequence[PlayerGameLog],
    market: str,
    *,
    raw_stat_key: Optional[str] = None,
) -> list[float]:
    """Extract counting-stat samples from warehouse logs (columns or raw JSON)."""
    column_map = {
        "Points": "points",
        "Assists": "assists",
        "Rebounds": "rebounds",
        "Goals": "points",  # NHL goals often land in raw; points column used as fallback
    }
    vals: list[float] = []
    for row in logs:
        v: Optional[float] = None
        if raw_stat_key and isinstance(row.raw, dict) and row.raw.get(raw_stat_key) is not None:
            try:
                v = float(row.raw[raw_stat_key])
            except (TypeError, ValueError):
                v = None
        if v is None and raw_stat_key is None:
            # Composite / primary points slot (e.g. NHL Points = G+A stored in points)
            if row.points is not None:
                v = float(row.points)
            elif market == "Points" and isinstance(row.raw, dict):
                g = row.raw.get("goals")
                a = row.raw.get("assists")
                if g is not None or a is not None:
                    v = float(g or 0) + float(a or 0)
        if v is None:
            col = column_map.get(market)
            if col:
                attr = getattr(row, col, None)
                if attr is not None:
                    v = float(attr)
        if v is not None:
            vals.append(v)
    return vals


def _team_abbr(db: Session, team_id: Optional[str]) -> str:
    if not team_id:
        return "FA"
    t = db.get(Team, team_id)
    return t.abbreviation if t else "FA"


def ensure_league_board(
    db: Session,
    *,
    league: Optional[str] = None,
    league_code: Optional[str] = None,
    markets: Optional[Sequence[str]] = None,
    force: bool = False,
    raw_stat_keys: Optional[Mapping[str, Optional[str]]] = None,
    min_samples: int = 3,
) -> dict[str, Any]:
    """Materialize Prop + PropAnalytics from warehouse logs via Projection Engine V1.

    ``force`` is accepted for API symmetry with NBA/WNBA ensure_* helpers; this
    builder always recomputes from current warehouse rows.
    """
    _ = force
    code = normalize_league(league or league_code or "")
    if not code:
        return {"ok": False, "count": 0, "props": [], "error": "league required"}

    defaults = DEFAULT_LEAGUE_MARKETS.get(code, ())
    default_keys = {m: k for m, k in defaults}
    market_names: list[str] = list(markets) if markets else [m for m, _ in defaults]
    if not market_names:
        return {"ok": False, "count": 0, "props": [], "reason": "no_markets_configured", "league": code}

    key_map: dict[str, Optional[str]] = {**default_keys, **(dict(raw_stat_keys) if raw_stat_keys else {})}

    players = list(
        db.execute(select(Player).where(Player.league == code, Player.active.is_(True))).scalars().all()
    )
    props_out: list[dict[str, Any]] = []
    skipped_no_logs = 0

    for player in players:
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
        if not logs:
            skipped_no_logs += 1
            continue

        team = _team_abbr(db, player.team_id)
        for market in market_names:
            raw_key = key_map.get(market)
            values = market_values_from_logs(logs, market, raw_stat_key=raw_key)
            if len(values) < min_samples:
                continue

            line = _round_line(mean(values[:10]))
            if line <= 0:
                continue

            homes = [bool(r.home) for r in logs[: len(values)]]
            played_at = [r.played_at for r in logs[: len(values)]]
            minutes = [r.minutes for r in logs[: len(values)]]

            ctx = PredictionContext(
                league=code,
                market=market,
                values=values,
                homes=homes if len(homes) == len(values) else [True] * len(values),
                played_at=played_at
                if len(played_at) == len(values)
                else [datetime.now(timezone.utc)] * len(values),
                minutes=minutes,
                injury_status="None",
                is_home=True,
                opponent_abbr=None,
                tipoff_at=None,
                expected_minutes=None,
                vs_opponent_values=[],
            )
            prediction = predict_prop(ctx, comparison_line=line)
            side = "Over" if prediction.projected_value >= line else "Under"

            prop = upsert_prop(
                db,
                league=code,
                game_id=None,
                player_id=player.id,
                market=market,
                side=side,
                line=line,
            )
            db.flush()

            quotes = get_comparison_lines_provider().to_odds_quotes(
                league=code,
                player_name=player.full_name,
                player_external_id=player.external_id or player.id,
                market=market,
                baseline_line=line,
                projected_value=prediction.projected_value,
                game_external_id=None,
            )
            for q in quotes:
                insert_odds(db, q, prop.id)

            over_odds = next((q.american_odds for q in quotes if q.side == "Over"), -110)
            model_side = (
                prediction.over_probability if side == "Over" else prediction.under_probability
            )
            under_odds = next((q.american_odds for q in quotes if q.side == "Under"), -110)
            ev = expected_value(model_side, over_odds if side == "Over" else under_odds)

            l5, l10, l20, season = prediction.l5, prediction.l10, prediction.l20, prediction.season
            assert l5 and l10 and l20 and season
            home_rate, away_rate = home_away_split(values, ctx.homes, line, side)
            rest = rest_days(ctx.played_at)
            stk = streak(values, line, side)

            existing = db.execute(
                select(PropAnalytics).where(PropAnalytics.prop_id == prop.id)
            ).scalar_one_or_none()
            if not existing:
                existing = PropAnalytics(id=str(uuid.uuid4()), prop_id=prop.id, league=code)
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
            existing.no_vig_prob = prediction.over_probability
            existing.ev_percent = round(ev, 2)
            existing.research_score = prediction.research_score
            existing.confidence_score = prediction.confidence_score
            existing.data_quality_score = prediction.data_quality_score
            existing.projected_value = prediction.projected_value
            existing.over_probability = prediction.over_probability
            existing.under_probability = prediction.under_probability
            existing.comparison_line = line
            existing.edge_vs_line = prediction.edge_vs_line
            existing.residual_sigma = prediction.residual_sigma
            existing.model_version = prediction.model_version
            existing.factor_breakdown = prediction.to_api_dict()["factorBreakdown"]
            existing.influential_factors = prediction.influential_factors
            existing.matchup_note = f"{team} research line from warehouse logs"
            existing.explain_bullets = prediction.explanation
            existing.why_payload = {
                "headline": f"Model projects {prediction.projected_value:.1f} {market}",
                "verdict": "solid",
                "influentialFactors": prediction.influential_factors,
                "source": "warehouse_projection_engine_v1",
                "rawStatKey": raw_key,
            }
            existing.checks = []
            existing.is_model_estimate = True
            existing.odds_are_mock = True
            existing.disclaimer = get_settings().model_disclaimer
            existing.computed_at = datetime.now(timezone.utc)

            props_out.append(
                {
                    "id": prop.id,
                    "playerId": player.external_id,
                    "playerWarehouseId": player.id,
                    "player": player.full_name,
                    "team": team,
                    "opponent": "TBD",
                    "position": player.position or "",
                    "market": market,
                    "side": side,
                    "line": line,
                    "americanOdds": over_odds if side == "Over" else under_odds,
                    "noVigProb": round(
                        prediction.over_probability if side == "Over" else prediction.under_probability,
                        4,
                    ),
                    "evPercent": round(ev, 2),
                    "confidence": prediction.confidence_score,
                    "researchScore": prediction.research_score,
                    "dqs": prediction.data_quality_score,
                    "l5": l5.label,
                    "l10": l10.label,
                    "l20": l20.label,
                    "season": season.label,
                    "projectedValue": round(prediction.projected_value, 2),
                    "edgeVsLine": round(prediction.edge_vs_line, 2)
                    if prediction.edge_vs_line is not None
                    else None,
                    "modelVersion": prediction.model_version,
                    "isModelEstimate": True,
                    "oddsAreMock": True,
                    "oddsRole": "comparison-only",
                    "explanation": prediction.explanation,
                    "headshot": player.headshot_url,
                    "rawStatKey": raw_key,
                }
            )

    db.commit()
    return {
        "ok": True,
        "league": code,
        "count": len(props_out),
        "props": props_out,
        "players_considered": len(players),
        "skipped_no_logs": skipped_no_logs,
        "markets": market_names,
        "live": len(props_out) > 0,
        "source": "warehouse_projection_engine_v1",
    }


def list_league_props(db: Session, league: str, *, limit: int = 200) -> list[dict[str, Any]]:
    """Serialize open props + analytics for a league board."""
    code = normalize_league(league)
    rows = (
        db.execute(
            select(Prop, PropAnalytics, Player)
            .join(PropAnalytics, PropAnalytics.prop_id == Prop.id)
            .outerjoin(Player, Player.id == Prop.player_id)
            .where(Prop.league == code, Prop.status == "open")
            .order_by(PropAnalytics.research_score.desc())
            .limit(limit)
        )
        .all()
    )
    out: list[dict[str, Any]] = []
    for prop, analytics, player in rows:
        team = _team_abbr(db, player.team_id if player else None)
        opponent = "TBD"
        bullets = analytics.explain_bullets or []
        if analytics.matchup_note:
            # e.g. "Name · Market research line X vs Opponent."
            note = analytics.matchup_note
            if " vs " in note:
                opponent = note.rsplit(" vs ", 1)[-1].rstrip(".")
        elif bullets:
            first = str(bullets[0])
            if " vs " in first:
                opponent = first.rsplit(" vs ", 1)[-1].rstrip(".")
        out.append(
            {
                "id": prop.id,
                "playerId": player.external_id if player else None,
                "playerWarehouseId": player.id if player else prop.player_id,
                "player": player.full_name if player else "Player",
                "team": team,
                "opponent": opponent,
                "position": (player.position if player else None) or "",
                "market": prop.market,
                "side": prop.side,
                "line": prop.line,
                "americanOdds": -110,
                "noVigProb": analytics.no_vig_prob,
                "evPercent": analytics.ev_percent or 0,
                "confidence": analytics.confidence_score or 50,
                "researchScore": analytics.research_score or 50,
                "dqs": analytics.data_quality_score or 50,
                "l5": f"{analytics.l5_hits}/{analytics.l5_samples}" if analytics.l5_samples else "—",
                "l10": f"{analytics.l10_hits}/{analytics.l10_samples}" if analytics.l10_samples else "—",
                "l20": f"{analytics.l20_hits}/{analytics.l20_samples}" if analytics.l20_samples else "—",
                "season": f"{analytics.season_hits}/{analytics.season_samples}"
                if analytics.season_samples
                else "—",
                "projectedValue": analytics.projected_value,
                "edgeVsLine": analytics.edge_vs_line,
                "modelVersion": analytics.model_version,
                "isModelEstimate": True,
                "oddsAreMock": analytics.odds_are_mock,
                "explanation": analytics.explain_bullets or [],
                "matchupNote": analytics.matchup_note,
                "headshot": player.headshot_url if player else None,
            }
        )
    return out
