"""Scan open props for cross-book Over/Under arbitrage opportunities."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.arbitrage import (
    DEFAULT_TOTAL_STAKE,
    BookSideQuote,
    find_all_arbs,
    find_best_arb,
    quotes_from_comparison_books,
)
from app.db.models import Odds, Player, Prop, Sportsbook
from app.ingestion.comparison_books import build_live_odds_comparison
from app.ingestion.generic_board import list_league_props
from app.ingestion.nba_board import list_nba_props_from_warehouse
from app.ingestion.wnba_board import list_wnba_props_from_warehouse

log = logging.getLogger(__name__)

BOARD_LEAGUES = ("NBA", "WNBA", "NFL", "MLB", "NHL", "Soccer", "ATP", "WTA")
REFRESH_SECONDS = 300


def _collect_league_props(db: Session, league: str) -> list[dict[str, Any]]:
    code = league.upper() if league.upper() != "SOCCER" else "Soccer"
    if code == "NBA":
        return list_nba_props_from_warehouse(db)
    if code == "WNBA":
        return list_wnba_props_from_warehouse(db)
    return list_league_props(db, code)


def live_sportsbook_side_quotes(db: Session, prop_id: str) -> list[BookSideQuote]:
    """Raw live Odds rows for sportsbooks only (one quote per side)."""
    rows = (
        db.execute(
            select(Odds, Sportsbook)
            .join(Sportsbook, Sportsbook.id == Odds.sportsbook_id)
            .where(
                Odds.prop_id == prop_id,
                Odds.is_mock.is_(False),
                Sportsbook.kind == "sportsbook",
                Sportsbook.active.is_(True),
            )
            .order_by(Odds.captured_at.desc())
        )
        .all()
    )
    # Keep newest quote per (slug, side)
    best: dict[tuple[str, str], BookSideQuote] = {}
    for odds, book in rows:
        side = (odds.side or "").title()
        if side not in ("Over", "Under"):
            continue
        slug = (book.slug or book.name or "book").lower().replace(" ", "").replace("-", "")
        key = (slug, side)
        if key in best:
            continue
        best[key] = BookSideQuote(
            book=book.name or slug,
            slug=slug,
            line=float(odds.line),
            side=side,
            american=int(odds.american_odds),
            captured_at=odds.captured_at,
            source_provider=odds.provider,
        )
    return list(best.values())


def _sibling_prop_ids(db: Session, prop: dict[str, Any]) -> list[str]:
    """Include same player+market props so cross-book odds on siblings are visible."""
    ids = {str(prop.get("id") or "")}
    player_wh = prop.get("playerWarehouseId")
    market = prop.get("market")
    if player_wh and market:
        for row in (
            db.execute(
                select(Prop.id).where(
                    Prop.player_id == str(player_wh),
                    Prop.market == str(market),
                    Prop.status == "open",
                )
            )
            .scalars()
            .all()
        ):
            ids.add(str(row))
    return [i for i in ids if i]


def quotes_for_prop(db: Session, prop: dict[str, Any]) -> list[BookSideQuote]:
    """Merge DB sportsbook odds + comparison connected sportsbook sides."""
    quotes: list[BookSideQuote] = []
    seen: set[tuple[str, str, float, int]] = set()

    for pid in _sibling_prop_ids(db, prop):
        for q in live_sportsbook_side_quotes(db, pid):
            key = (q.slug, q.side, round(q.line, 2), q.american)
            if key in seen:
                continue
            seen.add(key)
            quotes.append(q)

    # Supplement from comparison catalog (live connected sportsbooks)
    try:
        league = str(prop.get("league") or "NBA")
        projected = float(prop.get("projectedValue") or prop.get("line") or 0)
        side = str(prop.get("side") or "Over")
        comparison = build_live_odds_comparison(
            db,
            league=league,
            base=prop,
            projected=projected,
            model_side=side if side in ("Over", "Under") else "Over",
        )
        for q in quotes_from_comparison_books(comparison.get("books") or []):
            key = (q.slug, q.side, round(q.line, 2), q.american)
            if key in seen:
                continue
            seen.add(key)
            quotes.append(q)
    except Exception:  # noqa: BLE001
        log.exception("arb comparison books failed for %s", prop.get("id"))

    return quotes


def scan_prop_arbitrage(
    db: Session,
    prop: dict[str, Any],
    *,
    total_stake: float = DEFAULT_TOTAL_STAKE,
) -> Optional[dict[str, Any]]:
    quotes = quotes_for_prop(db, prop)
    if len(quotes) < 2:
        return None
    best = find_best_arb(quotes, total_stake=total_stake)
    if best is None:
        return None
    all_arbs = find_all_arbs(quotes, total_stake=total_stake)[:5]
    return {
        "id": prop.get("id"),
        "propId": prop.get("id"),
        "league": prop.get("league"),
        "player": prop.get("player"),
        "playerId": prop.get("playerId"),
        "team": prop.get("team"),
        "opponent": prop.get("opponent"),
        "market": prop.get("market"),
        "side": prop.get("side"),
        "propLine": prop.get("line"),
        "projectedValue": prop.get("projectedValue"),
        "quoteCount": len(quotes),
        "booksScanned": sorted({q.book for q in quotes}),
        "arbitrage": best.to_api(),
        "alternates": [a.to_api() for a in all_arbs if a.profit_pct != best.profit_pct][:3],
        "profitPct": best.profit_pct,
        "isArbitrage": True,
    }


def build_arbitrage_board(
    db: Session,
    *,
    league: Optional[str] = None,
    total_stake: float = DEFAULT_TOTAL_STAKE,
    min_profit_pct: float = 0.0,
    limit: int = 50,
) -> dict[str, Any]:
    """Cross-league scan for guaranteed Over/Under arbs across sportsbooks."""
    leagues = [league] if league and league != "All" else list(BOARD_LEAGUES)
    # Dedupe by player+market so we don't repeat the same event from pick'em twins
    seen_keys: set[tuple[str, str, str]] = set()
    candidates: list[dict[str, Any]] = []

    for lg in leagues:
        try:
            rows = _collect_league_props(db, lg)
        except Exception:  # noqa: BLE001
            log.exception("arb league load failed %s", lg)
            continue
        for row in rows:
            row = {**row, "league": row.get("league") or lg}
            player = str(row.get("player") or "")
            market = str(row.get("market") or "")
            key = (str(row.get("league") or lg), player.lower(), market.lower())
            if not player or not market or key in seen_keys:
                continue
            seen_keys.add(key)
            candidates.append(row)

    # Cap scan for responsiveness
    candidates = candidates[: max(limit * 4, 80)]

    opportunities: list[dict[str, Any]] = []
    scanned = 0
    for prop in candidates:
        scanned += 1
        hit = scan_prop_arbitrage(db, prop, total_stake=total_stake)
        if hit is None:
            continue
        if float(hit.get("profitPct") or 0) < min_profit_pct:
            continue
        opportunities.append(hit)

    opportunities.sort(key=lambda r: float(r.get("profitPct") or 0), reverse=True)
    opportunities = opportunities[:limit]
    generated = datetime.now(timezone.utc).isoformat()

    return {
        "ok": True,
        "generatedAt": generated,
        "refreshSeconds": REFRESH_SECONDS,
        "totalStake": total_stake,
        "minProfitPct": min_profit_pct,
        "league": league or "All",
        "scannedProps": scanned,
        "count": len(opportunities),
        "opportunities": opportunities,
        "disclaimer": (
            "Arbitrage requires matching lines and live sportsbook Over/Under prices. "
            "Pick'em apps are excluded. Stake splits assume equal payout on either side; "
            "confirm limits and line identity at the books before betting."
        ),
    }
