"""Platform-specific pick'em boards.

Boards are driven by Odds rows for the selected pick'em app — not a generic
player database. Props without a live quote from that platform are excluded.
"""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Odds, Sportsbook

# User-facing pick'em app id → sportsbook slug(s) in the warehouse
PICKEM_APP_SLUGS: dict[str, frozenset[str]] = {
    "prizepicks": frozenset({"prizepicks"}),
    "underdog": frozenset({"underdog"}),
    "sleeper": frozenset({"sleeper"}),
    "other": frozenset({"parlayplay", "dabble"}),
}

PICKEM_APP_LABELS: dict[str, str] = {
    "prizepicks": "PrizePicks",
    "underdog": "Underdog Fantasy",
    "sleeper": "Sleeper",
    "other": "Other pick'em platforms",
}

KNOWN_PICKEM_SLUGS = frozenset().union(*PICKEM_APP_SLUGS.values()) | frozenset(
    {"prizepicks", "underdog", "sleeper", "parlayplay", "dabble"}
)

_RESEARCH_ODDS_ROLES = frozenset(
    {"comparison-only", "research", "model-only", "research-baseline"}
)


def is_live_betting_site_prop(row: dict[str, Any]) -> bool:
    """True only for props backed by a real pick'em / sportsbook quote.

    Rejects ESPN research slates, mock comparison placeholders, and seed files
    that were exported from the research warehouse (``:prop:`` + oddsAreMock).
    """
    if not isinstance(row, dict):
        return False
    if row.get("oddsAreMock") is True:
        return False
    role = str(row.get("oddsRole") or "").strip().lower()
    if role in _RESEARCH_ODDS_ROLES:
        return False
    pid = str(row.get("id") or "").lower()
    # Canonical live pick'em ids: league:pickem:prizepicks:…
    if ":pickem:" in pid:
        return True
    # Explicit live platform tagging from sync / cache
    if role in {"platform-live", "platform-board"} and row.get("platform"):
        return True
    platform = str(row.get("platform") or row.get("platformSlug") or "").strip().lower()
    if platform in KNOWN_PICKEM_SLUGS and row.get("platformLine") is not None:
        return True
    return False


