"""Alembic revision: full Seraphim Postgres schema.

Uses the SQL file as source of truth so Drizzle + Alembic stay aligned.
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0001_seraphim_full"
down_revision = None
branch_labels = None
depends_on = None

SQL_PATH = Path(__file__).resolve().parents[3] / "migrations" / "0001_seraphim_full_schema.sql"


def upgrade() -> None:
    sql = SQL_PATH.read_text(encoding="utf-8")
    # Split on statements carefully — execute whole script via connection
    conn = op.get_bind()
    conn.exec_driver_sql(sql)


def downgrade() -> None:
    # Destructive full teardown — use only on empty/dev databases.
    tables = [
        "provider_runs",
        "alerts",
        "saved_parlay_legs",
        "saved_parlays",
        "line_snapshots",
        "prop_analytics",
        "odds",
        "props",
        "sportsbooks",
        "team_stats",
        "injuries",
        "player_game_logs",
        "games",
        "players",
        "teams",
        "sports",
        "subscriptions",
        "users",
    ]
    for table in tables:
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
