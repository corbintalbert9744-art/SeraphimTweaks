"""Build the multi-provider line aggregator from settings."""

from __future__ import annotations

from functools import lru_cache
from typing import Optional

from app.config import get_settings
from app.providers.antelytics.adapter import AntelyticsAdapter
from app.providers.line_aggregation.aggregator import DEFAULT_PRIORITY, MultiProviderAggregator
from app.providers.line_aggregation.pickem_aggregator import (
    DEFAULT_PICKEM_PRIORITY,
    PickemLineAggregator,
)
from app.providers.propline.adapter import PropLineAdapter
from app.providers.sharpapi.adapter import SharpApiAdapter
from app.providers.the_odds_api.odds import TheOddsApiProvider


def build_line_aggregator(
    *,
    priority: Optional[list[str]] = None,
) -> MultiProviderAggregator:
    settings = get_settings()
    order = priority or [
        p.strip()
        for p in (settings.line_provider_priority or ",".join(DEFAULT_PRIORITY)).split(",")
        if p.strip()
    ]

    registry = {
        "propline": PropLineAdapter(api_key=settings.propline_api_key or ""),
        "sharpapi": SharpApiAdapter(api_key=settings.sharpapi_api_key or ""),
        "the-odds-api": TheOddsApiProvider(api_key=settings.odds_api_key or ""),
        "antelytics": AntelyticsAdapter(
            api_key=settings.antelytics_api_key or "",
            base_url=settings.antelytics_base_url or "https://backend.antehq.com/v1",
        ),
    }

    providers = []
    for key in order:
        adapter = registry.get(key)
        if adapter is not None:
            providers.append(adapter)
    # Append any configured adapters missing from priority list
    for key, adapter in registry.items():
        if key not in order:
            providers.append(adapter)

    return MultiProviderAggregator(providers)


@lru_cache
def get_line_aggregator() -> MultiProviderAggregator:
    return build_line_aggregator()


def reset_line_aggregator_cache() -> None:
    get_line_aggregator.cache_clear()
    get_pickem_aggregator.cache_clear()


def build_pickem_aggregator(
    *,
    priority: Optional[list[str]] = None,
) -> PickemLineAggregator:
    """Short-circuit PropLine → SharpAPI → Odds API → Antelytics for DFS pick'em boards."""
    settings = get_settings()
    order = priority or list(DEFAULT_PICKEM_PRIORITY)

    registry = {
        "propline": PropLineAdapter(api_key=settings.propline_api_key or "", max_events=24),
        "sharpapi": SharpApiAdapter(api_key=settings.sharpapi_api_key or ""),
        "the-odds-api": TheOddsApiProvider(api_key=settings.odds_api_key or ""),
        "antelytics": AntelyticsAdapter(
            api_key=settings.antelytics_api_key or "",
            base_url=settings.antelytics_base_url or "https://backend.antehq.com/v1",
        ),
    }

    providers = []
    for key in order:
        adapter = registry.get(key)
        if adapter is not None:
            providers.append(adapter)
    return PickemLineAggregator(providers)


@lru_cache
def get_pickem_aggregator() -> PickemLineAggregator:
    return build_pickem_aggregator()
