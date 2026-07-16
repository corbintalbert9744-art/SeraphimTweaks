from app.analytics.factors.base import FactorResult, PredictionContext
from app.analytics.factors.context import (
    ExpectedMinutesFactor,
    InjuryFactor,
    MatchupFactor,
    PaceUsageFactor,
    RestFactor,
    StreakMomentumFactor,
    UsageFactor,
)
from app.analytics.factors.form import HomeAwayFactor, RecentFormFactor, SeasonBaselineFactor

__all__ = [
    "FactorResult",
    "PredictionContext",
    "SeasonBaselineFactor",
    "RecentFormFactor",
    "HomeAwayFactor",
    "RestFactor",
    "InjuryFactor",
    "MatchupFactor",
    "ExpectedMinutesFactor",
    "UsageFactor",
    "PaceUsageFactor",
    "StreakMomentumFactor",
    "default_factor_stack",
]


def default_factor_stack():
    """Projection Engine V1 — ordered modular stack (no ML)."""
    return [
        SeasonBaselineFactor(),  # historical performance
        RecentFormFactor(),
        HomeAwayFactor(),
        RestFactor(),
        InjuryFactor(),
        MatchupFactor(),  # opponent strength (+ H2H proxy)
        ExpectedMinutesFactor(),
        UsageFactor(),
        StreakMomentumFactor(),
    ]
