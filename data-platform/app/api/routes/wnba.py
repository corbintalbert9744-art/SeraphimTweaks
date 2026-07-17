from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.ingestion.wnba_board import (
    ensure_wnba_board,
    get_wnba_player_profile,
    get_wnba_prop_detail,
    list_wnba_player_cards,
)
from app.providers.registry import get_wnba_providers

router = APIRouter(prefix="/wnba", tags=["wnba"])


@router.get("/games")
def wnba_games(dates: Optional[str] = Query(None), db: Session = Depends(get_db)):
    providers = get_wnba_providers()
    games = providers.schedule.fetch_schedule("WNBA", dates) if providers.schedule else []
    return {
        "date": dates,
        "source": "espn",
        "league": "WNBA",
        "games": [
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
                    "logo": g.home_logo,
                },
                "away": {
                    "id": g.away_team_external_id,
                    "abbreviation": g.away_abbr,
                    "name": g.away_name,
                    "score": g.away_score,
                    "logo": g.away_logo,
                },
            }
            for g in games
        ],
    }


@router.get("/props")
def wnba_props(
    refresh: bool = Query(False, description="Force re-ingest slate"),
    platform: Optional[str] = Query(
        None,
        description="Pick'em app id: prizepicks | underdog | sleeper | other",
    ),
    db: Session = Depends(get_db),
):
    """WNBA board — with platform, live pick'em feed first."""
    from app.ingestion.pickem_platform_sync import ensure_pickem_platform_board
    from app.ingestion.platform_board import normalize_pickem_app

    if platform and normalize_pickem_app(platform):
        payload = ensure_pickem_platform_board(
            db, league="WNBA", platform=platform, refresh=refresh
        )
        props = payload.get("props") or []
        # Keep the board usable like local Cursor when live pick'em is empty
        # (rate limit / cold cache) — prefer Cursor seed, then ESPN research slate.
        if not props:
            from app.ingestion.cursor_board_seed import load_cursor_board_seed

            seed = load_cursor_board_seed("WNBA", platform)
            if seed is not None:
                props = seed.get("props") or []
                teams = sorted({p["team"] for p in props if p.get("team") and p["team"] != "—"})
                markets = sorted({p["market"] for p in props if p.get("market")})
                return {
                    **seed,
                    "teams": seed.get("teams") or ["All", *teams],
                    "markets": seed.get("markets") or ["All", *markets],
                }
            research = ensure_wnba_board(db, force=refresh)
            props = research.get("props") or []
            players = research.get("players") or []
            teams = sorted({p["team"] for p in props if p.get("team") and p["team"] != "—"})
            markets = sorted({p["market"] for p in props if p.get("market")})
            label = payload.get("platformLabel") or platform
            return {
                **payload,
                "ok": bool(props),
                "props": props,
                "players": players,
                "count": len(props),
                "teams": ["All", *teams],
                "markets": ["All", *markets],
                "live": True,
                "fallback": True,
                "fallbackSource": "espn-wnba",
                "source": research.get("source") or "espn-wnba",
                "dataSource": "espn-wnba-research",
                "rateLimited": False,
                "requiresApiKey": False,
                "error": None,
                "note": (
                    f"Research slate active while live {label} lines refresh. "
                    "Seraphim projections vs research baselines — not scraped pick'em lines."
                ),
            }
        teams = sorted({p["team"] for p in props if p.get("team") and p["team"] != "—"})
        markets = sorted({p["market"] for p in props if p.get("market")})
        return {**payload, "teams": ["All", *teams], "markets": ["All", *markets], "live": True}

    payload = ensure_wnba_board(db, force=refresh)
    props = payload.get("props") or []
    players = payload.get("players") or []
    teams = sorted({p["team"] for p in props if p.get("team")})
    markets = sorted({p["market"] for p in props if p.get("market")})
    return {
        **payload,
        "props": props,
        "players": players,
        "count": len(props),
        "teams": ["All", *teams],
        "markets": ["All", *markets],
        "live": True,
        "disclaimer": "Select a pick'em app for live platform lines.",
    }


@router.get("/props/{prop_id}")
def wnba_prop_detail(prop_id: str, db: Session = Depends(get_db)):
    ensure_wnba_board(db, force=False)
    detail = get_wnba_prop_detail(db, prop_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Prop not found")
    return {"ok": True, "prop": detail, "live": True}


@router.get("/players")
def wnba_players(db: Session = Depends(get_db)):
    ensure_wnba_board(db, force=False)
    players = list_wnba_player_cards(db)
    return {"ok": True, "players": players, "count": len(players), "live": True}


@router.get("/players/{player_id}")
def wnba_player_detail(
    player_id: str,
    platform: Optional[str] = Query(
        None,
        description="Pick'em app id: prizepicks | underdog | sleeper — list every market that app has for this athlete",
    ),
    db: Session = Depends(get_db),
):
    from app.ingestion.player_detail import load_platform_player_profile

    # Default to PrizePicks so the desk lists cores + combos (PRA, Pts+Rebs, …).
    platform_key = platform or "prizepicks"

    def _fallback():
        ensure_wnba_board(db, force=False)
        return get_wnba_player_profile(db, player_id)

    profile, app = load_platform_player_profile(
        db,
        league="WNBA",
        player_id=player_id,
        platform=platform_key,
        fallback=_fallback,
    )
    if not profile or not (profile.get("markets") or []):
        raise HTTPException(status_code=404, detail="Player not found")
    return {"ok": True, "player": profile, "live": True, "platform": app}
