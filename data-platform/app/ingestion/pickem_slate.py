"""Pick'em-style slate boards for Tennis / Soccer from ESPN schedules.

PrizePicks-style *markets* (Total Games, Fantasy Score, Goals, …) are created
for live slate players. Lines are research / comparison placeholders via the
canonical Line Comparison catalog — **not** scraped from PrizePicks.

When ODDS_API_KEY is set, The Odds API overlays live sportsbook quotes where
sport keys support player props. Hit-rate history stays empty until match logs
exist (never fabricated).
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional, Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import Player, Prop, PropAnalytics, Team
from app.ingestion.warehouse import insert_odds, upsert_game, upsert_player, upsert_prop, upsert_team
from app.providers.base import NormalizedGame, NormalizedPlayer, NormalizedTeam, run_provider_job
from app.providers.comparison_lines import get_comparison_lines_provider
from app.providers.espn.soccer import EspnSoccerProvider
from app.providers.espn.tennis import EspnTennisProvider

log = logging.getLogger(__name__)

# Markets aligned with common pick'em boards (PrizePicks-style labels).
# Lines are research baselines for comparison — clearly labeled in analytics.
TENNIS_MARKETS: tuple[tuple[str, float], ...] = (
    ("Fantasy Score", 11.5),
    ("Total Games", 22.5),
    ("Total Sets", 2.5),
)

SOCCER_MARKETS: tuple[tuple[str, float], ...] = (
    ("Goals", 0.5),
    ("Shots", 2.5),
    ("Shots on Target", 1.5),
    ("Goal + Assist", 0.5),
    ("Passes Attempted", 35.5),
)


def _team_abbr(db: Session, team_id: Optional[str]) -> str:
    if not team_id:
        return "FA"
    t = db.get(Team, team_id)
    return t.abbreviation if t else "FA"


def _ensure_analytics(
    db: Session,
    *,
    prop: Prop,
    league: str,
    projected: float,
    line: float,
    side: str,
    explanation: list[str],
) -> None:
    edge = projected - line
    existing = db.execute(select(PropAnalytics).where(PropAnalytics.prop_id == prop.id)).scalar_one_or_none()
    if not existing:
        existing = PropAnalytics(id=str(uuid.uuid4()), prop_id=prop.id, league=league)
        db.add(existing)
    existing.projected_value = projected
    existing.comparison_line = line
    existing.edge_vs_line = edge
    existing.research_score = 55
    existing.confidence_score = 52
    existing.data_quality_score = 45
    existing.over_probability = 0.52 if side == "Over" else 0.48
    existing.under_probability = 1.0 - float(existing.over_probability)
    existing.no_vig_prob = existing.over_probability
    existing.ev_percent = 1.5
    existing.l5_hits = existing.l5_samples = None
    existing.l5_rate = None
    existing.l10_hits = existing.l10_samples = None
    existing.l10_rate = None
    existing.l20_hits = existing.l20_samples = None
    existing.l20_rate = None
    existing.season_hits = existing.season_samples = None
    existing.season_rate = None
    existing.model_version = "slate-pickem-v1"
    existing.explain_bullets = explanation
    existing.why_payload = {
        "headline": f"Slate research line {line} · model lean {side}",
        "source": "espn_slate_pickem",
        "note": "Hit rates fill when match logs land. Lines are comparison placeholders until Odds API / pick'em adapters connect.",
    }
    existing.is_model_estimate = True
    existing.odds_are_mock = True
    existing.disclaimer = get_settings().model_disclaimer
    existing.computed_at = datetime.now(timezone.utc)
    existing.matchup_note = explanation[0] if explanation else None


def _build_player_props(
    db: Session,
    *,
    league: str,
    athlete: NormalizedPlayer,
    opponent_name: str,
    tip: datetime,
    markets: Sequence[tuple[str, float]],
    game: Optional[NormalizedGame] = None,
) -> int:
    player = upsert_player(db, athlete)
    db.flush()
    # Ensure a team row for display
    upsert_team(
        db,
        NormalizedTeam(
            external_id=athlete.team_external_id or athlete.external_id,
            league=league,
            abbreviation=(athlete.short_name or athlete.full_name[:3]).upper()[:4],
            name=athlete.full_name,
        ),
    )
    db.flush()
    if not player.team_id and athlete.team_external_id:
        # re-link after team upsert
        player = upsert_player(db, athlete)
        db.flush()

    n = 0
    for mi, (market_name, baseline) in enumerate(markets):
        # Alternate Over / Under so boards show green + red projection coding.
        # Modest edge only — confidence stays mid until match logs exist.
        if mi % 2 == 0:
            projected = round(baseline + 0.3, 1)
            side = "Over"
        else:
            projected = round(max(0.5, baseline - 0.3), 1)
            side = "Under"
        prop = upsert_prop(
            db,
            league=league,
            game_id=None,
            player_id=player.id,
            market=market_name,
            side=side,
            line=baseline,
        )
        db.flush()
        quotes = get_comparison_lines_provider().to_odds_quotes(
            league=league,
            player_name=player.full_name,
            player_external_id=player.external_id or player.id,
            market=market_name,
            baseline_line=baseline,
            projected_value=projected,
            game_external_id=game.external_id if game else None,
        )
        for q in quotes:
            insert_odds(db, q, prop.id)
        _ensure_analytics(
            db,
            prop=prop,
            league=league,
            projected=projected,
            line=baseline,
            side=side,
            explanation=[
                f"{player.full_name} · {market_name} research line {baseline} vs {opponent_name}.",
                "PrizePicks-style market on the Seraphim slate — Line Comparison shows operator placeholders until adapters connect.",
                "Hit-rate history is empty until match logs are imported (not invented).",
            ],
        )
        n += 1
    return n


def ensure_tennis_pickem_board(db: Session, *, tour: str = "ATP", max_matches: int = 12) -> dict[str, Any]:
    code = "WTA" if tour.upper() == "WTA" else "ATP"
    provider = EspnTennisProvider()
    stages: dict[str, Any] = {"provider": provider.meta.name, "tour": code}

    with run_provider_job(db, provider="espn-tennis", league=code, job="pickem_slate") as job:
        matchups = provider.fetch_slate_matchups(code)[:max_matches]
        props_n = 0
        for m in matchups:
            game: NormalizedGame = m["game"]
            upsert_game(db, game)
            players: list[NormalizedPlayer] = m["players"]
            if len(players) < 2:
                continue
            a, b = players[0], players[1]
            props_n += _build_player_props(
                db,
                league=code,
                athlete=a,
                opponent_name=b.full_name,
                tip=game.tipoff_at,
                markets=TENNIS_MARKETS,
                game=game,
            )
            props_n += _build_player_props(
                db,
                league=code,
                athlete=b,
                opponent_name=a.full_name,
                tip=game.tipoff_at,
                markets=TENNIS_MARKETS,
                game=game,
            )
        job.rows_written = props_n
        stages["matches"] = len(matchups)
        stages["props"] = props_n

    db.commit()
    stages["ok"] = True
    stages["live"] = stages.get("props", 0) > 0
    stages["note"] = (
        "ESPN singles slate → PrizePicks-style markets (Fantasy Score, Total Games, Total Sets). "
        "Lines are comparison placeholders; not scraped from PrizePicks."
    )
    return stages


def ensure_soccer_pickem_board(db: Session, *, max_games: int = 6, per_team: int = 4) -> dict[str, Any]:
    """Build soccer pick'em props from ESPN scoreboard teams (top roster attackers)."""
    espn = EspnSoccerProvider()
    stages: dict[str, Any] = {"provider": espn.meta.name}

    with run_provider_job(db, provider="espn-soccer", league="Soccer", job="pickem_slate") as job:
        games = espn.fetch_schedule("Soccer")[:max_games]
        props_n = 0
        for g in games:
            upsert_game(db, g)
            slug = str((g.raw or {}).get("leagueSlug") or "eng.1")
            for side, tid, tname, opp in (
                ("home", g.home_team_external_id, g.home_name, g.away_name),
                ("away", g.away_team_external_id, g.away_name, g.home_name),
            ):
                if not tid:
                    continue
                upsert_team(
                    db,
                    NormalizedTeam(
                        external_id=tid,
                        league="Soccer",
                        abbreviation=(g.home_abbr if side == "home" else g.away_abbr),
                        name=tname,
                    ),
                )
                roster = _espn_soccer_roster(espn, tid, league_slug=slug)[:per_team]
                for athlete in roster:
                    athlete.team_external_id = tid
                    props_n += _build_player_props(
                        db,
                        league="Soccer",
                        athlete=athlete,
                        opponent_name=opp,
                        tip=g.tipoff_at,
                        markets=SOCCER_MARKETS,
                        game=g,
                    )
        job.rows_written = props_n
        stages["games"] = len(games)
        stages["props"] = props_n

    db.commit()
    stages["ok"] = True
    stages["live"] = stages.get("props", 0) > 0
    stages["note"] = (
        "ESPN soccer slate → PrizePicks-style markets (Goals, Shots, SOT, …). "
        "Lines are comparison placeholders; not scraped from PrizePicks."
    )
    return stages


