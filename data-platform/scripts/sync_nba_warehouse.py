#!/usr/bin/env python3
"""One-shot NBA warehouse sync via ESPN adapter.

Usage:
  cd data-platform && PYTHONPATH=. python3 scripts/sync_nba_warehouse.py
  DATABASE_URL=postgresql://... PYTHONPATH=. python3 scripts/sync_nba_warehouse.py
"""

from __future__ import annotations

import json
import sys

from app.db.session import init_db, session_scope
from app.ingestion.nba_sync import sync_nba_warehouse


def main() -> int:
    init_db()
    with session_scope() as db:
        result = sync_nba_warehouse(db)
    print(json.dumps(result, indent=2, default=str))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
