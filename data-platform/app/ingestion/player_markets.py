"""Helpers for player-desk market lists (cores + PrizePicks-style combos)."""

from __future__ import annotations

from typing import Any, Iterable, Optional

# Combo / alternate markets athletes commonly have on PrizePicks.
COMBO_MARKETS = frozenset(
    {
        "PRA",
        "PR",
        "PA",
        "RA",
        "Pts+Rebs",
        "Pts+Asts",
        "Rebs+Asts",
        "Pts+Rebs+Asts",
        "Steals+Blocks",
        "Blocks+Rebs",
        "Asts+TOs",
        "Fantasy Score",
        "Fantasy Points",
        "Double Double",
        "Triple Double",
    }
)

CORE_MARKETS = frozenset({"Points", "Rebounds", "Assists"})


def prop_source_rank(prop_id: str, prefer_platform: Optional[str] = None) -> int:
    """Lower is better. Prefer the selected pick'em app, then PrizePicks, then other pick'em."""
    pid = (prop_id or "").lower()
    app = (prefer_platform or "").lower().strip()
    if app and f":pickem:{app}:" in pid:
        return 0
    if ":pickem:prizepicks:" in pid:
        return 1
    if ":pickem:" in pid:
        return 2
    return 3


def markets_look_sparse(markets: Iterable[dict[str, Any]]) -> bool:
    """True when live pick'em rows lack combos — worth a provider refresh.

    Research-only combo tabs (propId contains `:research:`) do not count as
    live coverage; we still refresh to try to pull real PrizePicks combos.
    """
    pickem_labels = {
        str(m.get("market") or "").strip()
        for m in markets
        if m.get("market") and ":pickem:" in str(m.get("propId") or m.get("id") or "").lower()
    }
    if not pickem_labels:
        # No pick'em rows at all — refresh if we have any markets or none.
        labels = {str(m.get("market") or "").strip() for m in markets if m.get("market")}
        return True if not labels else not bool(labels & COMBO_MARKETS)
    if pickem_labels & COMBO_MARKETS:
        return False
    return True


def dedupe_market_rows(
    rows: list[dict[str, Any]],
    *,
    prefer_platform: Optional[str] = None,
    id_key: str = "propId",
    market_key: str = "market",
) -> list[dict[str, Any]]:
    """One row per market label — keep the best source / research score."""
    best: dict[str, dict[str, Any]] = {}
    for row in rows:
        label = str(row.get(market_key) or "").strip()
        if not label:
            continue
        key = label.lower()
        prev = best.get(key)
        if prev is None:
            best[key] = row
            continue
        prev_rank = prop_source_rank(str(prev.get(id_key) or prev.get("id") or ""), prefer_platform)
        next_rank = prop_source_rank(str(row.get(id_key) or row.get("id") or ""), prefer_platform)
        prev_score = float(prev.get("researchScore") or prev.get("confidence") or 0)
        next_score = float(row.get("researchScore") or row.get("confidence") or 0)
        if next_rank < prev_rank or (next_rank == prev_rank and next_score >= prev_score):
            best[key] = row
    return list(best.values())
