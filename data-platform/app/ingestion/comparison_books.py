"""Build market-comparison book rows for prop detail pages.

Rules:
  - Prefer live (non-mock) Odds rows for this prop and sibling props.
  - Match siblings by warehouse player id OR player display name + market.
  - Pass live quotes into the canonical catalog so PrizePicks / Underdog / etc.
    flip to connected instead of Unavailable.
  - Never invent sportsbook lines; placeholders stay requires_integration.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db.models import Odds, Player, Prop, Sportsbook
from app.providers.base import NormalizedOddsQuote
from app.providers.comparison_lines import (
    CANONICAL_LINE_PROVIDERS,
    edge_vs_projection,
    get_comparison_lines_provider,
)

PICKEM_SLUGS = {"prizepicks", "underdog", "sleeper", "parlayplay"}


def _slugify_book(slug: str | None, name: str) -> str:
    raw = (slug or name or "").lower().replace(" ", "").replace("-", "").replace("_", "")
    return raw


def _platform_from_prop_id(prop_id: str) -> Optional[str]:
    pid = (prop_id or "").lower()
    for slug in ("prizepicks", "underdog", "sleeper", "parlayplay", "fanduel", "draftkings", "betmgm"):
        if f":{slug}:" in pid or pid.endswith(f":{slug}") or f"pickem:{slug}:" in pid:
            return slug
    return None


def _odds_to_quotes(
    rows: list[tuple[Odds, Sportsbook]],
    *,
    league: str,
    player_name: str,
    player_external_id: Optional[str],
    market: str,
    game_external_id: Optional[str] = None,
) -> list[NormalizedOddsQuote]:
    out: list[NormalizedOddsQuote] = []
    for o, book in rows:
        if o.is_mock:
            continue
        slug = _slugify_book(book.slug if book else None, book.name if book else "book")
        name = book.name if book else "Book"
        side = (o.side or "Over").title()
        if side not in ("Over", "Under"):
            side = "Over"
        out.append(
            NormalizedOddsQuote(
                league=league,
                player_external_id=player_external_id,
                player_name=player_name,
                market=market,
                side=side,
                line=float(o.line),
                american_odds=int(o.american_odds if o.american_odds is not None else -110),
                sportsbook_slug=slug,
                sportsbook_name=name,
                game_external_id=game_external_id,
                captured_at=o.captured_at or datetime.now(timezone.utc),
                is_mock=False,
                source_provider="warehouse",
            )
        )
    return out


def _collect_live_odds_rows(
    db: Session,
    *,
    prop_id: str,
    player_warehouse_id: Optional[str],
    player_name: str,
    market: str,
    league: str,
) -> list[tuple[Odds, Sportsbook]]:
    """Live odds on this prop, same-player siblings, and same-name peers."""
    prop_ids: set[str] = {prop_id}

    if player_warehouse_id:
        for row in (
            db.execute(
                select(Prop.id).where(
                    Prop.player_id == player_warehouse_id,
                    Prop.market == market,
                    Prop.status == "open",
                )
            )
            .scalars()
            .all()
        ):
            prop_ids.add(str(row))

    if player_name:
        peer_ids = (
            db.execute(
                select(Player.id).where(
                    Player.full_name == player_name,
                    or_(Player.league == league, Player.league == league.upper()),
                )
            )
            .scalars()
            .all()
        )
        if peer_ids:
            for row in (
                db.execute(
                    select(Prop.id).where(
                        Prop.player_id.in_(list(peer_ids)),
                        Prop.market == market,
                        Prop.status == "open",
                    )
                )
                .scalars()
                .all()
            ):
                prop_ids.add(str(row))

    rows = (
        db.execute(
            select(Odds, Sportsbook)
            .join(Sportsbook, Sportsbook.id == Odds.sportsbook_id)
            .where(Odds.prop_id.in_(list(prop_ids)), Odds.is_mock.is_(False))
            .order_by(Odds.captured_at.desc())
        )
        .all()
    )
    return list(rows)


def _ensure_platform_quote_from_prop(
    quotes: list[NormalizedOddsQuote],
    *,
    prop_id: str,
    line: float,
    league: str,
    player_name: str,
    player_external_id: Optional[str],
    market: str,
) -> list[NormalizedOddsQuote]:
    """If this prop is a pick'em platform row, guarantee that operator has a live quote."""
    platform = _platform_from_prop_id(prop_id)
    if not platform:
        return quotes
    have = {(q.sportsbook_slug or "").lower() for q in quotes}
    if platform in have:
        return quotes
    spec = next((s for s in CANONICAL_LINE_PROVIDERS if s.slug == platform), None)
    name = spec.name if spec else platform.title()
    now = datetime.now(timezone.utc)
    for side in ("Over", "Under"):
        quotes.append(
            NormalizedOddsQuote(
                league=league,
                player_external_id=player_external_id,
                player_name=player_name,
                market=market,
                side=side,
                line=float(line),
                american_odds=-110,
                sportsbook_slug=platform,
                sportsbook_name=name,
                captured_at=now,
                is_mock=False,
                source_provider="platform-prop",
            )
        )
    return quotes


