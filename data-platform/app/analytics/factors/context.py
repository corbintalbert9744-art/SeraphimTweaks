"""Rest, injury, matchup, expected minutes, and usage factors (Projection Engine V1)."""

from __future__ import annotations

from datetime import datetime, timezone
from statistics import mean
from typing import Optional

from app.analytics.factors.base import FactorResult, PredictionContext


def _season_mean(ctx: PredictionContext) -> float:
    return mean(ctx.values) if ctx.values else 10.0


class RestFactor:
    """Rest days into tipoff (preferred) or schedule density from last two games."""

    key = "rest"
    label = "Rest days"

    def evaluate(self, ctx: PredictionContext) -> FactorResult:
        if not ctx.played_at:
            return FactorResult(
                key=self.key,
                label=self.label,
                adjustment=0.0,
                weight=0.0,
                impact="neutral",
                detail="Rest days unknown",
                available=False,
            )

        last = ctx.played_at[0]
        tip = ctx.tipoff_at or datetime.now(timezone.utc)
        # Normalize naive datetimes
        if getattr(last, "tzinfo", None) is None:
            last = last.replace(tzinfo=timezone.utc)
        if getattr(tip, "tzinfo", None) is None:
            tip = tip.replace(tzinfo=timezone.utc)

        days = max(0, (tip - last).days)
        # If tipoff looks before last game (bad clock), fall back to inter-game gap
        if tip < last and len(ctx.played_at) >= 2:
            delta = ctx.played_at[0] - ctx.played_at[1]
            days = max(0, delta.days)

        season = _season_mean(ctx)
        if days <= 0:
            adj = -0.08 * season
            impact = "negative"
            detail = f"Back-to-back / 0 days rest into tip → {adj:+.1f}"
        elif days == 1:
            adj = -0.03 * season
            impact = "mild"
            detail = f"1 day rest into tip → {adj:+.1f}"
        elif days >= 3:
            adj = 0.025 * season
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
            raw={"rest_days": days, "tipoff_at": tip.isoformat(), "last_played": last.isoformat()},
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
        season = _season_mean(ctx)
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
    """Opponent strength — warehouse rank/allowed when present, else H2H proxy."""

    key = "matchup"
    label = "Opponent strength"

    def evaluate(self, ctx: PredictionContext) -> FactorResult:
        season = _season_mean(ctx)
        adj = 0.0
        bits: list[str] = []
        proxy = False

        if ctx.opponent_def_rank is not None:
            mid = 15.5
            norm = (ctx.opponent_def_rank - mid) / mid
            adj += norm * 0.05 * season
            bits.append(f"def rank #{ctx.opponent_def_rank}")
        if ctx.opponent_stat_allowed is not None and ctx.league_avg_allowed:
            delta = ctx.opponent_stat_allowed - ctx.league_avg_allowed
            adj += 0.35 * delta
            bits.append(f"allows {ctx.opponent_stat_allowed:.1f} vs lg {ctx.league_avg_allowed:.1f}")

        # Historical vs this opponent (H2H proxy when team_stats empty)
        if ctx.vs_opponent_values and len(ctx.vs_opponent_values) >= 2:
            h2h = mean(ctx.vs_opponent_values)
            h2h_adj = 0.45 * (h2h - season)
            # Cap so thin H2H samples don't dominate
            cap = max(1.5, 0.2 * season)
            h2h_adj = max(-cap, min(cap, h2h_adj))
            adj += h2h_adj
            bits.append(
                f"H2H vs {ctx.opponent_abbr or 'OPP'} {h2h:.1f} "
                f"(n={len(ctx.vs_opponent_values)}) → {h2h_adj:+.1f}"
            )
            proxy = True

        if not bits:
            return FactorResult(
                key=self.key,
                label=self.label,
                adjustment=0.0,
                weight=0.0,
                impact="neutral",
                detail=(
                    f"vs {ctx.opponent_abbr or 'OPP'} — no opponent-strength sample yet "
                    "(skipped until H2H or team_stats available)"
                ),
                available=False,
                raw={"opponent": ctx.opponent_abbr, "proxy": False},
            )

        impact = "moderate" if abs(adj) >= 1.0 else ("mild" if abs(adj) >= 0.4 else "neutral")
        if adj < -0.4:
            impact = "negative" if adj < -1.0 else "mild"
        return FactorResult(
            key=self.key,
            label=self.label,
            adjustment=adj,
            weight=0.18,
            impact=impact,  # type: ignore[arg-type]
            detail=f"vs {ctx.opponent_abbr or 'OPP'}: {'; '.join(bits)}",
            raw={
                "opponent": ctx.opponent_abbr,
                "def_rank": ctx.opponent_def_rank,
                "allowed": ctx.opponent_stat_allowed,
                "h2h_n": len(ctx.vs_opponent_values),
                "proxy": proxy,
            },
        )


