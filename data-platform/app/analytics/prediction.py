"""Seraphim Projection Engine V1.

Produces a projected stat value for every player prop from modular factors:
historical performance, recent form, home/away, opponent strength, expected
minutes, usage, injuries, and rest days.

Also returns confidence score, research score, and an explanation.
Sportsbook lines are optional comparison inputs only — never the projection source.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from statistics import mean, pstdev
from typing import Any, Optional, Sequence

from app.analytics.engine import (
    MODEL_DISCLAIMER,
    HitWindow,
    build_research_checks,
    confidence_score as legacy_confidence,
    data_quality_score,
    hit_rate,
    research_score_from_checks,
)
from app.analytics.factors import default_factor_stack
from app.analytics.factors.base import FactorResult, PredictionContext

MODEL_VERSION = "projection-engine-v1"

# Required V1 factor keys for coverage reporting
V1_FACTOR_KEYS = (
    "season_baseline",  # historical performance
    "recent_form",
    "home_away",
    "rest",
    "injury",
    "matchup",
    "expected_minutes",
    "usage",
)


@dataclass
class ModelPrediction:
    """Primary model output for a player prop."""

    projected_value: float
    over_probability: float
    under_probability: float
    research_score: int
    confidence_score: int
    data_quality_score: int
    explanation: list[str]
    influential_factors: list[dict[str, Any]]
    factors: list[FactorResult] = field(default_factory=list)
    comparison_line: Optional[float] = None
    edge_vs_line: Optional[float] = None
    model_version: str = MODEL_VERSION
    is_model_estimate: bool = True
    disclaimer: str = MODEL_DISCLAIMER
    l5: Optional[HitWindow] = None
    l10: Optional[HitWindow] = None
    l20: Optional[HitWindow] = None
    season: Optional[HitWindow] = None
    residual_sigma: float = 0.0
    baseline: float = 0.0

    def to_api_dict(self) -> dict[str, Any]:
        return {
            "modelVersion": self.model_version,
            "isModelEstimate": self.is_model_estimate,
            "disclaimer": self.disclaimer,
            "projectedValue": round(self.projected_value, 2),
            "projection": round(self.projected_value, 2),
            "confidence": self.confidence_score,
            "confidenceScore": self.confidence_score,
            "researchScore": self.research_score,
            "dataQualityScore": self.data_quality_score,
            "explanation": self.explanation,
            "overProbability": round(self.over_probability, 4),
            "underProbability": round(self.under_probability, 4),
            "influentialFactors": self.influential_factors,
            "comparisonLine": self.comparison_line,
            "edgeVsLine": round(self.edge_vs_line, 2) if self.edge_vs_line is not None else None,
            "residualSigma": round(self.residual_sigma, 2),
            "baseline": round(self.baseline, 2),
            "hitRates": {
                "l5": asdict(self.l5) if self.l5 else None,
                "l10": asdict(self.l10) if self.l10 else None,
                "l20": asdict(self.l20) if self.l20 else None,
                "season": asdict(self.season) if self.season else None,
            },
            "factorBreakdown": [
                {
                    "key": f.key,
                    "label": f.label,
                    "adjustment": round(f.adjustment, 3),
                    "weight": f.weight,
                    "impact": f.impact,
                    "detail": f.detail,
                    "available": f.available,
                }
                for f in self.factors
            ],
        }


def _normal_cdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def estimate_side_probabilities(
    projected: float,
    line: float,
    sigma: float,
) -> tuple[float, float]:
    """P(stat > line) and P(stat < line) under N(projected, sigma²)."""
    sig = max(sigma, 0.5)
    z = (line - projected) / sig
    under = _normal_cdf(z)
    over = 1.0 - under
    over = min(0.92, max(0.08, over))
    under = 1.0 - over
    return over, under


def model_edge_percent(
    *,
    projected: float,
    line: float,
    over_probability: float,
    under_probability: float,
    side: Optional[str] = None,
) -> float:
    """Display / rank edge % that stays coherent with pick'em lines.

    PrizePicks-style 0.5 / 1.5 markets are yes/no steps. Using
    ``(proj - line) / line`` there produces absurd values (e.g. 2.3 TB vs
    0.5 → +360%). For those lines we report the model probability edge vs
    a fair 50/50. For larger continuous lines we use a capped relative gap.
    """
    lean = side if side in ("Over", "Under") else ("Over" if projected >= line else "Under")
    lean_p = over_probability if lean == "Over" else under_probability
    try:
        lean_p = float(lean_p)
    except (TypeError, ValueError):
        lean_p = 0.5
    lean_p = min(0.99, max(0.01, lean_p))

    unit_edge = (projected - line) if lean == "Over" else (line - projected)

    # Step markets (Hits 0.5, Total Bases 0.5, Runs 0.5, …)
    if abs(float(line)) < 2.0 - 1e-9:
        return round((lean_p - 0.5) * 100.0, 2)

    if abs(float(line)) < 1e-9:
        return 0.0
    rel = (unit_edge / abs(float(line))) * 100.0
    return round(max(-75.0, min(75.0, rel)), 2)


def _research_from_factors(
    factors: Sequence[FactorResult],
    l10: HitWindow,
    l5: HitWindow,
    injury: str,
    *,
    minutes_ok: bool,
) -> int:
    by_key = {f.key: f for f in factors}
    v1_available = sum(1 for k in V1_FACTOR_KEYS if by_key.get(k) and by_key[k].available)
    coverage = v1_available / len(V1_FACTOR_KEYS)

    form = by_key.get("recent_form")
    direction = 0
    if form and form.available and abs(form.adjustment) >= 0.3:
        direction = 1 if form.adjustment > 0 else -1
    aligned = 0
    considered = 0
    for f in factors:
        if not f.available or f.key in ("season_baseline",) or f.impact == "neutral":
            continue
        considered += 1
        if direction == 0:
            continue
        if (f.adjustment > 0 and direction > 0) or (f.adjustment < 0 and direction < 0):
            aligned += 1
    agreement = (aligned / considered) if considered else 0.5

    checks = build_research_checks(
        l10=l10,
        l5=l5,
        injury_status=injury,
        books_agree=True,
        line_moved_favorably=None,
        minutes_ok=minutes_ok,
    )
    base = research_score_from_checks(checks)
    bonus = int(round(14 * coverage + 10 * agreement))
    return int(min(99, max(35, base * 0.65 + bonus + 18)))


def _rank_influential(factors: Sequence[FactorResult], limit: int = 5) -> list[dict[str, Any]]:
    scored = []
    for f in factors:
        if not f.available and abs(f.adjustment) < 1e-9:
            continue
        influence = abs(f.adjustment) * max(f.weight, 0.05)
        if not f.available:
            influence *= 0.15
        scored.append((influence, f))
    scored.sort(key=lambda t: t[0], reverse=True)
    out = []
    for influence, f in scored[:limit]:
        out.append(
            {
                "key": f.key,
                "label": f.label,
                "impact": f.impact,
                "adjustment": round(f.adjustment, 2),
                "detail": f.detail,
                "influenceScore": round(influence, 3),
            }
        )
    return out


def _build_explanation(
    *,
    projected: float,
    market: str,
    factors: Sequence[FactorResult],
    over_p: float,
    under_p: float,
    comparison_line: Optional[float],
    research: int,
    confidence: int,
    top: list[dict[str, Any]],
) -> list[str]:
    by_key = {f.key: f for f in factors}
    bullets = [
        f"Seraphim {MODEL_VERSION} projects {projected:.1f} {market} "
        f"(confidence {confidence}/100 · research {research}/100).",
        f"Model estimated P(over) {over_p * 100:.0f}% · P(under) {under_p * 100:.0f}%"
        + (f" vs comparison line {comparison_line}" if comparison_line is not None else "")
        + " — model estimate, not a guaranteed chance.",
    ]

    # One line per V1 pillar when available
    labels = {
        "season_baseline": "Historical",
        "recent_form": "Form",
        "home_away": "Venue",
        "matchup": "Opponent",
        "expected_minutes": "Minutes",
        "usage": "Usage",
        "injury": "Injury",
        "rest": "Rest",
    }
    bits = []
    for key, short in labels.items():
        f = by_key.get(key)
        if f and f.available and (abs(f.adjustment) >= 0.15 or key == "season_baseline"):
            if key == "season_baseline":
                bits.append(f"{short} {f.raw.get('baseline', projected):.1f}")
            else:
                bits.append(f"{short} {f.adjustment:+.1f}")
    if bits:
        bullets.append("Factor stack: " + " · ".join(bits) + ".")

    if top:
        names = ", ".join(t["label"] for t in top[:3])
        bullets.append(f"Most influential: {names}.")

    missing = [f.label for f in factors if not f.available and f.key in V1_FACTOR_KEYS]
    if missing:
        bullets.append(f"Light / missing inputs: {', '.join(missing[:4])}.")

    bullets.append(
        "Research Score reflects factor coverage and evidence agreement — not a win probability."
    )
    return bullets


def predict_prop(
    ctx: PredictionContext,
    *,
    comparison_line: Optional[float] = None,
    factors: Optional[Sequence] = None,
) -> ModelPrediction:
    """Run Projection Engine V1 and return projection + scores + explanation.

    ``comparison_line`` is optional — only for edge display vs a line the user
    sees elsewhere. It does not drive the projected value.
    """
    stack = list(factors) if factors is not None else default_factor_stack()
    results: list[FactorResult] = [f.evaluate(ctx) for f in stack]

    baseline_f = next((r for r in results if r.key == "season_baseline" and r.available), None)
    baseline = float(baseline_f.raw["baseline"]) if baseline_f else (mean(ctx.values) if ctx.values else 0.0)

    projected = baseline
    for r in results:
        if r.key == "season_baseline":
            continue
        if r.available:
            projected += r.adjustment

    projected = max(0.0, projected)

    sigma = float(baseline_f.raw.get("stdev") or 0.0) if baseline_f else 0.0
    if sigma < 0.5 and len(ctx.values) > 1:
        sigma = pstdev(ctx.values)
    sigma = max(sigma, 0.75)

    line_for_prob = comparison_line if comparison_line is not None else projected
    over_p, under_p = estimate_side_probabilities(projected, line_for_prob, sigma)

    ref_line = comparison_line if comparison_line is not None else projected
    l5 = hit_rate(ctx.values, ref_line, "Over", 5)
    l10 = hit_rate(ctx.values, ref_line, "Over", 10)
    l20 = hit_rate(ctx.values, ref_line, "Over", 20)
    season = hit_rate(ctx.values, ref_line, "Over", len(ctx.values))

    minutes_ok = any(r.key == "expected_minutes" and r.available for r in results)
    research = _research_from_factors(
        results, l10, l5, ctx.injury_status, minutes_ok=minutes_ok
    )
    conf = legacy_confidence(
        l10_rate=l10.rate,
        samples=l10.samples,
        ev_percent=(over_p - 0.5) * 20,
        injury_penalty=8
        if (ctx.injury_status or "None").lower() not in ("none", "healthy", "active", "probable")
        else 0,
    )
    by_key = {r.key: r for r in results}
    v1_coverage = sum(1 for k in V1_FACTOR_KEYS if by_key.get(k) and by_key[k].available) / len(
        V1_FACTOR_KEYS
    )
    # Sample size boost
    sample_boost = min(8, len(ctx.values) * 0.25)
    conf = int(min(98, max(40, conf * 0.8 + 22 * v1_coverage + sample_boost)))

    dqs = data_quality_score(
        has_gamelog=len(ctx.values) >= 3,
        gamelog_count=len(ctx.values),
        has_injury_feed=True,
        has_live_odds=False,
        freshness_minutes=5,
    )
    if by_key.get("matchup") and by_key["matchup"].available:
        dqs = min(98, dqs + 6)
    if by_key.get("expected_minutes") and by_key["expected_minutes"].available:
        dqs = min(98, dqs + 4)
    if by_key.get("usage") and by_key["usage"].available:
        dqs = min(98, dqs + 3)

    top = _rank_influential(results)
    explanation = _build_explanation(
        projected=projected,
        market=ctx.market,
        factors=results,
        over_p=over_p,
        under_p=under_p,
        comparison_line=comparison_line,
        research=research,
        confidence=conf,
        top=top,
    )

    edge = (projected - comparison_line) if comparison_line is not None else None

    return ModelPrediction(
        projected_value=projected,
        over_probability=over_p,
        under_probability=under_p,
        research_score=research,
        confidence_score=conf,
        data_quality_score=dqs,
        explanation=explanation,
        influential_factors=top,
        factors=results,
        comparison_line=comparison_line,
        edge_vs_line=edge,
        l5=l5,
        l10=l10,
        l20=l20,
        season=season,
        residual_sigma=sigma,
        baseline=baseline,
    )
