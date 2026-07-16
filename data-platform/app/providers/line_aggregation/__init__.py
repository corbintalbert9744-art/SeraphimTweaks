"""Line aggregation package."""

from app.providers.line_aggregation.aggregator import (
    AggregationResult,
    MultiProviderAggregator,
    ProviderAttempt,
    merge_quotes,
)
from app.providers.line_aggregation.factory import build_line_aggregator, get_line_aggregator

__all__ = [
    "AggregationResult",
    "MultiProviderAggregator",
    "ProviderAttempt",
    "build_line_aggregator",
    "get_line_aggregator",
    "merge_quotes",
]
