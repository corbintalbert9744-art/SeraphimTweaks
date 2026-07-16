"""Deprecated alias — use app.ingestion.line_aggregation_sync."""

from app.ingestion.line_aggregation_sync import sync_aggregated_lines, sync_propline_lines

__all__ = ["sync_aggregated_lines", "sync_propline_lines"]