def build_market_comparison_books(
    db: Session,
    *,
    league: str,
    base: dict[str, Any],
    projected: float,
    model_side: str,
) -> list[dict[str, Any]]:
    """Return canonical comparison rows for the prop detail UI."""
    prop_id = str(base.get("id") or "")
    player_name = str(base.get("player") or "")
    player_ext = str(base.get("playerId") or "") or None
    player_wh = str(base.get("playerWarehouseId") or "") or None
    market = str(base.get("market") or "Points")
    baseline = float(base.get("line") or projected or 0)
    game_ext = None

    live_rows = _collect_live_odds_rows(
        db,
        prop_id=prop_id,
        player_warehouse_id=player_wh,
        player_name=player_name,
        market=market,
        league=league,
    )
    live_quotes = _odds_to_quotes(
        live_rows,
        league=league,
        player_name=player_name,
        player_external_id=player_ext,
        market=market,
        game_external_id=game_ext,
    )
    live_quotes = _ensure_platform_quote_from_prop(
        live_quotes,
        prop_id=prop_id,
        line=baseline,
        league=league,
        player_name=player_name,
        player_external_id=player_ext,
        market=market,
    )

    provider_lines = get_comparison_lines_provider().quote_lines(
        league=league,
        player_name=player_name,
        player_external_id=player_ext,
        market=market,
        baseline_line=baseline,
        projected_value=projected or baseline,
        live_quotes=live_quotes,
    )

    books: list[dict[str, Any]] = []
    for row in provider_lines:
        edge = edge_vs_projection(projected or baseline, float(row.line), model_side)
        books.append(
            {
                "book": row.name,
                "slug": row.slug,
                "kind": row.kind,
                "line": row.line,
                "over": row.over,
                "under": row.under,
                "isMock": row.is_mock,
                "connected": getattr(row, "connected", False),
                "requiresIntegration": getattr(row, "requires_integration", row.is_mock),
                "integrationNote": getattr(row, "notes", "") or None,
                "sourceProvider": getattr(row, "source_provider", None),
                "provider": getattr(row, "provider", None),
                "edgeVsProjection": edge,
                "projectedValue": projected or baseline,
                "modelSide": model_side,
            }
        )

    connected = [b for b in books if not b.get("requiresIntegration")]
    rank_pool = connected or books
    rank_pool.sort(key=lambda b: b.get("edgeVsProjection") or 0, reverse=True)
    books.sort(key=lambda b: (1 if b.get("requiresIntegration") else 0, -(b.get("edgeVsProjection") or 0)))
    for b in books:
        b["isBestValue"] = False
    if rank_pool:
        best_name = rank_pool[0]["book"]
        for b in books:
            if b["book"] == best_name and not b.get("requiresIntegration"):
                b["isBestValue"] = True
                break
        if not any(b.get("isBestValue") for b in books) and rank_pool:
            for b in books:
                if b["book"] == rank_pool[0]["book"]:
                    b["isBestValue"] = True
                    break
    return books
