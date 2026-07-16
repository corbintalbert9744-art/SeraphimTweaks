from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import get_db
from app.ingestion.generic_board import ensure_league_board, list_league_props
from app.ingestion.comparison_books import build_live_odds_comparison
from app.ingestion.multi_sport_sync import (
    sync_all_sports,
    sync_mlb_warehouse,
    sync_nhl_warehouse,
    sync_soccer_warehouse,
    sync_tennis_warehouse,
)
from app.ingestion.pickem_slate import ensure_soccer_pickem_board, ensure_tennis_pickem_board
from app.providers.espn.soccer import EspnSoccerProvider
from app.providers.espn.tennis import EspnTennisProvider
from app.providers.registry import get_mlb_providers, get_nhl_providers


def _players_from_props(props: list[dict]) -> list[dict]:
    """Unique player search cards from a prop board."""
    seen: set[str] = set()
    out: list[dict] = []
    for p in props:
        pid = str(p.get("playerId") or p.get("playerWarehouseId") or "")
        if not pid or pid in seen:
            continue
        seen.add(pid)
        name = str(p.get("player") or "")
        initials = "".join(part[0] for part in name.split()[:2] if part).upper() or "?"
        out.append(
            {
                "id": pid,
                "name": name,
                "team": p.get("team") or "",
                "opponent": p.get("opponent") or "",
                "position": p.get("position") or "",
                "headshotInitials": initials,
                "confidence": p.get("confidence") or 50,
                "researchScore": p.get("researchScore") or p.get("confidence") or 50,
                "matchupNote": (p.get("explanation") or [None])[0] or f"{p.get('market')} lean",
                "topPropId": p.get("id"),
                "topMarket": p.get("market"),
                "topSide": p.get("side"),
                "topLine": p.get("line"),
                "topLean": f"{p.get('side')} {p.get('line')}",
            }
        )
    return out


def _scope_to_platform(
    db: Session, props: list[dict], platform: str | None, *, league: str, refresh: bool = False
) -> tuple[list[dict], list[dict], dict]:
    """Live pick'em board for the selected app (PropLine → model)."""
    from app.ingestion.pickem_platform_sync import ensure_pickem_platform_board
    from app.ingestion.platform_board import normalize_pickem_app

    if not platform or not normalize_pickem_app(platform):
        players = _players_from_props(props)
        return props, players, {}
    scoped = ensure_pickem_platform_board(
        db, league=league, platform=platform, refresh=refresh
    )
    return scoped.get("props") or [], scoped.get("players") or [], {
        "platform": scoped.get("platform"),
        "platformLabel": scoped.get("platformLabel"),
        "dataSource": scoped.get("dataSource"),
        "note": scoped.get("note"),
        "updatedAt": scoped.get("updatedAt"),
        "propsUpdatedAt": scoped.get("propsUpdatedAt"),
        "syncedAt": scoped.get("syncedAt"),
        "requiresApiKey": scoped.get("requiresApiKey"),
        "envVar": scoped.get("envVar"),
        "disclaimer": scoped.get("disclaimer"),
        "live": scoped.get("live", True),
        "ok": scoped.get("ok", True),
        "source": scoped.get("source"),
        "cached": scoped.get("cached"),
        "stale": scoped.get("stale"),
        "modeledCount": scoped.get("modeledCount"),
        "refreshError": scoped.get("refreshError"),
        "rateLimited": scoped.get("rateLimited"),
    }

router = APIRouter(tags=["leagues"])


def _games_payload(games) -> list[dict]:
    return [
        {
            "id": g.external_id,
            "name": f"{g.away_name} at {g.home_name}",
            "shortName": f"{g.away_abbr} @ {g.home_abbr}",
            "tipoffAt": g.tipoff_at.isoformat(),
            "status": g.status,
            "venue": g.venue,
            "home": {
                "id": g.home_team_external_id,
                "abbreviation": g.home_abbr,
                "name": g.home_name,
                "score": g.home_score,
            },
            "away": {
                "id": g.away_team_external_id,
                "abbreviation": g.away_abbr,
                "name": g.away_name,
                "score": g.away_score,
            },
        }
        for g in games
    ]