class ExpectedMinutesFactor:
    """Expected minutes / workload vs season average minutes."""

    key = "expected_minutes"
    label = "Expected minutes"

    def evaluate(self, ctx: PredictionContext) -> FactorResult:
        mins = [m for m in ctx.minutes if m is not None and m > 0]
        if len(mins) < 3 and ctx.expected_minutes is None:
            return FactorResult(
                key=self.key,
                label=self.label,
                adjustment=0.0,
                weight=0.0,
                impact="neutral",
                detail="Minutes history too thin",
                available=False,
            )
        season_m = mean(mins) if mins else None
        expected = ctx.expected_minutes
        if expected is None and mins:
            # L5 minutes as tonight's expected workload
            expected = mean(mins[: min(5, len(mins))])
        if expected is None or not season_m or season_m <= 0:
            return FactorResult(
                key=self.key,
                label=self.label,
                adjustment=0.0,
                weight=0.0,
                impact="neutral",
                detail="Expected minutes unavailable",
                available=False,
            )
        season = _season_mean(ctx)
        delta_ratio = (expected - season_m) / season_m
        adj = delta_ratio * 0.22 * season
        # Cap extreme minute swings (load management / blowouts)
        cap = max(2.0, 0.2 * season)
        adj = max(-cap, min(cap, adj))
        impact = "moderate" if abs(adj) >= 1.0 else ("mild" if abs(adj) >= 0.3 else "neutral")
        if adj < -0.3:
            impact = "negative" if adj < -1.0 else "mild"
        return FactorResult(
            key=self.key,
            label=self.label,
            adjustment=adj,
            weight=0.14,
            impact=impact,  # type: ignore[arg-type]
            detail=f"Expected {expected:.1f} min vs season {season_m:.1f} → {adj:+.1f}",
            raw={"expected_minutes": expected, "season_minutes": season_m, "delta_ratio": delta_ratio},
        )


class UsageFactor:
    """Usage / per-minute production — explicit index or derived from recent rate."""

    key = "usage"
    label = "Usage"

    def evaluate(self, ctx: PredictionContext) -> FactorResult:
        season = _season_mean(ctx)
        adj = 0.0
        bits: list[str] = []

        if ctx.usage_index is not None:
            adj += (ctx.usage_index - 1.0) * 0.22 * season
            bits.append(f"usage index {ctx.usage_index:.2f}")
        if ctx.pace_index is not None:
            adj += (ctx.pace_index - 1.0) * 0.1 * season
            bits.append(f"pace index {ctx.pace_index:.2f}")

        # Derive usage from per-minute rate when index missing
        if ctx.usage_index is None:
            pairs = [
                (v, m)
                for v, m in zip(ctx.values, ctx.minutes)
                if m is not None and m >= 8
            ]
            if len(pairs) >= 5:
                season_ppm = mean(v / m for v, m in pairs)
                recent_ppm = mean(v / m for v, m in pairs[:5])
                if season_ppm > 0:
                    ratio = recent_ppm / season_ppm
                    derived = (ratio - 1.0) * 0.18 * season
                    adj += derived
                    bits.append(f"per-min L5 {recent_ppm:.3f} vs {season_ppm:.3f} → {derived:+.1f}")

        if not bits:
            return FactorResult(
                key=self.key,
                label=self.label,
                adjustment=0.0,
                weight=0.0,
                impact="neutral",
                detail="Usage inputs limited",
                available=False,
            )
        impact = "moderate" if abs(adj) >= 1.0 else ("mild" if abs(adj) >= 0.3 else "neutral")
        if adj < -0.3:
            impact = "negative" if adj < -1.0 else "mild"
        return FactorResult(
            key=self.key,
            label=self.label,
            adjustment=adj,
            weight=0.12,
            impact=impact,  # type: ignore[arg-type]
            detail=f"{'; '.join(bits)}",
            raw={"usage_index": ctx.usage_index, "pace_index": ctx.pace_index},
        )


class PaceUsageFactor:
    """Backward-compatible alias combining minutes + usage (prefer dedicated factors)."""

    key = "pace_usage"
    label = "Pace & usage"

    def evaluate(self, ctx: PredictionContext) -> FactorResult:
        # Delegated — kept for custom stacks; default stack uses ExpectedMinutes + Usage
        minutes_f = ExpectedMinutesFactor().evaluate(ctx)
        usage_f = UsageFactor().evaluate(ctx)
        if not minutes_f.available and not usage_f.available:
            return FactorResult(
                key=self.key,
                label=self.label,
                adjustment=0.0,
                weight=0.0,
                impact="neutral",
                detail="Pace/usage inputs limited",
                available=False,
            )
        adj = (minutes_f.adjustment if minutes_f.available else 0.0) + (
            usage_f.adjustment if usage_f.available else 0.0
        )
        bits = []
        if minutes_f.available:
            bits.append(minutes_f.detail)
        if usage_f.available:
            bits.append(usage_f.detail)
        return FactorResult(
            key=self.key,
            label=self.label,
            adjustment=adj,
            weight=0.12,
            impact="moderate" if abs(adj) >= 1.0 else ("mild" if abs(adj) >= 0.3 else "neutral"),
            detail=" · ".join(bits),
            raw={"minutes": minutes_f.raw, "usage": usage_f.raw},
            available=True,
        )


class StreakMomentumFactor:
    """Short consecutive clears/misses vs season mean — mild mean-reversion."""

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
        if abs(signed) >= 4:
            adj = -0.15 * (1 if signed > 0 else -1) * (mean(ctx.values) * 0.05)
            detail = (
                f"{abs(signed)}-game {'over' if signed > 0 else 'under'} "
                f"season-mean streak → slight mean reversion {adj:+.1f}"
            )
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
