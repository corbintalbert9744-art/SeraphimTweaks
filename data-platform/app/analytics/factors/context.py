"""Rest, injury, matchup, pace/usage factors."""

from __future__ import annotations

from statistics import mean
from typing import Optional

from app.analytics.factors.base import FactorResult, PredictionContext


class RestFactor:
    key = "rest"
    label = "Rest days"

    def evaluate(self, ctx: PredictionContext) -> FactorResult:
        if len(ctx.played_at) < 2:
            return FactorResult(
                key=self.key,
                label=self.label,
                adjustment=0.0,
                weight=0.0,
                impact="neutral",
                detail="Rest days unknown",
                available=False,
            )
        delta = ctx.played_at[0] - ctx.played_at[1]
        days = max(0, delta.days)
        # Coming into *tonight* — approximate rest from last game to now if only history given:
        # Pipelines pass played_at as history; rest_days between last two games is a proxy for
        # schedule density. Mild penalties for back-to-backs (0 days).
        if days <= 0:
            adj = -0.08 * (mean(ctx.values) if ctx.values else 10.0)  # ~8% haircut
            impact = "negative"
            detail = f"Back-to-back / 0 days rest → {adj:+.1f}"
        elif days == 1:
            adj = -0.03 * (mean(ctx.values) if ctx.values else 10.0)
            impact = "mild"
            detail = f"1 day rest → {adj:+.1f}"
        elif days >= 3:
            adj = 0.02 * (mean(ctx.values) if ctx.values else 10.0)
            impact = "mild"
            detail = f"{days} days rest (extra recovery) → {adj:+.1f}"
        else:
            adj = 0.0
            impact = "neutral"
            detail = f"{days} days rest — neutral"
        return FactorResult(
            key=self.key,
            label=self.label,
            adjustment=adj,
            weight=0.1,
            impact=impact,  # type: ignore[arg-type]
            detail=detail,
            raw={"rest_days": days},
        )


class InjuryFactor:
    key = "injury"
    label = "Injury / availability"

    _HEALTHY = {"none", "healthy", "active", "probable", ""}

    def evaluate(self, ctx: PredictionContext) -> FactorResult:
        status = (ctx.injury_status or "None").strip()
        low = status.lower()
        if low in self._HEALTHY:
            return FactorResult(
                key=self.key,
                label=self.label,
                adjustment=0.0,
                weight=0.08,
                impact="neutral",
                detail="No active injury flag",
                raw={"status": status},
            )
        # Questionable / day-to-day / out — haircut projection
        season = mean(ctx.values) if ctx.values else 10.0
        if "out" in low:
            adj = -0.5 * season
            impact = "negative"
        elif "doubt" in low:
            adj = -0.25 * season
            impact = "negative"
        else:
            adj = -0.1 * season
            impact = "mild"
        return FactorResult(
            key=self.key,
            label=self.label,
            adjustment=adj,
            weight=0.15,
            impact=impact,  # type: ignore[arg-type]
            detail=f"Injury status '{status}' → {adj:+.1f} (availability risk)",
            raw={"status": status},
        )


class MatchupFactor:
    """Opponent defensive context.

    When opponent_def_rank / allowed stats are missing, returns available=False
    so the engine does not invent matchup edge. Warehouse team_stats fills this later.
    """

    key = "matchup"
    label = "Opponent matchup"

    def evaluate(self, ctx: PredictionContext) -> FactorResult:
        if ctx.opponent_def_rank is None and ctx.opponent_stat_allowed is None:
            return FactorResult(
                key=self.key,
                label=self.label,
                adjustment=0.0,
                weight=0.0,
                impact="neutral",
                detail=(
                    f"vs {ctx.opponent_abbr or 'OPP'} — matchup stats not in warehouse yet "
                    "(factor skipped; not a sportsbook copy)"
                ),
                available=False,
                raw={"opponent": ctx.opponent_abbr, "proxy": False},
            )

        season = mean(ctx.values) if ctx.values else 10.0
        adj = 0.0
        bits = []
        if ctx.opponent_def_rank is not None:
            # Rank 1 toughest → negative; rank 30 soft → positive
            # Map rank to [-1, +1] then scale ~5% of season mean
            mid = 15.5
            norm = (ctx.opponent_def_rank - mid) / mid  # soft defenses positive
            adj += norm * 0.05 * season
            bits.append(f"def rank #{ctx.opponent_def_rank}")
        if ctx.opponent_stat_allowed is not None and ctx.league_avg_allowed:
            delta = ctx.opponent_stat_allowed - ctx.league_avg_allowed
            adj += 0.35 * delta
            bits.append(f"allows {ctx.opponent_stat_allowed:.1f} vs lg {ctx.league_avg_allowed:.1f}")
        impact = "moderate" if abs(adj) >= 1.0 else ("mild" if abs(adj) >= 0.4 else "neutral")
        if adj < -0.4:
            impact = "negative" if adj < -1.0 else "mild"
        return FactorResult(
            key=self.key,
            label=self.label,
            adjustment=adj,
            weight=0.18,
            impact=impact,  # type: ignore[arg-type]
            detail=f"vs {ctx.opponent_abbr or 'OPP'}: {', '.join(bits)} → {adj:+.1f}",
            raw={
                "opponent": ctx.opponent_abbr,
                "def_rank": ctx.opponent_def_rank,
                "allowed": ctx.opponent_stat_allowed,
            },
        )