@router.get("/mlb/games")
def mlb_games(dates: str | None = Query(None), db: Session = Depends(get_db)):
    providers = get_mlb_providers()
    games = providers.schedule.fetch_schedule("MLB", dates) if providers.schedule else []
    return {"date": dates, "source": "mlb-statsapi", "live": True, "games": _games_payload(games)}


@router.get("/mlb/props")
def mlb_props(
    refresh: bool = Query(False),
    platform: str | None = Query(None, description="Pick'em app: prizepicks|underdog|sleeper|other"),
    db: Session = Depends(get_db),
):
    from app.ingestion.platform_board import normalize_pickem_app

    if platform and normalize_pickem_app(platform):
        props, players, meta = _scope_to_platform(
            db, [], platform, league="MLB", refresh=refresh
        )
        teams = sorted({p["team"] for p in props if p.get("team") and p["team"] != "—"})
        markets = sorted({p["market"] for p in props if p.get("market")})
        return {
            "ok": True,
            "league": "MLB",
            "props": props,
            "players": players,
            "count": len(props),
            "teams": ["All", *teams],
            "markets": ["All", *markets],
            "live": True,
            "source": meta.get("source") or "propline",
            **meta,
        }

    if refresh:
        sync_mlb_warehouse(db)
    else:
        existing = list_league_props(db, "MLB")
        if not existing:
            sync_mlb_warehouse(db)
    props = list_league_props(db, "MLB")
    players = _players_from_props(props)
    teams = sorted({p["team"] for p in props if p.get("team")})
    markets = sorted({p["market"] for p in props if p.get("market")})
    return {
        "ok": True,
        "league": "MLB",
        "props": props,
        "players": players,
        "count": len(props),
        "teams": ["All", *teams],
        "markets": ["All", *markets],
        "live": True,
        "source": "mlb-statsapi",
        "disclaimer": "Select a pick'em app for live platform lines.",
    }


@router.get("/mlb/players")
def mlb_players(db: Session = Depends(get_db)):
    props = list_league_props(db, "MLB")
    if not props:
        sync_mlb_warehouse(db)
        props = list_league_props(db, "MLB")
    return {"ok": True, "league": "MLB", "players": _players_from_props(props)}


