"""Provider adapter contracts (re-exported from framework for stable imports).

Adapters normalize external feeds into shared DTOs. The application never
calls a vendor SDK directly from API routes — only through these interfaces.
"""

from __future__ import annotations

from app.providers.framework import (
    FeaturedAthleteProvider,
    GamelogProvider,
    InjuryProvider,
    NormalizedGame,
    NormalizedGamelog,
    NormalizedInjury,
    NormalizedOddsQuote,
    NormalizedPlayer,
    NormalizedTeam,
    OddsProvider,
    ProviderCapability,
    ProviderHttpClient,
    ProviderHttpError,
    ProviderJobResult,
    ProviderMeta,
    RosterProvider,
    ScheduleProvider,
    SlateAthleteProvider,
    capability_matrix,
    list_recent_provider_runs,
    run_provider_job,
)

__all__ = [
    "FeaturedAthleteProvider",
    "GamelogProvider",
    "InjuryProvider",
    "NormalizedGame",
    "NormalizedGamelog",
    "NormalizedInjury",
    "NormalizedOddsQuote",
    "NormalizedPlayer",
    "NormalizedTeam",
    "OddsProvider",
    "ProviderCapability",
    "ProviderHttpClient",
    "ProviderHttpError",
    "ProviderJobResult",
    "ProviderMeta",
    "RosterProvider",
    "ScheduleProvider",
    "SlateAthleteProvider",
    "capability_matrix",
    "list_recent_provider_runs",
    "run_provider_job",
]
