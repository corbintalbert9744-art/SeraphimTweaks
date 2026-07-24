"""Pure analytics — hit rates, splits, rest, streaks, pricing, scores, explainability.

Important: combined scores are Seraphim *model estimates*, not objective win probabilities.
Never present a parlay "chance of winning" as an exact probability.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Literal, Optional, Sequence

Side = Literal["Over", "Under"]


@dataclass
class HitWindow:
    hits: int
    samples: int
    rate: float
    label: str


def american_to_implied(american: int) -> float:
    if american > 0:
        return 100 / (american + 100)
    return abs(american) / (abs(american) + 100)


def no_vig_pair(over_american: int, under_american: int) -> tuple[float, float]:
    o = american_to_implied(over_american)
    u = american_to_implied(under_american)
    s = o + u or 1.0
    return o / s, u / s


def expected_value(prob: float, american: int) -> float:
    stake = 100.0
    profit = (american / 100) * stake if american > 0 else (100 / abs(american)) * stake
    return ((prob * profit - (1 - prob) * stake) / stake) * 100


def hit_rate(values: Sequence[float], line: float, side: Side, n: int) -> HitWindow:
    slice_ = list(values)[:n]
    samples = len(slice_)
    hits = sum(1 for v in slice_ if (v > line if side == "Over" else v < line))
    return HitWindow(
        hits=hits,
        samples=samples,
        rate=(hits / samples) if samples else 0.0,
        label=f"{hits}/{samples}" if samples else "0/0",
    )


def home_away_split(
    values: Sequence[float],
    homes: Sequence[bool],
    line: float,
    side: Side,
) -> tuple[Optional[float], Optional[float]]:
    home_vals = [v for v, h in zip(values, homes) if h]
    away_vals = [v for v, h in zip(values, homes) if not h]

    def rate(vals: list[float]) -> Optional[float]:
        if not vals:
            return None
        hits = sum(1 for v in vals if (v > line if side == "Over" else v < line))
        return hits / len(vals)

    return rate(home_vals), rate(away_vals)


def rest_days(played_at_sorted_desc: Sequence[datetime]) -> Optional[int]:
    if len(played_at_sorted_desc) < 2:
        return None
    delta = played_at_sorted_desc[0] - played_at_sorted_desc[1]
    return max(0, delta.days)


def streak(values: Sequence[float], line: float, side: Side) -> int:
    """Positive = consecutive clears for side; negative = consecutive misses."""
    if not values:
        return 0
    first = (values[0] > line) if side == "Over" else (values[0] < line)
    n = 0
    for v in values:
        hit = (v > line) if side == "Over" else (v < line)
        if hit == first:
            n += 1
        else:
            break
    return n if first else -n


@dataclass
class ResearchCheck:
    code: str
    status: Literal["pass", "warn", "fail", "unknown"]
    label: str


def research_score_from_checks(checks: Sequence[ResearchCheck]) -> int:
    pts = 0
    for c in checks:
        if c.status == "pass":
            pts += 16
        elif c.status == "warn":
            pts += 8
        elif c.status == "unknown":
            pts += 6
    return min(99, max(35, pts))


def build_research_checks(
    *,
    l10: HitWindow,
    l5: HitWindow,
    injury_status: str = "None",
    books_agree: bool = True,
    line_moved_favorably: Optional[bool] = None,
    minutes_ok: bool = True,
) -> list[ResearchCheck]:
    inj = injury_status.lower()
    return [
        ResearchCheck("L10", "pass" if l10.rate >= 0.7 else ("warn" if l10.rate >= 0.5 else "fail"), f"L10: {l10.label}"),
        ResearchCheck("L5", "pass" if l5.rate >= 0.6 else "warn", f"L5: {l5.label}"),
        ResearchCheck("BOOKS", "warn" if not books_agree else "pass", "Mild book split" if not books_agree else "Books clustered"),
        ResearchCheck(
            "MOVE",
            "pass" if line_moved_favorably else ("unknown" if line_moved_favorably is None else "warn"),
            "Line moved in favor" if line_moved_favorably else "Line movement pending",
        ),
        ResearchCheck("MIN", "warn" if not minutes_ok else "pass", "Minutes uncertainty" if not minutes_ok else "Workload projection OK"),
        ResearchCheck(
            "INJ",
            "pass" if inj in ("none", "healthy", "active") else "warn",
            "No injury concerns" if inj in ("none", "healthy", "active") else f"Injury: {injury_status}",
        ),
    ]


def confidence_score(*, l10_rate: float, samples: int, ev_percent: float, injury_penalty: float = 0) -> int:
    form = l10_rate * 55
    sample = min(20, samples) * 1.2
    edge = min(15, max(0, ev_percent) * 1.5)
    return int(round(min(98, max(40, form + sample + edge - injury_penalty))))


def data_quality_score(
    *,
    has_gamelog: bool,
    gamelog_count: int,
    has_injury_feed: bool,
    has_live_odds: bool,
    freshness_minutes: float,
) -> int:
    score = 40
    if has_gamelog:
        score += 20
    score += min(20, gamelog_count)
    if has_injury_feed:
        score += 8
    if has_live_odds:
        score += 12
    else:
        score -= 6
    if freshness_minutes <= 30:
        score += 10
    elif freshness_minutes <= 120:
        score += 5
    return int(min(98, max(30, score)))


def explain_prop(
    *,
    player: str,
    market: str,
    side: Side,
    line: float,
    l5: HitWindow,
    l10: HitWindow,
    l20: HitWindow,
    no_vig: float,
    ev_percent: float,
    research_score: int,
    matchup_note: Optional[str] = None,
) -> list[str]:
    return [
        f"{player} {side.lower()} {line} {market}: L10 {l10.label} ({round(l10.rate * 100)}%), L5 {l5.label}.",
        f"No-vig fair probability {no_vig * 100:.1f}% · model EV {ev_percent:+.1f}%.",
        f"Research Score {research_score}/100 is a checklist-backed model estimate — not a win guarantee.",
        matchup_note
        or "Matchup context will enrich as defensive rankings land in the warehouse.",
    ]


def build_prop_of_the_day_why(
    *,
    research_score: int,
    checks: Sequence[ResearchCheck],
    no_vig: float,
    ev_percent: float,
    l5: HitWindow,
    l10: HitWindow,
    l20: HitWindow,
    side: Side,
    line: float,
    market: str,
    matchup: str,
    open_line: float,
    current_line: float,
    injury_status: str = "None",
) -> dict:
    form_pct = round(l10.rate * 100)
    moved = current_line - open_line
    moved_favor = (side == "Over" and moved < 0) or (side == "Under" and moved > 0)
    pillars = [
        {
            "id": "research",
            "title": "Research Score",
            "status": "strong" if research_score >= 85 else ("solid" if research_score >= 70 else "watch"),
            "summary": f"{research_score}/100 checklist",
            "detail": f"{sum(1 for c in checks if c.status == 'pass')}/{len(checks)} gates passed — model estimate, not a win probability.",
        },
        {
            "id": "novig",
            "title": "No-vig edge",
            "status": "strong" if ev_percent >= 4 else ("solid" if ev_percent >= 1.5 else "watch"),
            "summary": f"{no_vig * 100:.1f}% fair · EV {ev_percent:+.1f}%",
            "detail": "Juice removed across the two-way; EV is vs the offered price, not a guarantee.",
        },
        {
            "id": "matchup",
            "title": "Matchup",
            "status": "solid" if injury_status.lower() == "none" else "watch",
            "summary": matchup,
            "detail": "Evidence-based matchup note — not a projected win chance.",
        },
        {
            "id": "form",
            "title": "Recent form",
            "status": "strong" if form_pct >= 70 else ("solid" if form_pct >= 50 else "watch"),
            "summary": f"L10 {l10.label} ({form_pct}%) · L5 {l5.label}",
            "detail": f"Cleared {side.lower()} {line} {market.lower()} in {l10.label} of last {l10.samples} games (L20 {l20.label}).",
        },
        {
            "id": "movement",
            "title": "Line movement",
            "status": "strong" if moved_favor else ("solid" if abs(moved) < 0.25 else "watch"),
            "summary": f"Stable at {current_line}" if moved == 0 else f"{open_line} → {current_line} ({moved:+})",
            "detail": "Line ticks are evidence; they do not imply a fixed chance of cashing.",
        },
    ]
    strong = sum(1 for p in pillars if p["status"] == "strong")
    verdict = (
        "strong"
        if strong >= 3 or (research_score >= 85 and form_pct >= 70)
        else ("solid" if strong >= 1 or research_score >= 70 else "watch")
    )
    headline = {
        "strong": "Strongest play on the board — form, research gates, and edge align.",
        "solid": "Solid lean — enough signals to feature, still respect variance.",
        "watch": "Watchlist lean — featured for transparency, not max conviction.",
    }[verdict]
    return {"headline": headline, "verdict": verdict, "pillars": pillars}


def checks_to_dicts(checks: Sequence[ResearchCheck]) -> list[dict]:
    return [asdict(c) for c in checks]


MODEL_DISCLAIMER = (
    "Seraphim scores (Research, Confidence, EV, no-vig) are model estimates from underlying "
    "evidence. They are not guaranteed or objective chances of winning a bet or parlay."
)
