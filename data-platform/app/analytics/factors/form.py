"""Historical performance, recent form, and home/away factors (Projection Engine V1)."""

from __future__ import annotations

from statistics import mean, pstdev

from app.analytics.factors.base import FactorResult, PredictionContext


class SeasonBaselineFactor:
    """Historical performance anchor — weighted season / L20 / L10 mean.

    This is the projection baseline (adjustment 0). Other factors add/subtract
    from this value. Key kept as ``season_baseline`` for API compatibility.
    """

    key = "season_baseline"
    label = "Historical performance"

    def evaluate(self, ctx: PredictionContext) -> FactorResult:
        vals = ctx.values
        if len(vals) < 3:
            return FactorResult(
                key=self.key,
                label=self.label,
                adjustment=0.0,
                weight=0.0,
                impact="neutral",
                detail="Insufficient historical sample (<3 games)",
                available=False,
            )
        season = mean(vals)
        l20 = mean(vals[: min(20, len(vals))])
        l10 = mean(vals[: min(10, len(vals))])
        # Prefer recent-weighted history so mid-season form shifts the floor
        if len(vals) >= 15:
            baseline = 0.40 * l20 + 0.35 * season + 0.25 * l10
        elif len(vals) >= 8:
            baseline = 0.50 * l10 + 0.50 * season
        else:
            baseline = season
        return FactorResult(
            key=self.key,
            label=self.label,
            adjustment=0.0,
            weight=0.35,
            impact="neutral",
            detail=(
                f"Historical baseline {baseline:.1f} "
                f"(season {season:.1f} · L20 {l20:.1f} · L10 {l10:.1f} · n={len(vals)})"
            ),
            raw={
                "baseline": baseline,
                "season": season,
                "l20": l20,
                "l10": l10,
                "samples": len(vals),
                "stdev": pstdev(vals) if len(vals) > 1 else 0.0,
            },
            available=True,
        )


class RecentFormFactor:
    """Blend L5 / L10 vs historical mean — hot/cold recent form."""

    key = "recent_form"
    label = "Recent form"

    def evaluate(self, ctx: PredictionContext) -> FactorResult:
        vals = ctx.values
        if len(vals) < 5:
            return FactorResult(
                key=self.key,
                label=self.label,
                adjustment=0.0,
                weight=0.0,
                impact="neutral",
                detail="Need ≥5 games for form signal",
                available=False,
            )
        season = mean(vals)
        l5 = mean(vals[:5])
        l10 = mean(vals[: min(10, len(vals))])
        blended = 0.55 * l5 + 0.30 * l10 + 0.15 * season
        adj = blended - season
        cap = max(2.0, 0.25 * season) if season else 5.0
        adj = max(-cap, min(cap, adj))
        if adj > 1.0:
            impact = "strong"
        elif adj > 0.3:
            impact = "moderate"
        elif adj < -1.0:
            impact = "negative"
        elif adj < -0.3:
            impact = "mild"
        else:
            impact = "neutral"
        return FactorResult(
            key=self.key,
            label=self.label,
            adjustment=adj,
            weight=0.28,
            impact=impact,  # type: ignore[arg-type]
            detail=f"L5 {l5:.1f} · L10 {l10:.1f} vs historical {season:.1f} → {adj:+.1f}",
            raw={"l5": l5, "l10": l10, "season": season, "blended": blended},
        )


class HomeAwayFactor:
    key = "home_away"
    label = "Home / away"

    def evaluate(self, ctx: PredictionContext) -> FactorResult:
        if ctx.is_home is None or len(ctx.values) < 4:
            return FactorResult(
                key=self.key,
                label=self.label,
                adjustment=0.0,
                weight=0.0,
                impact="neutral",
                detail="Home/away context unavailable",
                available=False,
            )
        home_vals = [v for v, h in zip(ctx.values, ctx.homes) if h]
        away_vals = [v for v, h in zip(ctx.values, ctx.homes) if not h]
        if len(home_vals) < 2 or len(away_vals) < 2:
            return FactorResult(
                key=self.key,
                label=self.label,
                adjustment=0.0,
                weight=0.05,
                impact="neutral",
                detail="Split sample too thin",
                available=True,
                raw={"home_n": len(home_vals), "away_n": len(away_vals)},
            )
        home_m = mean(home_vals)
        away_m = mean(away_vals)
        season = mean(ctx.values)
        side_m = home_m if ctx.is_home else away_m
        adj = 0.55 * (side_m - season)  # partial credit toward venue split
        return FactorResult(
            key=self.key,
            label=self.label,
            adjustment=adj,
            weight=0.12,
            impact="moderate" if abs(adj) >= 0.8 else ("mild" if abs(adj) >= 0.3 else "neutral"),
            detail=(
                f"{'Home' if ctx.is_home else 'Away'} mean {side_m:.1f} "
                f"(H {home_m:.1f} / A {away_m:.1f}) → {adj:+.1f}"
            ),
            raw={"home_mean": home_m, "away_mean": away_m, "is_home": ctx.is_home},
        )
