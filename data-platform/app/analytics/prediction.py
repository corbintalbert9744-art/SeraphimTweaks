"""Seraphim rule-based prediction engine (v1).

Produces *our* projected value and over/under probabilities from modular
factors. Sportsbook lines are optional comparison inputs only — never the
source of the projection.

Staged roadmap: rule-based first → ML later once the warehouse has history.
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

MODEL_VERSION = "rule-based-v1"


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
    comparison_line: Optional[float] = None  # external line for user comparison only
    edge_vs_line: Optional[float] = None  # projected − comparison_line
    model_version: str = MODEL_VERSION
    is_model_estimate: bool = True
    disclaimer: str = MODEL_DISCLAIMER
    # Supporting evidence (not sportsbook-derived)
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
            "overProbability": round(self.over_probability, 4),
            "underProbability": round(self.under_probability, 4),
            "researchScore": self.research_score,
            "confidenceScore": self.confidence_score,
            "dataQualityScore": self.data_quality_score,
            "explanation": self.explanation,
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
    """Standard normal CDF via erf — no scipy dependency."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def estimate_side_probabilities(
    projected: float,
    line: float,
    sigma: float,
) -> tuple[float, float]:
    """P(stat > line) and P(stat < line) under N(projected, sigma²).

    Rule-based distributional assumption — clearly a model estimate.
    Push probability (exact line) is split evenly into over/under for props.
    """
    sig = max(sigma, 0.5)
    # Continuity: treat as P(X > line) with half-mass at equality assigned 50/50
    z = (line - projected) / sig
    # P(X <= line) ≈ Φ(z); over ≈ 1 - Φ(z)
    under = _normal_cdf(z)
    over = 1.0 - under
    # Soft floor so UI never shows 0/100
    over = min(0.92, max(0.08, over))
    under = 1.0 - over
    return over, under


def _research_from_factors(factors: Sequence[FactorResult], l10: HitWindow, l5: HitWindow, injury: str) -> int:
    available = [f for f in factors if f.available]
    coverage = len(available) / max(1, len(factors))
    # Agreement: how many non-neutral impacts align with recent form direction
    form = next((f for f in factors if f.key == "recent_form" and f.available), None)
    direction = 0
    if form and abs(form.adjustment) >= 0.3:
        direction = 1 if form.adjustment > 0 else -1
    aligned = 0
    considered = 0
    for f in available:
        if f.key in ("season_baseline",) or f.impact == "neutral":
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
        books_agree=True,  # not used as sportsbook input — treated as neutral gate
        line_moved_favorably=None,
        minutes_ok=True,
    )
    base = research_score_from_checks(checks)
    # Blend coverage + agreement into research score
    bonus = int(round(12 * coverage + 10 * agreement))
    return int(min(99, max(35, base * 0.7 + bonus + 15)))


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
    top: list[dict[str, Any]],
) -> list[str]:
    bullets = [
        f"Seraphim {MODEL_VERSION} projects {projected:.1f} {market} from modular factors "
        f"(not a sportsbook line).",
        f"Model estimated P(over) {over_p * 100:.0f}% · P(under) {under_p * 100:.0f}%"
        + (f" vs comparison line {comparison_line}" if comparison_line is not None else "")
        + " — model estimate, not a guaranteed chance.",
        f"Research Score {research}/100 reflects factor coverage, form, and availability — not a win probability.",
    ]
    if top:
        names = ", ".join(t["label"] for t in top[:3])
        bullets.append(f"Most influential factors: {names}.")
    missing = [f.label for f in factors if not f.available]
    if missing:
        bullets.append(f"Missing / light inputs (improves as warehouse fills): {', '.join(missing[:4])}.")
    return bullets


def predict_prop(
    ctx: PredictionContext,
    *,
    comparison_line: Optional[float] = None,
    factors: Optional[Sequence] = None,
) -> ModelPrediction:
    """Run the modular rule-based stack and return a full model prediction.

    `comparison_line` is optional — only for edge display vs a line the user
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

    # Floor projection at 0 for counting stats
    projected = max(0.0, projected)

    sigma = float(baseline_f.raw.get("stdev") or 0.0) if baseline_f else 0.0
    if sigma < 0.5 and len(ctx.values) > 1:
        sigma = pstdev(ctx.values)
    sigma = max(sigma, 0.75)

    # Probabilities vs comparison line if provided, else vs projected (≈ 50/50)
    line_for_prob = comparison_line if comparison_line is not None else projected
    over_p, under_p = estimate_side_probabilities(projected, line_for_prob, sigma)

    # Hit rates vs comparison line when present (evidence), else vs projected
    ref_line = comparison_line if comparison_line is not None else projected
    l5 = hit_rate(ctx.values, ref_line, "Over", 5)
    l10 = hit_rate(ctx.values, ref_line, "Over", 10)
    l20 = hit_rate(ctx.values, ref_line, "Over", 20)
    season = hit_rate(ctx.values, ref_line, "Over", len(ctx.values))

    research = _research_from_factors(results, l10, l5, ctx.injury_status)
    conf = legacy_confidence(
        l10_rate=l10.rate,
        samples=l10.samples,
        ev_percent=(over_p - 0.5) * 20,  # map model lean into legacy helper scale
        injury_penalty=8
        if (ctx.injury_status or "None").lower() not in ("none", "healthy", "active", "probable")
        else 0,
    )
    # Confidence also rises with factor coverage
    coverage = sum(1 for r in results if r.available) / max(1, len(results))
    conf = int(min(98, max(40, conf * 0.85 + 20 * coverage)))

    dqs = data_quality_score(
        has_gamelog=len(ctx.values) >= 3,
        gamelog_count=len(ctx.values),
        has_injury_feed=True,
        has_live_odds=False,  # we are not odds-dependent
        freshness_minutes=5,
    )
    # Reward matchup/pace availability
    if any(r.key == "matchup" and r.available for r in results):
        dqs = min(98, dqs + 6)
    if any(r.key == "pace_usage" and r.available for r in results):
        dqs = min(98, dqs + 4)

    top = _rank_influential(results)
    explanation = _build_explanation(
        projected=projected,
        market=ctx.market,
        factors=results,
        over_p=over_p,
        under_p=under_p,
        comparison_line=comparison_line,
        research=research,
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
