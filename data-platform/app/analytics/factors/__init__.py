from app.analytics.factors.base import FactorResult, PredictionContext
from app.analytics.factors.context import (
    InjuryFactor,
    MatchupFactor,
    PaceUsageFactor,
    RestFactor,
    StreakMomentumFactor,
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
    "PaceUsageFactor",
    "StreakMomentumFactor",
    "default_factor_stack",
]


def default_factor_stack():
    """Ordered modular stack — rule-based v1 (no ML)."""
    return [
        SeasonBaselineFactor(),
        RecentFormFactor(),
        HomeAwayFactor(),
        RestFactor(),
        InjuryFactor(),
        MatchupFactor(),
        PaceUsageFactor(),
        StreakMomentumFactor(),
    ]
