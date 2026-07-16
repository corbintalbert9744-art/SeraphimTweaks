"""Build market-comparison book rows for prop detail pages.

Rules:
  - Prefer live (non-mock) Odds rows for this prop and sibling props.
  - Match siblings by warehouse player id OR player display name + market.
  - Pass live quotes into the canonical catalog so PrizePicks / Underdog / etc.
    flip to connected instead of Unavailable.
  - Never invent sportsbook lines; placeholders stay requires_integration.
  - Surface capturedAt / line diffs / best-line flags for Live Odds Comparison UI.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db.models import LineSnapshot, Odds, Player, Prop, Sportsbook
from app.providers.base import NormalizedOddsQuote
from app.providers.comparison_lines import (
    CANONICAL_LINE_PROVIDERS,
    edge_vs_projection,
    get_comparison_lines_provider,
    normalize_book_slug,
)

PICKEM_SLUGS = {"prizepicks", "underdog", "sleeper", "parlayplay"}


def _slugify_book(slug: str | None, name: str) -> str:
    return normalize_book_slug(slug or name)


def _platform_from_prop_id(prop_id: str) -> Optional[str]:
    pid = (prop_id or "").lower()
    for slug in (
        "prizepicks",
        "underdog",
        "sleeper",
        "parlayplay",
        "fanduel",
        "draftkings",
        "betmgm",
        "caesars",
        "fanatics",
        "espnbet",
    ):
        if f":{slug}:" in pid or pid.endswith(f":{slug}") or f"pickem:{slug}:" in pid:
            return slug
    return None


def _iso(ts: Optional[datetime]) -> Optional[str]:
    if ts is None:
        return None
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts.isoformat()


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
                source_provider=o.provider or "warehouse",
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


def _latest_snapshot_at(db: Session, prop_id: str) -> Optional[datetime]:
    return db.execute(
        select(LineSnapshot.captured_at)
        .where(LineSnapshot.prop_id == prop_id)
        .order_by(LineSnapshot.captured_at.desc())
        .limit(1)
    ).scalar_one_or_none()


def _ensure_platform_quote_from_prop(
    quotes: list[NormalizedOddsQuote],
    *,
    prop_id: str,
    line: float,
    league: str,
    player_name: str,
    player_external_id: Optional[str],
    market: str,
    captured_at: Optional[datetime] = None,
) -> list[NormalizedOddsQuote]:
    """If this prop is a pick'em platform row, guarantee that operator has a live quote."""
    platform = _platform_from_prop_id(prop_id)
    if not platform:
        return quotes
    have = {normalize_book_slug(q.sportsbook_slug) for q in quotes}
    if platform in have:
        return quotes
    spec = next((s for s in CANONICAL_LINE_PROVIDERS if s.slug == platform), None)
    name = spec.name if spec else platform.title()
    now = captured_at or datetime.now(timezone.utc)
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


def _annotate_line_diffs(books: list[dict[str, Any]], *, model_side: str) -> dict[str, Any]:
    """Highlight best line, mark diffs vs consensus, attach summary meta."""
    connected = [b for b in books if not b.get("requiresIntegration")]
    connected_lines = [float(b["line"]) for b in connected]
    unique_lines = {round(x, 2) for x in connected_lines}
    lines_differ = len(unique_lines) > 1

    if connected_lines:
        sorted_lines = sorted(connected_lines)
        consensus = sorted_lines[len(sorted_lines) // 2]
    else:
        consensus = None

    timestamps = [b.get("capturedAt") for b in connected if b.get("capturedAt")]
    lines_updated_at = max(timestamps) if timestamps else None

    rank_pool = list(connected) or list(books)
    rank_pool.sort(key=lambda b: b.get("edgeVsProjection") or 0, reverse=True)
    books.sort(key=lambda b: (1 if b.get("requiresIntegration") else 0, -(b.get("edgeVsProjection") or 0)))

    for b in books:
        b["isBestValue"] = False
        b["linesDiffer"] = lines_differ
        if consensus is not None and not b.get("requiresIntegration"):
            b["lineDiffFromConsensus"] = round(float(b["line"]) - consensus, 2)
        else:
            b["lineDiffFromConsensus"] = None

    best_name = None
    best_line = None
    if rank_pool:
        best = rank_pool[0]
        best_name = best.get("book")
        best_line = float(best["line"]) if best.get("line") is not None else None
        for b in books:
            if b.get("book") == best_name and not b.get("requiresIntegration"):
                b["isBestValue"] = True
                break
        if not any(b.get("isBestValue") for b in books):
            for b in books:
                if b.get("book") == best_name:
                    b["isBestValue"] = True
                    break

    if best_line is not None:
        for b in books:
            if b.get("requiresIntegration"):
                b["lineDiffFromBest"] = None
                continue
            # Positive = this book is a higher line than best (worse for Over lean)
            raw = round(float(b["line"]) - best_line, 2)
            b["lineDiffFromBest"] = raw if model_side == "Over" else round(-raw, 2)
    else:
        for b in books:
            b["lineDiffFromBest"] = None

    return {
        "linesDiffer": lines_differ,
        "linesUpdatedAt": lines_updated_at,
        "consensusLine": consensus,
        "connectedCount": len(connected),
        "bestLineBook": best_name,
        "bestLine": best_line,
        "modelSide": model_side,
    }


def build_market_comparison_books(
    db: Session,
    *,
    league: str,
    base: dict[str, Any],
    projected: float,
    model_side: str,
) -> list[dict[str, Any]]:
    """Return canonical comparison rows for the prop detail UI."""
    payload = build_live_odds_comparison(
        db,
        league=league,
        base=base,
        projected=projected,
        model_side=model_side,
    )
    return payload["books"]


def build_live_odds_comparison(
    db: Session,
    *,
    league: str,
    base: dict[str, Any],
    projected: float,
    model_side: str,
) -> dict[str, Any]:
    """Full Live Odds Comparison payload (books + meta) for API / UI."""
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
    snap_at = _latest_snapshot_at(db, prop_id) if prop_id else None
    live_quotes = _ensure_platform_quote_from_prop(
        live_quotes,
        prop_id=prop_id,
        line=baseline,
        league=league,
        player_name=player_name,
        player_external_id=player_ext,
        market=market,
        captured_at=snap_at,
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
                "capturedAt": _iso(getattr(row, "captured_at", None)),
            }
        )

    meta = _annotate_line_diffs(books, model_side=model_side)
    if not meta.get("linesUpdatedAt") and snap_at is not None:
        meta["linesUpdatedAt"] = _iso(snap_at)

    return {
        "books": books,
        "lines": books,
        "linesUpdatedAt": meta.get("linesUpdatedAt"),
        "linesDiffer": meta.get("linesDiffer", False),
        "consensusLine": meta.get("consensusLine"),
        "connectedCount": meta.get("connectedCount", 0),
        "bestLineBook": meta.get("bestLineBook"),
        "bestLine": meta.get("bestLine"),
        "modelSide": model_side,
        "baselineLine": baseline,
        "projectedValue": projected or baseline,
        "providers": [
            {"slug": s.slug, "name": s.name, "kind": s.kind, "notes": s.notes}
            for s in CANONICAL_LINE_PROVIDERS
        ],
    }
