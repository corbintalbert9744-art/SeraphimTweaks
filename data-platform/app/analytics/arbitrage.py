"""2-way Over/Under arbitrage finder across connected sportsbooks.

Guaranteed profit when best Over + best Under implied probabilities sum to < 1
at the same line. Pick'em operators are excluded (no real priced O/U).
Never invents odds — only live non-mock sportsbook quotes.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any, Optional, Sequence

from app.analytics.engine import american_to_implied

DEFAULT_TOTAL_STAKE = 100.0
LINE_MATCH_EPS = 0.01


def american_to_decimal(american: int) -> float:
    if american > 0:
        return 1.0 + american / 100.0
    return 1.0 + 100.0 / abs(american)


@dataclass
class BookSideQuote:
    book: str
    slug: str
    line: float
    side: str  # Over | Under
    american: int
    captured_at: Optional[datetime] = None
    source_provider: Optional[str] = None


@dataclass
class ArbOpportunity:
    line: float
    over_book: str
    over_slug: str
    over_american: int
    under_book: str
    under_slug: str
    under_american: int
    over_implied: float
    under_implied: float
    sum_implied: float
    profit_pct: float
    total_stake: float
    stake_over: float
    stake_under: float
    expected_return: float
    profit: float
    over_decimal: float
    under_decimal: float
    lines_updated_at: Optional[str] = None

    def to_api(self) -> dict[str, Any]:
        return {
            "line": round(self.line, 3),
            "overBook": self.over_book,
            "overSlug": self.over_slug,
            "overAmerican": self.over_american,
            "underBook": self.under_book,
            "underSlug": self.under_slug,
            "underAmerican": self.under_american,
            "overImplied": round(self.over_implied, 6),
            "underImplied": round(self.under_implied, 6),
            "sumImplied": round(self.sum_implied, 6),
            "profitPct": round(self.profit_pct, 3),
            "totalStake": round(self.total_stake, 2),
            "stakeOver": round(self.stake_over, 2),
            "stakeUnder": round(self.stake_under, 2),
            "stakeAllocation": {
                "over": {
                    "book": self.over_book,
                    "slug": self.over_slug,
                    "side": "Over",
                    "american": self.over_american,
                    "stake": round(self.stake_over, 2),
                    "decimal": round(self.over_decimal, 4),
                },
                "under": {
                    "book": self.under_book,
                    "slug": self.under_slug,
                    "side": "Under",
                    "american": self.under_american,
                    "stake": round(self.stake_under, 2),
                    "decimal": round(self.under_decimal, 4),
                },
            },
            "expectedReturn": round(self.expected_return, 2),
            "profit": round(self.profit, 2),
            "linesUpdatedAt": self.lines_updated_at,
            "isArbitrage": True,
        }


def _line_bucket(line: float) -> float:
    return round(float(line) / LINE_MATCH_EPS) * LINE_MATCH_EPS


def build_arb(
    *,
    over: BookSideQuote,
    under: BookSideQuote,
    total_stake: float = DEFAULT_TOTAL_STAKE,
) -> Optional[ArbOpportunity]:
    """Build an arb opportunity if Over+Under implied probs sum below 1."""
    if abs(over.line - under.line) > LINE_MATCH_EPS:
        return None
    inv_o = american_to_implied(int(over.american))
    inv_u = american_to_implied(int(under.american))
    total_inv = inv_o + inv_u
    if total_inv >= 1.0 - 1e-12:
        return None

    dec_o = american_to_decimal(int(over.american))
    dec_u = american_to_decimal(int(under.american))
    stake = float(total_stake)
    stake_o = stake * (inv_o / total_inv)
    stake_u = stake * (inv_u / total_inv)
    expected = stake / total_inv
    profit = expected - stake
    profit_pct = (1.0 / total_inv - 1.0) * 100.0

    updated = None
    stamps = [t for t in (over.captured_at, under.captured_at) if t is not None]
    if stamps:
        newest = max(stamps)
        updated = newest.isoformat() if hasattr(newest, "isoformat") else str(newest)

    return ArbOpportunity(
        line=float(over.line),
        over_book=over.book,
        over_slug=over.slug,
        over_american=int(over.american),
        under_book=under.book,
        under_slug=under.slug,
        under_american=int(under.american),
        over_implied=inv_o,
        under_implied=inv_u,
        sum_implied=total_inv,
        profit_pct=profit_pct,
        total_stake=stake,
        stake_over=stake_o,
        stake_under=stake_u,
        expected_return=expected,
        profit=profit,
        over_decimal=dec_o,
        under_decimal=dec_u,
        lines_updated_at=updated,
    )


def find_best_arb(
    quotes: Sequence[BookSideQuote],
    *,
    total_stake: float = DEFAULT_TOTAL_STAKE,
) -> Optional[ArbOpportunity]:
    """Find the highest-profit 2-way arb among sportsbook side quotes (same line)."""
    by_line: dict[float, list[BookSideQuote]] = {}
    for q in quotes:
        if q.side not in ("Over", "Under"):
            continue
        by_line.setdefault(_line_bucket(q.line), []).append(q)

    best: Optional[ArbOpportunity] = None
    for line_key, group in by_line.items():
        overs = [q for q in group if q.side == "Over"]
        unders = [q for q in group if q.side == "Under"]
        if not overs or not unders:
            continue
        # Best price = lowest implied probability
        best_over = min(overs, key=lambda q: american_to_implied(int(q.american)))
        best_under = min(unders, key=lambda q: american_to_implied(int(q.american)))
        # Align displayed line to the over quote's actual line
        paired_over = BookSideQuote(
            book=best_over.book,
            slug=best_over.slug,
            line=best_over.line,
            side="Over",
            american=best_over.american,
            captured_at=best_over.captured_at,
            source_provider=best_over.source_provider,
        )
        paired_under = BookSideQuote(
            book=best_under.book,
            slug=best_under.slug,
            line=best_over.line if abs(best_under.line - best_over.line) <= LINE_MATCH_EPS else best_under.line,
            side="Under",
            american=best_under.american,
            captured_at=best_under.captured_at,
            source_provider=best_under.source_provider,
        )
        opp = build_arb(over=paired_over, under=paired_under, total_stake=total_stake)
        if opp is None:
            continue
        if best is None or opp.profit_pct > best.profit_pct:
            best = opp
    return best


def find_all_arbs(
    quotes: Sequence[BookSideQuote],
    *,
    total_stake: float = DEFAULT_TOTAL_STAKE,
) -> list[ArbOpportunity]:
    """All book-pair arbs at matching lines, best profit first."""
    overs = [q for q in quotes if q.side == "Over"]
    unders = [q for q in quotes if q.side == "Under"]
    out: list[ArbOpportunity] = []
    seen: set[tuple[str, str, float]] = set()
    for o in overs:
        for u in unders:
            opp = build_arb(over=o, under=u, total_stake=total_stake)
            if opp is None:
                continue
            key = (opp.over_slug, opp.under_slug, round(opp.line, 2))
            if key in seen:
                continue
            seen.add(key)
            out.append(opp)
    out.sort(key=lambda a: a.profit_pct, reverse=True)
    return out


def quotes_from_comparison_books(books: Sequence[dict[str, Any]]) -> list[BookSideQuote]:
    """Extract sportsbook side quotes from Live Odds Comparison rows.

    Only connected, non-mock sportsbooks. A side is included only when that
    book's O/U pair came from a live connection (not integration placeholders).
    Both Over and Under prices on a row are treated as live when connected.
    """
    out: list[BookSideQuote] = []
    for b in books:
        if b.get("requiresIntegration") or b.get("isMock"):
            continue
        if str(b.get("kind") or "") != "sportsbook":
            continue
        if not b.get("connected", True):
            continue
        name = str(b.get("book") or b.get("name") or "Book")
        slug = str(b.get("slug") or name).lower().replace(" ", "")
        line = b.get("line")
        if line is None:
            continue
        captured = None
        raw_ts = b.get("capturedAt")
        if isinstance(raw_ts, str) and raw_ts:
            try:
                captured = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
            except ValueError:
                captured = None
        source = b.get("sourceProvider") or b.get("provider")
        over = b.get("over")
        under = b.get("under")
        # Skip synthetic both-sides −110 with no upstream source (placeholder juice)
        if (
            over == -110
            and under == -110
            and not source
        ):
            continue
        if over is not None:
            out.append(
                BookSideQuote(
                    book=name,
                    slug=slug,
                    line=float(line),
                    side="Over",
                    american=int(over),
                    captured_at=captured,
                    source_provider=str(source) if source else None,
                )
            )
        if under is not None:
            out.append(
                BookSideQuote(
                    book=name,
                    slug=slug,
                    line=float(line),
                    side="Under",
                    american=int(under),
                    captured_at=captured,
                    source_provider=str(source) if source else None,
                )
            )
    return out
