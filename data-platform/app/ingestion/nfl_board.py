"""NFL board — live ESPN warehouse props (no mock slate)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from statistics import mean
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Game, Odds, Player, PlayerGameLog, Prop, PropAnalytics, Team
from app.ingestion.nfl_pipeline import build_and_store_featured_nfl_prop, import_nfl_schedule
from app.providers.registry import get_nfl_providers

log = logging.getLogger(__name__)


def _team_abbr(db: Session, team_id: str | None) -> str:
    if not team_id:
        return "TEAM"
    t = db.get(Team, team_id)
    return t.abbreviation if t else "TEAM"


def list_nfl_props_from_warehouse(db: Session) -> list[dict[str, Any]]:
    rows = (
        db.execute(
            select(Prop, PropAnalytics, Player)
            .join(PropAnalytics, PropAnalytics.prop_id == Prop.id)
            .outerjoin(Player, Player.id == Prop.player_id)
            .where(Prop.league == "NFL")
            .order_by(PropAnalytics.research_score.desc())
            .limit(80)
        )
        .all()
    )
    out: list[dict[str, Any]] = []
    for prop, analytics, player in rows:
        game = db.get(Game, prop.game_id) if prop.game_id else None
        team_abbr = _team_abbr(db, player.team_id if player else None)
        opp = "OPP"
        tip = None
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

        odds_row = (
            db.execute(select(Odds).where(Odds.prop_id == prop.id).order_by(Odds.captured_at.desc()).limit(1))
            .scalar_one_or_none()
        )
        american = odds_row.american_odds if odds_row else -110
        if tip is None:
            stamp = (
                (odds_row.captured_at if odds_row and odds_row.captured_at else None)
                or getattr(analytics, "computed_at", None)
            )
            tip = stamp.isoformat() if stamp else None

        out.append(
            {
                "id": prop.id,
                "playerId": (player.external_id if player and player.external_id else (player.id if player else "")),
                "playerWarehouseId": player.id if player else None,
                "player": player.full_name if player else "Player",
                "team": team_abbr,
                "opponent": opp,
                "position": (player.position if player else None) or "SKILL",
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
                "projectedValue": analytics.projected_value,
                "edgeVsLine": analytics.edge_vs_line,
                "l5": f"{analytics.l5_hits or 0}/{analytics.l5_samples or 0}",
                "l10": f"{analytics.l10_hits or 0}/{analytics.l10_samples or 0}",
                "l20": f"{analytics.l20_hits or 0}/{analytics.l20_samples or 0}",
                "season": f"{analytics.season_hits or 0}/{analytics.season_samples or 0}",
                "tipTime": tip,
                "projectedSnapPct": 80,
                "injury": "None",
                "week": 0,
                "live": True,
                "explanation": analytics.explain_bullets or [],
            }
        )
    return out


def list_nfl_player_cards(db: Session) -> list[dict[str, Any]]:
    props = list_nfl_props_from_warehouse(db)
    by_player: dict[str, list[dict[str, Any]]] = {}
    for p in props:
        by_player.setdefault(str(p["playerId"]), []).append(p)
    cards = []
    for player_id, rows in by_player.items():
        top = max(rows, key=lambda r: r.get("evPercent") or 0)
        name = top["player"]
        initials = "".join(part[0] for part in name.split()[:2]).upper() or "?"
        cards.append(
            {
                "id": player_id,
                "name": name,
                "team": top["team"],
                "opponent": top["opponent"],
                "position": top["position"],
                "headshotInitials": initials,
                "projectedSnapPct": top.get("projectedSnapPct") or 80,
                "seasonAvg": {},
                "topPropId": top["id"],
                "confidence": top.get("researchScore") or top.get("confidence") or 50,
                "researchScore": top.get("researchScore") or top.get("confidence") or 50,
                "matchupNote": (top.get("explanation") or [None])[0]
                or f"{top['market']} {top['side']} {top['line']} · live model lean",
                "projections": [
                    {
                        "label": str(top["market"])[:6].upper(),
                        "value": float(top.get("projectedValue") or top["line"]),
                    }
                ],
                "insight": f"{top['market']} {top['side']} {top['line']}",
                "topLean": f"{top['market']} {top['side']} {top['line']}",
                "live": True,
            }
        )
    cards.sort(key=lambda c: c["researchScore"], reverse=True)
    return cards


def ensure_nfl_board(db: Session, *, force: bool = False, max_games: int = 6) -> dict[str, Any]:
    existing = list_nfl_props_from_warehouse(db)
    if existing and not force:
        return {
            "ok": True,
            "live": True,
            "source": "warehouse",
            "props": existing,
            "players": list_nfl_player_cards(db),
            "count": len(existing),
        }

    providers = get_nfl_providers()
    games = providers.schedule.fetch_schedule("NFL") if providers.schedule else []
    try:
        import_nfl_schedule(db)
    except Exception:
        log.exception("nfl schedule import failed")

    built = 0
    for game in games[:max_games]:
        try:
            result = build_and_store_featured_nfl_prop(db, game.external_id)
            if result.get("ok"):
                built += 1
        except Exception:
            log.exception("nfl featured build failed for %s", game.external_id)

    props = list_nfl_props_from_warehouse(db)
    return {
        "ok": True,
        "live": True,
        "source": "espn-nfl+model",
        "props": props,
        "players": list_nfl_player_cards(db),
        "count": len(props),
        "gamesSynced": built,
    }
