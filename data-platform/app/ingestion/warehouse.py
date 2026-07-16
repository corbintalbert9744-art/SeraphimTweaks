"""Warehouse upsert helpers — normalize provider DTOs into SQLAlchemy rows."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Game, Injury, Odds, Player, PlayerGameLog, Prop, Sportsbook, Team
from app.providers.base import (
    NormalizedGame,
    NormalizedGamelog,
    NormalizedInjury,
    NormalizedOddsQuote,
    NormalizedPlayer,
    NormalizedTeam,
)


def _id(*parts: str) -> str:
    return ":".join(p for p in parts if p)


def _provider_slug(league: str, raw: Optional[dict] = None) -> str:
    if raw and isinstance(raw.get("source"), str) and raw["source"]:
        return str(raw["source"])[:32]
    return {
        "NBA": "espn",
        "NFL": "espn",
        "WNBA": "espn",
        "MLB": "mlb-statsapi",
        "NHL": "nhl-api",
        "Soccer": "football-data-org",
        "ATP": "tennis",
        "WTA": "tennis",
    }.get(league.upper(), league.lower()[:32] or "provider")


def upsert_team(db: Session, t: NormalizedTeam) -> Team:
    # Prefer stable abbrev-based ids so schedule + roster paths converge.
    tid = _id(t.league.lower(), "team", t.abbreviation.lower() or t.external_id)
    team = db.get(Team, tid)
    if not team:
        # Existing row keyed by numeric external id (legacy) with same abbr
        existing = db.execute(
            select(Team).where(Team.league == t.league, Team.abbreviation == t.abbreviation)
        ).scalar_one_or_none()
        if existing:
            team = existing
        else:
            team = Team(id=tid, league=t.league, abbreviation=t.abbreviation, name=t.name)
            db.add(team)
    team.abbreviation = t.abbreviation
    team.name = t.name
    team.city = t.city
    team.logo_url = t.logo_url
    team.provider = _provider_slug(t.league)
    team.external_id = t.external_id or t.abbreviation or None
    team.updated_at = datetime.now(timezone.utc)
    return team


def upsert_team_from_game(db: Session, game: NormalizedGame, side: str) -> Team:
    ext = game.home_team_external_id if side == "home" else game.away_team_external_id
    abbr = game.home_abbr if side == "home" else game.away_abbr
    name = game.home_name if side == "home" else game.away_name
    logo = game.home_logo if side == "home" else game.away_logo
    tid = _id(game.league.lower(), "team", ext or abbr.lower())
    team = db.get(Team, tid)
    if not team:
        team = Team(id=tid, league=game.league, abbreviation=abbr, name=name)
        db.add(team)
    team.abbreviation = abbr
    team.name = name
    team.logo_url = logo
    team.provider = _provider_slug(game.league, game.raw)
    team.external_id = ext or None
    team.updated_at = datetime.now(timezone.utc)
    return team


def upsert_game(db: Session, g: NormalizedGame) -> Game:
    home = upsert_team_from_game(db, g, "home")
    away = upsert_team_from_game(db, g, "away")
    db.flush()
    gid = _id(g.league.lower(), "game", g.external_id)
    row = db.get(Game, gid)
    if not row:
        row = Game(id=gid, league=g.league, tipoff_at=g.tipoff_at, status=g.status)
        db.add(row)
    row.season = g.season
    row.tipoff_at = g.tipoff_at
    row.status = g.status
    row.home_team_id = home.id
    row.away_team_id = away.id
    row.home_score = g.home_score
    row.away_score = g.away_score
    row.venue = g.venue
    row.provider = _provider_slug(g.league, g.raw)
    row.external_id = g.external_id
    row.raw = g.raw
    row.updated_at = datetime.now(timezone.utc)
    return row


def upsert_player(db: Session, p: NormalizedPlayer, team_id: Optional[str] = None) -> Player:
    pid = _id(p.league.lower(), "player", p.external_id)
    row = db.get(Player, pid)
    if not row:
        row = Player(id=pid, league=p.league, full_name=p.full_name)
        db.add(row)
    row.full_name = p.full_name
    row.short_name = p.short_name
    row.position = p.position
    row.jersey = p.jersey
    row.headshot_url = p.headshot_url
    row.provider = _provider_slug(p.league)
    row.external_id = p.external_id
    row.active = True
    if team_id:
        row.team_id = team_id
    elif p.team_external_id:
        candidate = _id(p.league.lower(), "team", p.team_external_id)
        row.team_id = candidate if db.get(Team, candidate) else None
    row.updated_at = datetime.now(timezone.utc)
    return row


def upsert_gamelog(db: Session, g: NormalizedGamelog, player_id: str) -> PlayerGameLog:
    gid = _id("pgl", player_id, g.game_external_id or g.played_at.date().isoformat())
    row = db.get(PlayerGameLog, gid)
    if not row:
        row = PlayerGameLog(id=gid, player_id=player_id, played_at=g.played_at)
        db.add(row)
    # Only link game_id when the game row already exists (avoid FK failures on history).
    linked_game_id = None
    if g.game_external_id:
        candidate = _id(g.league.lower(), "game", g.game_external_id)
        if db.get(Game, candidate):
            linked_game_id = candidate
    row.game_id = linked_game_id
    row.played_at = g.played_at
    row.opponent = g.opponent
    row.home = g.home
    row.minutes = g.minutes
    row.points = g.points
    row.rebounds = g.rebounds
    row.assists = g.assists
    row.threes = g.threes
    row.steals = g.steals
    row.blocks = g.blocks
    row.raw = g.raw
    return row


def upsert_injury(db: Session, inj: NormalizedInjury) -> Injury:
    key = inj.player_external_id or inj.player_name or uuid.uuid4().hex
    iid = _id(inj.league.lower(), "inj", key, inj.status.replace(" ", "_")[:24])
    row = db.get(Injury, iid)
    if not row:
        row = Injury(id=iid, league=inj.league, status=inj.status)
        db.add(row)
    row.player_id = None
    row.team_id = None
    if inj.player_external_id:
        pid = _id(inj.league.lower(), "player", inj.player_external_id)
        if db.get(Player, pid):
            row.player_id = pid
    if inj.team_external_id:
        tid = _id(inj.league.lower(), "team", inj.team_external_id)
        if db.get(Team, tid):
            row.team_id = tid
    row.status = inj.status
    row.detail = inj.detail
    row.provider = "espn"
    row.reported_at = inj.reported_at or datetime.now(timezone.utc)
    return row


def ensure_sportsbook(
    db: Session,
    slug: str,
    name: str,
    *,
    kind: str = "sportsbook",
    provider: str = "manual",
) -> Sportsbook:
    pickem = {"prizepicks", "underdog", "sleeper", "parlayplay"}
    resolved_kind = "pickem" if slug in pickem else kind
    row = db.execute(select(Sportsbook).where(Sportsbook.slug == slug)).scalar_one_or_none()
    if row:
        if hasattr(row, "kind") and not row.kind:
            row.kind = resolved_kind
        return row
    row = Sportsbook(
        id=f"book:{slug}",
        name=name,
        slug=slug,
        kind=resolved_kind,
        provider=provider,
        active=True,
    )
    db.add(row)
    return row


def upsert_prop(
    db: Session,
    *,
    league: str,
    game_id: Optional[str],
    player_id: Optional[str],
    market: str,
    side: str,
    line: float,
) -> Prop:
    pid = _id(
        league.lower(),
        "prop",
        (player_id or "x").split(":")[-1],
        market.lower().replace(" ", ""),
        side.lower(),
        str(line),
    )
    row = db.get(Prop, pid)
    if not row:
        row = Prop(id=pid, league=league, market=market, side=side, line=line)
        db.add(row)
    row.game_id = game_id
    row.player_id = player_id
    row.market = market
    row.side = side
    row.line = line
    row.status = "open"
    row.updated_at = datetime.now(timezone.utc)
    return row


def insert_odds(
    db: Session,
    quote: NormalizedOddsQuote,
    prop_id: str,
    *,
    provider_name: Optional[str] = None,
) -> Odds:
    provider = provider_name or quote.source_provider or ("mock" if quote.is_mock else "line-aggregator")
    book = ensure_sportsbook(
        db,
        quote.sportsbook_slug,
        quote.sportsbook_name,
        kind="pickem" if quote.sportsbook_slug in {"prizepicks", "underdog", "sleeper", "parlayplay", "dabble"} else "sportsbook",
        provider=provider,
    )
    db.flush()
    oid = str(uuid.uuid4())
    row = Odds(
        id=oid,
        prop_id=prop_id,
        sportsbook_id=book.id,
        side=quote.side,
        american_odds=quote.american_odds,
        line=quote.line,
        implied_prob=None,
        provider=provider if not quote.is_mock else "mock",
        is_mock=quote.is_mock,
        captured_at=quote.captured_at or datetime.now(timezone.utc),
    )
    db.add(row)
    return row
