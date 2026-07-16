"""Positive Expected Value (+EV) engine.

Compares Seraphim proprietary projections against every available market line
(sportsbooks + pick'em operators). Never invents odds — unavailable books are skipped.

Outputs per line:
  - model edge (projection units + %)
  - model probability P(side clears line) via Projection Engine residual
  - implied probability from American odds when priced
  - expected value % at offered (or conventional pick'em −110) odds
  - is_plus_ev when EV meets PLUS_EV_THRESHOLD
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Literal, Optional, Sequence

from app.analytics.engine import american_to_implied, expected_value, no_vig_pair
from app.analytics.prediction import estimate_side_probabilities

PLUS_EV_THRESHOLD = 4.0
STRONG_PLUS_EV_THRESHOLD = 12.0
PICKEM_CONVENTIONAL_AMERICAN = -110

SortKey = Literal["ev", "edge", "confidence", "researchScore"]


@dataclass
class MarketEvEvaluation:
    book: str
    slug: str
    kind: str  # sportsbook | pickem
    line: float
    side: str  # Over | Under — side with best EV (or model lean)
    american_odds: Optional[int]
    model_edge: float
    model_edge_pct: float
    model_probability: float
    implied_probability: Optional[float]
    no_vig_probability: Optional[float]
    expected_value: Optional[float]
    is_plus_ev: bool
    is_strong_plus_ev: bool
    pricing_mode: str  # live | pickem-standard | unavailable
    source_provider: Optional[str] = None

    def to_api(self) -> dict[str, Any]:
        d = asdict(self)
        return {
            "book": d["book"],
            "slug": d["slug"],
            "kind": d["kind"],
            "line": round(d["line"], 3),
            "side": d["side"],
            "americanOdds": d["american_odds"],
            "modelEdge": round(d["model_edge"], 3),
            "modelEdgePct": round(d["model_edge_pct"], 2),
            "modelProbability": round(d["model_probability"], 4),
            "impliedProbability": (
                round(d["implied_probability"], 4) if d["implied_probability"] is not None else None
            ),
            "noVigProbability": (
                round(d["no_vig_probability"], 4) if d["no_vig_probability"] is not None else None
            ),
            "expectedValue": (
                round(d["expected_value"], 2) if d["expected_value"] is not None else None
            ),
            "evPercent": (
                round(d["expected_value"], 2) if d["expected_value"] is not None else None
            ),
            "isPlusEv": d["is_plus_ev"],
            "isStrongPlusEv": d["is_strong_plus_ev"],
            "pricingMode": d["pricing_mode"],
            "sourceProvider": d["source_provider"],
        }


def model_edge_for_side(projected: float, line: float, side: str) -> float:
    raw = float(projected) - float(line)
    return round(raw if side == "Over" else -raw, 3)


def evaluate_side_at_line(
    *,
    projected: float,
    line: float,
    side: str,
    sigma: float,
    american: Optional[int],
    book: str,
    slug: str,
    kind: str,
    over_american: Optional[int] = None,
    under_american: Optional[int] = None,
    source_provider: Optional[str] = None,
    allow_pickem_conventional: bool = True,
) -> MarketEvEvaluation:
    """Score one (book, line, side) against the proprietary projection."""
    over_p, under_p = estimate_side_probabilities(float(projected), float(line), float(sigma))
    model_p = over_p if side == "Over" else under_p
    edge = model_edge_for_side(projected, line, side)
    edge_pct = round((edge / line) * 100, 2) if line else 0.0

    implied: Optional[float] = None
    no_vig: Optional[float] = None
    ev: Optional[float] = None
    pricing_mode = "unavailable"
    odds = american

    if over_american is not None and under_american is not None and kind == "sportsbook":
        nov_o, nov_u = no_vig_pair(int(over_american), int(under_american))
        no_vig = nov_o if side == "Over" else nov_u

    if odds is not None and kind == "sportsbook":
        implied = american_to_implied(int(odds))
        ev = expected_value(model_p, int(odds))
        pricing_mode = "live"
    elif kind == "pickem" and allow_pickem_conventional:
        # Pick'em is typically priced near −110; use conventional juice for EV.
        odds = PICKEM_CONVENTIONAL_AMERICAN
        implied = american_to_implied(odds)
        ev = expected_value(model_p, odds)
        pricing_mode = "pickem-standard"
    elif odds is not None:
        implied = american_to_implied(int(odds))
        ev = expected_value(model_p, int(odds))
        pricing_mode = "live"

    is_plus = ev is not None and ev >= PLUS_EV_THRESHOLD and edge > 0
    is_strong = ev is not None and ev >= STRONG_PLUS_EV_THRESHOLD and edge > 0

    return MarketEvEvaluation(
        book=book,
        slug=slug,
        kind=kind,
        line=float(line),
        side=side,
        american_odds=odds,
        model_edge=edge,
        model_edge_pct=edge_pct,
        model_probability=model_p,
        implied_probability=implied,
        no_vig_probability=no_vig,
        expected_value=ev,
        is_plus_ev=is_plus,
        is_strong_plus_ev=is_strong,
        pricing_mode=pricing_mode,
        source_provider=source_provider,
    )


def evaluate_book_quote(
    *,
    projected: float,
    sigma: float,
    book: dict[str, Any],
    preferred_side: Optional[str] = None,
) -> Optional[MarketEvEvaluation]:
    """Evaluate a connected comparison-book row; pick the better EV side."""
    if book.get("requiresIntegration") or book.get("isMock"):
        return None
    line = book.get("line")
    if line is None:
        return None
    kind = str(book.get("kind") or "sportsbook")
    name = str(book.get("book") or book.get("name") or "Book")
    slug = str(book.get("slug") or name).lower().replace(" ", "")
    over_a = book.get("over")
    under_a = book.get("under")
    source = book.get("sourceProvider") or book.get("provider")

    sides: list[str]
    if preferred_side in ("Over", "Under"):
        sides = [preferred_side, "Under" if preferred_side == "Over" else "Over"]
    else:
        sides = ["Over", "Under"]

    scored: list[MarketEvEvaluation] = []
    for side in sides:
        american = None
        if kind == "sportsbook":
            american = int(over_a) if side == "Over" and over_a is not None else None
            if side == "Under" and under_a is not None:
                american = int(under_a)
        scored.append(
            evaluate_side_at_line(
                projected=projected,
                line=float(line),
                side=side,
                sigma=sigma,
                american=american,
                book=name,
                slug=slug,
                kind=kind,
                over_american=int(over_a) if over_a is not None else None,
                under_american=int(under_a) if under_a is not None else None,
                source_provider=str(source) if source else None,
            )
        )

    # Prefer +EV, then highest EV, then largest model edge
    scored.sort(
        key=lambda r: (
            1 if r.is_plus_ev else 0,
            r.expected_value if r.expected_value is not None else -999,
            r.model_edge,
        ),
        reverse=True,
    )
    return scored[0] if scored else None


def evaluate_prop_markets(
    *,
    projected: float,
    sigma: float,
    books: Sequence[dict[str, Any]],
    platform_line: Optional[float] = None,
    platform_side: str = "Over",
    platform_book: str = "Platform",
    platform_slug: str = "platform",
    platform_kind: str = "pickem",
    american_odds: Optional[int] = None,
) -> list[MarketEvEvaluation]:
    """Score every available connected market line for one prop."""
    out: list[MarketEvEvaluation] = []
    seen: set[tuple[str, float]] = set()

    for book in books:
        ev = evaluate_book_quote(projected=projected, sigma=sigma, book=book, preferred_side=platform_side)
        if ev is None:
            continue
        key = (ev.slug, round(ev.line, 3))
        if key in seen:
            continue
        seen.add(key)
        out.append(ev)

    # Guarantee the prop's own platform / board line is evaluated
    if platform_line is not None:
        key = (platform_slug, round(float(platform_line), 3))
        if key not in seen:
            out.append(
                evaluate_side_at_line(
                    projected=projected,
                    line=float(platform_line),
                    side=platform_side if platform_side in ("Over", "Under") else "Over",
                    sigma=sigma,
                    american=american_odds if platform_kind == "sportsbook" else None,
                    book=platform_book,
                    slug=platform_slug,
                    kind=platform_kind,
                    allow_pickem_conventional=True,
                )
            )

    out.sort(
        key=lambda r: (
            1 if r.is_plus_ev else 0,
            r.expected_value if r.expected_value is not None else -999,
            r.model_edge,
        ),
        reverse=True,
    )
    return out


def best_market(evals: Sequence[MarketEvEvaluation]) -> Optional[MarketEvEvaluation]:
    return evals[0] if evals else None


def sigma_from_prop(prop: dict[str, Any]) -> float:
    raw = prop.get("residualSigma") or prop.get("residual_sigma")
    if raw is not None and float(raw) > 0:
        return float(raw)
    projected = float(prop.get("projectedValue") or prop.get("line") or 10)
    # Heuristic residual ~ 20% of projection, floored
    return max(0.75, abs(projected) * 0.2)


def enrich_prop_with_plus_ev(
    prop: dict[str, Any],
    *,
    books: Optional[Sequence[dict[str, Any]]] = None,
) -> dict[str, Any]:
    """Attach +EV fields to a board/detail prop dict."""
    projected = prop.get("projectedValue")
    if projected is None:
        return {
            **prop,
            "isPlusEv": False,
            "plusEvThreshold": PLUS_EV_THRESHOLD,
            "marketEv": [],
            "bestEv": None,
        }

    side = str(prop.get("recommendation") or prop.get("side") or "Over")
    if side not in ("Over", "Under"):
        side = "Over"
    sigma = sigma_from_prop(prop)
    platform = str(prop.get("platformSlug") or prop.get("platform") or "prizepicks")
    platform_name = str(prop.get("platformName") or platform.title())
    kind = "pickem" if ":pickem:" in str(prop.get("id") or "") or platform in {
        "prizepicks",
        "underdog",
        "sleeper",
        "parlayplay",
    } else "sportsbook"

    evals = evaluate_prop_markets(
        projected=float(projected),
        sigma=sigma,
        books=books or prop.get("books") or prop.get("lines") or [],
        platform_line=float(prop.get("line") or projected),
        platform_side=side,
        platform_book=platform_name,
        platform_slug=platform,
        platform_kind=kind,
        american_odds=int(prop["americanOdds"]) if prop.get("americanOdds") is not None else None,
    )
    best = best_market(evals)
    is_plus = bool(best and best.is_plus_ev)

    return {
        **prop,
        "isPlusEv": is_plus,
        "isStrongPlusEv": bool(best and best.is_strong_plus_ev),
        "plusEvThreshold": PLUS_EV_THRESHOLD,
        "strongPlusEvThreshold": STRONG_PLUS_EV_THRESHOLD,
        "modelEdge": best.model_edge if best else prop.get("edgeVsLine"),
        "modelEdgePct": best.model_edge_pct if best else prop.get("edgePercent"),
        "modelProbability": best.model_probability if best else prop.get("noVigProb"),
        "impliedProbability": best.implied_probability if best else None,
        "evPercent": best.expected_value if best and best.expected_value is not None else prop.get("evPercent"),
        "bestEvBook": best.book if best else None,
        "bestEvLine": best.line if best else None,
        "bestEvSide": best.side if best else side,
        "bestEv": best.to_api() if best else None,
        "marketEv": [e.to_api() for e in evals],
        "residualSigma": sigma,
    }


def sort_plus_ev_props(props: Sequence[dict[str, Any]], sort_by: SortKey = "ev") -> list[dict[str, Any]]:
    def key(p: dict[str, Any]) -> tuple:
        ev = float(p.get("evPercent") or -999)
        edge = float(p.get("modelEdge") or p.get("edgeVsLine") or -999)
        conf = float(p.get("confidence") or 0)
        rs = float(p.get("researchScore") or 0)
        if sort_by == "edge":
            return (edge, ev, rs, conf)
        if sort_by == "confidence":
            return (conf, ev, edge, rs)
        if sort_by == "researchScore":
            return (rs, ev, edge, conf)
        # default ev — break ties with model edge then research score
        return (ev, edge, rs, conf)

    return sorted(props, key=key, reverse=True)
