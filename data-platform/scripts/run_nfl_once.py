#!/usr/bin/env python3
"""One-shot NFL import + featured prop."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.db.session import init_db, session_scope  # noqa: E402
from app.ingestion.nfl_pipeline import build_and_store_featured_nfl_prop, import_nfl_schedule  # noqa: E402


def main() -> None:
    init_db()
    with session_scope() as db:
        schedule = import_nfl_schedule(db)
        featured = build_and_store_featured_nfl_prop(db)
    print(
        json.dumps(
            {
                "schedule": schedule,
                "featured_ok": featured.get("ok"),
                "player": (featured.get("prop") or {}).get("player"),
                "market": (featured.get("prop") or {}).get("market"),
                "line": (featured.get("prop") or {}).get("line"),
                "oddsAreMock": (featured.get("prop") or {}).get("oddsAreMock"),
            },
            indent=2,
        )
    )
    if not featured.get("ok"):
        print(json.dumps(featured, indent=2))
        sys.exit(1)


if __name__ == "__main__":
    main()