@router.get("/mlb/players/{player_id}")
def mlb_player_detail(player_id: str, db: Session = Depends(get_db)):
    from app.ingestion.multisport_player import get_multisport_player_profile

    profile = get_multisport_player_profile(db, league="MLB", player_key=player_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Player not found")
    return profile


@router.post("/mlb/jobs/sync")
def mlb_sync(dates: str | None = Query(None), db: Session = Depends(get_db)):
    return sync_mlb_warehouse(db, date=dates)


@router.get("/nhl/games")
def nhl_games(dates: str | None = Query(None), db: Session = Depends(get_db)):
    providers = get_nhl_providers()
    games = providers.schedule.fetch_schedule("NHL", dates) if providers.schedule else []
    return {"date": dates, "source": "nhl-api", "live": True, "games": _games_payload(games)}


@router.get("/nhl/props")
def nhl_props(
    refresh: bool = Query(False),
    platform: str | None = Query(None, description="Pick'em app: prizepicks|underdog|sleeper|other"),
    db: Session = Depends(get_db),
):
    from app.ingestion.platform_board import normalize_pickem_app

    if platform and normalize_pickem_app(platform):
        props, players, meta = _scope_to_platform(
            db, [], platform, league="NHL", refresh=refresh
        )
        teams = sorted({p["team"] for p in props if p.get("team") and p["team"] != "—"})
        markets = sorted({p["market"] for p in props if p.get("market")})
        return {
            "ok": True,
            "league": "NHL",
            "props": props,
            "players": players,
            "count": len(props),
            "teams": ["All", *teams],
            "markets": ["All", *markets],
            "live": True,
            "source": meta.get("source") or "propline",
            **meta,
        }

    if refresh:
        sync_nhl_warehouse(db)
    else:
        existing = list_league_props(db, "NHL")
        if not existing:
            sync_nhl_warehouse(db)
    props = list_league_props(db, "NHL")
    players = _players_from_props(props)
    teams = sorted({p["team"] for p in props if p.get("team")})
    markets = sorted({p["market"] for p in props if p.get("market")})
    return {
        "ok": True,
        "league": "NHL",
        "props": props,
        "players": players,
        "count": len(props),
        "teams": ["All", *teams],
        "markets": ["All", *markets],
        "live": True,
        "source": "nhl-api",
        "disclaimer": "Select a pick'em app for live platform lines.",
    }


@router.get("/nhl/players")
def nhl_players(db: Session = Depends(get_db)):
    props = list_league_props(db, "NHL")
    if not props:
        sync_nhl_warehouse(db)
        props = list_league_props(db, "NHL")
    return {"ok": True, "league": "NHL", "players": _players_from_props(props)}


@router.post("/nhl/jobs/sync")
def nhl_sync(dates: str | None = Query(None), db: Session = Depends(get_db)):
    return sync_nhl_warehouse(db, date=dates)


@router.get("/mlb/props/{prop_id}")
def mlb_prop_detail(prop_id: str, db: Session = Depends(get_db)):
    props = list_league_props(db, "MLB")
    row = next((p for p in props if p["id"] == prop_id), None)
    if not row:
        raise HTTPException(status_code=404, detail="Prop not found")
    projected = float(row.get("projectedValue") or row.get("line") or 0)
    comparison = build_live_odds_comparison(
        db,
        league="MLB",
        base=row,
        projected=projected,
        model_side=str(row.get("side") or "Over"),
    )
    books = comparison["books"]
    return {
        "ok": True,
        "prop": {
            **row,
            "books": books,
            "lines": books,
            "linesUpdatedAt": comparison.get("linesUpdatedAt"),
            "linesDiffer": comparison.get("linesDiffer", False),
            "connectedBookCount": comparison.get("connectedCount", 0),
            "consensusLine": comparison.get("consensusLine"),
            "bestValueBook": comparison.get("bestLineBook"),
            "oddsComparison": comparison,
        },
        "live": True,
        "league": "MLB",
    }


@router.get("/nhl/props/{prop_id}")
def nhl_prop_detail(prop_id: str, db: Session = Depends(get_db)):
    props = list_league_props(db, "NHL")
    row = next((p for p in props if p["id"] == prop_id), None)
    if not row:
        raise HTTPException(status_code=404, detail="Prop not found")
    projected = float(row.get("projectedValue") or row.get("line") or 0)
    comparison = build_live_odds_comparison(
        db,
        league="NHL",
        base=row,
        projected=projected,
        model_side=str(row.get("side") or "Over"),
    )
    books = comparison["books"]
    return {
        "ok": True,
        "prop": {
            **row,
            "books": books,
            "lines": books,
            "linesUpdatedAt": comparison.get("linesUpdatedAt"),
            "linesDiffer": comparison.get("linesDiffer", False),
            "connectedBookCount": comparison.get("connectedCount", 0),
            "consensusLine": comparison.get("consensusLine"),
            "bestValueBook": comparison.get("bestLineBook"),
            "oddsComparison": comparison,
        },
        "live": True,
        "league": "NHL",
    }


@router.get("/soccer/games")
def soccer_games(dates: str | None = Query(None), db: Session = Depends(get_db)):
    espn = EspnSoccerProvider()
    games = espn.fetch_schedule("Soccer", dates)
    return {
        "date": dates,
        "source": "espn-soccer",
        "live": True,
        "games": _games_payload(games),
        "note": "ESPN public scoreboard (no key). Optional FOOTBALL_DATA_API_KEY enriches fixtures.",
    }


@router.get("/soccer/props")
def soccer_props(
    refresh: bool = Query(False),
    platform: str | None = Query(None, description="Pick'em app: prizepicks|underdog|sleeper|other"),
    db: Session = Depends(get_db),
):
    from app.ingestion.platform_board import normalize_pickem_app

    if platform and normalize_pickem_app(platform):
        props, players, meta = _scope_to_platform(
            db, [], platform, league="Soccer", refresh=refresh
        )
        teams = sorted({p["team"] for p in props if p.get("team") and p["team"] != "—"})
        markets = sorted({p["market"] for p in props if p.get("market")})
        settings = get_settings()
        return {
            "ok": True,
            "league": "Soccer",
            "props": props,
            "players": players,
            "count": len(props),
            "teams": ["All", *teams],
            "markets": ["All", *markets],
            "live": True,
            "requiresApiKey": bool(meta.get("requiresApiKey")),
            "footballDataConfigured": bool(settings.football_data_api_key),
            "source": meta.get("source") or "propline",
            **meta,
        }

    if refresh or not list_league_props(db, "Soccer"):
        ensure_soccer_pickem_board(db)
    props = list_league_props(db, "Soccer")
    players = _players_from_props(props)
    teams = sorted({p["team"] for p in props if p.get("team")})
    markets = sorted({p["market"] for p in props if p.get("market")})
    settings = get_settings()
    return {
        "ok": True,
        "league": "Soccer",
        "props": props,
        "players": players,
        "count": len(props),
        "teams": ["All", *teams],
        "markets": ["All", *markets],
        "live": True,
        "source": "espn-soccer",
        "requiresApiKey": False,
        "footballDataConfigured": bool(settings.football_data_api_key),
        "note": (
            None
            if props
            else "No soccer roster athletes on the current ESPN slate — try refresh after fixtures post."
        ),
        "disclaimer": "Select a pick'em app for live PrizePicks/Underdog/Sleeper lines.",
    }


@router.get("/soccer/players")
def soccer_players(db: Session = Depends(get_db)):
    if not list_league_props(db, "Soccer"):
        ensure_soccer_pickem_board(db)
    return {"ok": True, "league": "Soccer", "players": _players_from_props(list_league_props(db, "Soccer"))}


@router.post("/soccer/jobs/sync")
def soccer_sync(dates: str | None = Query(None), db: Session = Depends(get_db)):
    return sync_soccer_warehouse(db, date=dates)


@router.get("/tennis/games")
def tennis_games(
    tour: str = Query("ATP"),
    dates: str | None = Query(None),
    db: Session = Depends(get_db),
):
    code = "WTA" if tour.upper() == "WTA" else "ATP"
    espn = EspnTennisProvider()
    games = espn.fetch_schedule(code, dates)
    return {"date": dates, "tour": code, "source": "espn-tennis", "live": True, "games": _games_payload(games)}


@router.get("/tennis/props")
def tennis_props(
    tour: str = Query("ATP"),
    refresh: bool = Query(False),
    platform: str | None = Query(None, description="Pick'em app: prizepicks|underdog|sleeper|other"),
    db: Session = Depends(get_db),
):
    from app.ingestion.platform_board import normalize_pickem_app

    code = "WTA" if tour.upper() == "WTA" else "ATP"
    if platform and normalize_pickem_app(platform):
        props, players, meta = _scope_to_platform(
            db, [], platform, league=code, refresh=refresh
        )
        # When live pick'em is empty (rate limit / no cache), keep the board usable
        # with the ESPN research slate — never invent PrizePicks lines, but don't
        # leave Tennis blank when matchups exist.
        if not props:
            if refresh or not list_league_props(db, code):
                ensure_tennis_pickem_board(db, tour=code)
            props = list_league_props(db, code)
            players = _players_from_props(props)
            label = meta.get("platformLabel") or platform
            prior = (meta.get("note") or "").strip()
            meta = {
                **meta,
                "ok": bool(props),
                "fallback": True,
                "fallbackSource": "espn-tennis",
                "source": "espn-tennis",
                "dataSource": "espn-tennis-research",
                "note": (
                    f"{prior} ".strip()
                    + f" Showing {code} research slate (Fantasy Score, Total Games, Total Sets) "
                    f"from ESPN matchups until live {label} lines sync. "
                    "These are Seraphim research lines — not scraped from the pick'em app."
                ).strip(),
            }
        teams = sorted({p["team"] for p in props if p.get("team") and p["team"] != "—"})
        markets = sorted({p["market"] for p in props if p.get("market")})
        return {
            "ok": bool(props) or bool(meta.get("ok")),
            "league": code,
            "props": props,
            "players": players,
            "count": len(props),
            "teams": ["All", *teams],
            "markets": ["All", *markets],
            "live": True,
            "source": meta.get("source") or "propline",
            **meta,
        }

    if refresh or not list_league_props(db, code):
        ensure_tennis_pickem_board(db, tour=code)
    props = list_league_props(db, code)
    players = _players_from_props(props)
    teams = sorted({p["team"] for p in props if p.get("team")})
    markets = sorted({p["market"] for p in props if p.get("market")})
    return {
        "ok": True,
        "league": code,
        "props": props,
        "players": players,
        "count": len(props),
        "teams": ["All", *teams],
        "markets": ["All", *markets],
        "live": True,
        "source": "espn-tennis",
        "requiresConfiguration": False,
        "note": (
            None
            if props
            else f"No {code} singles on the current ESPN scoreboard — try refresh when tournaments are live."
        ),
        "disclaimer": "Select a pick'em app for live PrizePicks/Underdog/Sleeper lines.",
    }


@router.get("/tennis/players")
def tennis_players(tour: str = Query("ATP"), db: Session = Depends(get_db)):
    code = "WTA" if tour.upper() == "WTA" else "ATP"
    if not list_league_props(db, code):
        ensure_tennis_pickem_board(db, tour=code)
    return {"ok": True, "league": code, "players": _players_from_props(list_league_props(db, code))}


@router.get("/tennis/props/{prop_id}")
def tennis_prop_detail(
    prop_id: str,
    tour: str = Query("ATP"),
    db: Session = Depends(get_db),
):
    code = "WTA" if tour.upper() == "WTA" else "ATP"
    # Prefer exact league; also search sibling tour (ATP/WTA mirrors)
    props = list_league_props(db, code)
    row = next((p for p in props if p["id"] == prop_id), None)
    if not row:
        sibling = "WTA" if code == "ATP" else "ATP"
        props = list_league_props(db, sibling)
        row = next((p for p in props if p["id"] == prop_id), None)
        if row:
            code = sibling
    if not row:
        raise HTTPException(status_code=404, detail="Prop not found")
    projected = float(row.get("projectedValue") or row.get("line") or 0)
    comparison = build_live_odds_comparison(
        db,
        league=code,
        base={**row, "league": code},
        projected=projected,
        model_side=str(row.get("side") or "Over"),
    )
    books = comparison["books"]
    return {
        "ok": True,
        "prop": {
            **row,
            "league": code,
            "books": books,
            "lines": books,
            "linesUpdatedAt": comparison.get("linesUpdatedAt"),
            "linesDiffer": comparison.get("linesDiffer", False),
            "connectedBookCount": comparison.get("connectedCount", 0),
            "consensusLine": comparison.get("consensusLine"),
            "bestValueBook": comparison.get("bestLineBook"),
            "oddsComparison": comparison,
        },
        "live": True,
        "league": code,
    }


@router.post("/tennis/jobs/sync")
def tennis_sync(tour: str = Query("ATP"), dates: str | None = Query(None), db: Session = Depends(get_db)):
    return sync_tennis_warehouse(db, tour=tour, date=dates)


@router.get("/tennis/status")
def tennis_status(tour: str = Query("ATP"), db: Session = Depends(get_db)):
    return sync_tennis_warehouse(db, tour=tour)


@router.post("/jobs/sync-all")
def sync_all(dates: str | None = Query(None), db: Session = Depends(get_db)):
    """Import every available legitimate source; never fabricates missing keys."""
    return sync_all_sports(db, date=dates)


@router.post("/jobs/sync-lines")
def sync_lines(db: Session = Depends(get_db)):
    """Refresh multi-provider market lines into Postgres (scheduled + manual)."""
    from app.ingestion.line_aggregation_sync import sync_aggregated_lines

    return sync_aggregated_lines(db)


@router.get("/lines/providers")
def line_providers_status():
    """Aggregator + adapter status for ops / debugging."""
    from app.providers.line_aggregation.factory import get_line_aggregator

    return get_line_aggregator().status()


@router.post("/leagues/{league}/board")
def rebuild_league_board(league: str, db: Session = Depends(get_db)):
    code = league.upper()
    if code in {"ATP", "WTA"}:
        return ensure_tennis_pickem_board(db, tour=code)
    if code == "SOCCER":
        return ensure_soccer_pickem_board(db)
    if code not in {"MLB", "NHL"}:
        raise HTTPException(status_code=404, detail="Unsupported league for generic board")
    return ensure_league_board(db, league=code, force=True)
