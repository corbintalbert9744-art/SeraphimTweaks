#!/usr/bin/env python3
"""One-shot multi-sport warehouse sync."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.db.session import init_db, session_scope  # noqa: E402
from app.ingestion.multi_sport_sync import sync_all_sports  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync all available sports into the warehouse")
    parser.add_argument("--date", default=None, help="YYYY-MM-DD or YYYYMMDD")
    args = parser.parse_args()
    init_db()
    with session_scope() as db:
        result = sync_all_sports(db, date=args.date)
    print(json.dumps(result, indent=2, default=str))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