def filter_live_betting_site_props(props: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep only players/markets listed on a connected betting site."""
    return [p for p in props if is_live_betting_site_prop(p)]


def empty_platform_board(
    *,
    league: str,
    platform: str,
    platform_label: Optional[str] = None,
    note: Optional[str] = None,
    **extra: Any,
) -> dict[str, Any]:
    """Member-safe empty board — never pad with research-slate players."""
    app = normalize_pickem_app(platform) or platform
    label = platform_label or PICKEM_APP_LABELS.get(app, app)
    return {
        "ok": False,
        "league": league,
        "platform": app,
        "platformLabel": label,
        "props": [],
        "players": [],
        "count": 0,
        "teams": ["All"],
        "markets": ["All"],
        "live": True,
        "fallback": False,
        "dataSource": f"pickem:{app}",
        "source": f"pickem:{app}",
        "note": note
        or (
            f"No live {label} props for {league} right now. "
            "Only players currently listed on the betting site appear here."
        ),
        **extra,
    }


def normalize_pickem_app(platform: Optional[str]) -> Optional[str]:
    if not platform:
        return None
    key = platform.strip().lower().replace(" ", "").replace("_", "").replace("-", "")
    aliases = {
        "prizepicks": "prizepicks",
        "pp": "prizepicks",
        "underdog": "underdog",
        "underdogfantasy": "underdog",
        "ud": "underdog",
        "sleeper": "sleeper",
        "other": "other",
        "otherpickem": "other",
        "others": "other",
    }
    return aliases.get(key)


def slugs_for_app(platform: str) -> frozenset[str]:
    app = normalize_pickem_app(platform)
    if not app:
        return frozenset()
    return PICKEM_APP_SLUGS.get(app, frozenset())


def _latest_platform_odds(
    db: Session, *, prop_ids: list[str], slugs: frozenset[str]
) -> dict[str, tuple[Odds, Sportsbook]]:
    """Return the newest Odds row per prop for any of the given sportsbook slugs."""
    if not prop_ids or not slugs:
        return {}
    rows = (
        db.execute(
            select(Odds, Sportsbook)
            .join(Sportsbook, Sportsbook.id == Odds.sportsbook_id)
            .where(Odds.prop_id.in_(prop_ids), Sportsbook.slug.in_(list(slugs)))
            .order_by(Odds.captured_at.desc())
        )
        .all()
    )
    best: dict[str, tuple[Odds, Sportsbook]] = {}
    for odds, book in rows:
        if (book.slug or "").lower() not in slugs:
            continue  # defense if caller/mock ignores SQL slug filter
        # Prefer Over when both sides exist; first row is newest overall
        existing = best.get(odds.prop_id)
        if existing is None:
            best[odds.prop_id] = (odds, book)
            continue
        prev, _ = existing
        if (prev.side or "").lower() != "over" and (odds.side or "").lower() == "over":
            if odds.captured_at >= prev.captured_at:
                best[odds.prop_id] = (odds, book)
    return best


def apply_pickem_platform_filter(
    db: Session,
    props: list[dict[str, Any]],
    platform: Optional[str],
    *,
    players: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    """Keep only props with a warehouse quote from the selected pick'em app.

    Overrides ``line`` with the platform line and recalculates edge vs projection.
    Never invents platform lines — empty board when the app has no cached quotes.
    """
    app = normalize_pickem_app(platform)
    if not app:
        return {
            "props": props,
            "players": players or [],
            "platform": None,
            "platformLabel": None,
            "platformRequired": True,
            "note": "Select a pick'em app to load that platform's board.",
        }

    slugs = slugs_for_app(app)
    label = PICKEM_APP_LABELS.get(app, app)
    prop_ids = [str(p["id"]) for p in props if p.get("id")]
    odds_by_prop = _latest_platform_odds(db, prop_ids=prop_ids, slugs=slugs)

    filtered: list[dict[str, Any]] = []
    for row in props:
        pid = str(row.get("id") or "")
        hit = odds_by_prop.get(pid)
        if not hit:
            continue
        odds, book = hit
        platform_line = float(odds.line)
        projected = row.get("projectedValue")
        projected_f = float(projected) if projected is not None else None
        side = str(row.get("side") or "Over")
        if projected_f is not None:
            from app.analytics.prediction import estimate_side_probabilities, model_edge_percent

            # Re-lean vs this app's line
            model_side = "Over" if projected_f >= platform_line else "Under"
            edge = round(projected_f - platform_line, 2)
            sigma = float(row.get("residualSigma") or row.get("sigma") or 1.25)
            over_p, under_p = estimate_side_probabilities(projected_f, platform_line, sigma)
            if row.get("overProbability") is not None:
                try:
                    over_p = float(row["overProbability"])
                    under_p = float(row.get("underProbability") or (1.0 - over_p))
                except (TypeError, ValueError):
                    pass
            edge_pct = model_edge_percent(
                projected=projected_f,
                line=platform_line,
                over_probability=over_p,
                under_probability=under_p,
                side=model_side,
            )
        else:
            model_side = side
            edge = row.get("edgeVsLine")
            edge_pct = None

        enriched = {
            **row,
            "line": platform_line,
            "americanOdds": int(odds.american_odds),
            "side": model_side,
            "edgeVsLine": edge,
            "edgePercent": edge_pct,
            "comparisonLine": platform_line,
            "platform": app,
            "platformSlug": book.slug,
            "platformName": book.name or label,
            "platformLine": platform_line,
            "oddsAreMock": bool(odds.is_mock),
            "oddsRole": "platform-board",
            "sourceProvider": odds.provider,
        }
        filtered.append(enriched)

    # Players limited to those appearing on this platform board
    player_ids = {
        str(p.get("playerId") or p.get("playerWarehouseId") or "")
        for p in filtered
        if p.get("playerId") or p.get("playerWarehouseId")
    }
    scoped_players: list[dict[str, Any]] = []
    if players:
        for card in players:
            cid = str(card.get("id") or "")
            if cid and cid in player_ids:
                scoped_players.append(card)
    else:
        # Build minimal cards from filtered props
        seen: set[str] = set()
        for p in filtered:
            pid = str(p.get("playerId") or p.get("playerWarehouseId") or "")
            if not pid or pid in seen:
                continue
            seen.add(pid)
            name = str(p.get("player") or "")
            initials = "".join(part[0] for part in name.split()[:2] if part).upper() or "?"
            scoped_players.append(
                {
                    "id": pid,
                    "name": name,
                    "team": p.get("team") or "",
                    "opponent": p.get("opponent") or "",
                    "position": p.get("position") or "",
                    "headshotInitials": initials,
                    "confidence": p.get("confidence") or 50,
                    "researchScore": p.get("researchScore") or p.get("confidence") or 50,
                    "matchupNote": f"{p.get('market')} · {label}",
                    "topPropId": p.get("id"),
                    "topMarket": p.get("market"),
                    "topSide": p.get("side"),
                    "topLine": p.get("line"),
                    "topLean": f"{p.get('side')} {p.get('line')}",
                }
            )

    note = None
    if not filtered:
        note = (
            f"No {label} lines in the warehouse for this league yet. "
            "Run line sync (PropLine / SharpAPI / Odds API) so only that app's "
            "available players appear — we do not invent platform boards."
        )

    return {
        "props": filtered,
        "players": scoped_players,
        "platform": app,
        "platformLabel": label,
        "platformRequired": False,
        "count": len(filtered),
        "note": note,
        "dataSource": f"pickem:{app}",
    }