class PaceUsageFactor:
    """Minutes / pace / usage proxies from recent workload."""

    key = "pace_usage"
    label = "Pace & usage"

    def evaluate(self, ctx: PredictionContext) -> FactorResult:
        season = mean(ctx.values) if ctx.values else 0.0
        adj = 0.0
        bits: list[str] = []
        mins = [m for m in ctx.minutes if m is not None]
        if len(mins) >= 5:
            recent = mean(mins[:5])
            season_m = mean(mins)
            if season_m > 0:
                delta_ratio = (recent - season_m) / season_m
                adj += delta_ratio * 0.15 * season
                bits.append(f"minutes L5 {recent:.1f} vs {season_m:.1f}")
        if ctx.pace_index is not None:
            adj += (ctx.pace_index - 1.0) * 0.1 * season
            bits.append(f"pace index {ctx.pace_index:.2f}")
        if ctx.usage_index is not None:
            adj += (ctx.usage_index - 1.0) * 0.2 * season
            bits.append(f"usage index {ctx.usage_index:.2f}")
        if not bits:
            return FactorResult(
                key=self.key,
                label=self.label,
                adjustment=0.0,
                weight=0.0,
                impact="neutral",
                detail="Pace/usage inputs limited — factor light",
                available=False,
            )
        impact = "moderate" if abs(adj) >= 1.0 else ("mild" if abs(adj) >= 0.3 else "neutral")
        return FactorResult(
            key=self.key,
            label=self.label,
            adjustment=adj,
            weight=0.12,
            impact=impact,  # type: ignore[arg-type]
            detail=f"{'; '.join(bits)} → {adj:+.1f}",
            raw={"pace_index": ctx.pace_index, "usage_index": ctx.usage_index},
        )


class StreakMomentumFactor:
    """Short consecutive clears/misses vs a soft internal reference (season mean)."""

    key = "streak"
    label = "Streak momentum"

    def evaluate(self, ctx: PredictionContext) -> FactorResult:
        if len(ctx.values) < 4:
            return FactorResult(
                key=self.key,
                label=self.label,
                adjustment=0.0,
                weight=0.0,
                impact="neutral",
                detail="Streak sample thin",
                available=False,
            )
        ref = mean(ctx.values)
        streak = 0
        first = ctx.values[0] >= ref
        for v in ctx.values:
            hit = v >= ref
            if hit == first:
                streak += 1
            else:
                break
        signed = streak if first else -streak
        # Tiny regression-to-mean nudge against long streaks (don't chase forever)
        if abs(signed) >= 4:
            adj = -0.15 * (1 if signed > 0 else -1) * (mean(ctx.values) * 0.05)
            detail = f"{abs(signed)}-game {'over' if signed > 0 else 'under'} season-mean streak → slight mean reversion {adj:+.1f}"
            impact = "mild"
        else:
            adj = 0.0
            detail = f"Streak {signed:+d} vs season mean — no adjustment"
            impact = "neutral"
        return FactorResult(
            key=self.key,
            label=self.label,
            adjustment=adj,
            weight=0.06,
            impact=impact,  # type: ignore[arg-type]
            detail=detail,
            raw={"streak": signed, "ref": ref},
        )