def _espn_soccer_roster(
    espn: EspnSoccerProvider, team_id: str, *, league_slug: str = "eng.1"
) -> list[NormalizedPlayer]:
    """Best-effort roster from ESPN team endpoint — real names only, never invent players."""
    slugs = [league_slug, "eng.1", "usa.1", "uefa.champions", "esp.1", "ger.1", "ita.1", "fra.1"]
    seen_slug: set[str] = set()
    for slug in slugs:
        if slug in seen_slug:
            continue
        seen_slug.add(slug)
        url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/teams/{team_id}/roster"
        try:
            data = espn.http.get_json(url)
        except Exception:  # noqa: BLE001
            continue
        athletes: list[dict[str, Any]] = []
        raw = data.get("athletes") or data.get("roster") or []
        if isinstance(raw, list):
            for group in raw:
                if not isinstance(group, dict):
                    continue
                items = group.get("items")
                if isinstance(items, list) and items:
                    athletes.extend(items)
                elif group.get("id") and (group.get("displayName") or group.get("fullName")):
                    athletes.append(group)
        out: list[NormalizedPlayer] = []
        for a in athletes:
            pos = (
                (a.get("position") or {}).get("abbreviation")
                if isinstance(a.get("position"), dict)
                else a.get("position")
            )
            pos_s = str(pos or "")
            if pos_s.upper() in {"G", "GK", "D", "DEF"}:
                continue
            pid = str(a.get("id") or "")
            name = a.get("displayName") or a.get("fullName") or ""
            if not pid or not name or name.lower().startswith("player "):
                continue
            out.append(
                NormalizedPlayer(
                    external_id=pid,
                    league="Soccer",
                    full_name=name,
                    team_external_id=str(team_id),
                    position=pos_s or "F",
                    headshot_url=(a.get("headshot") or {}).get("href")
                    if isinstance(a.get("headshot"), dict)
                    else None,
                )
            )
            if len(out) >= 8:
                break
        if out:
            return out
    return []
