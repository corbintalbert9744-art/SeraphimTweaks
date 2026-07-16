"""Seraphim IQ data platform configuration."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(ROOT / ".env"), str(ROOT / "data-platform" / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    database_url: str | None = Field(default=None, alias="DATABASE_URL")
    sqlite_path: str = str(ROOT / "data-platform" / "seraphim_warehouse.db")

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:5000,http://127.0.0.1:5000"

    enable_scheduler: bool = Field(default=True, alias="ENABLE_SCHEDULER")
    schedule_odds_minutes: int = 15
    schedule_injuries_minutes: int = 30
    schedule_analytics_minutes: int = 20
    schedule_nba_sync_minutes: int = Field(default=60, alias="NBA_SYNC_MINUTES")
    bootstrap_nba_sync: bool = Field(default=True, alias="BOOTSTRAP_NBA_SYNC")
    nba_sync_max_games: int = Field(default=8, alias="NBA_SYNC_MAX_GAMES")
    nba_sync_per_team: int = Field(default=3, alias="NBA_SYNC_PER_TEAM")

    odds_api_key: str | None = Field(default=None, alias="ODDS_API_KEY")
    espn_user_agent: str = "SeraphimAnalytics/1.0 (+data-platform)"

    model_disclaimer: str = (
        "Scores and probabilities are Seraphim model estimates built from evidence "
        "(hit rates, no-vig, matchup, injuries, line movement). They are not guaranteed "
        "or objective chances of winning."
    )

    def sqlalchemy_url(self) -> str:
        if self.database_url:
            return self.database_url.replace("postgres://", "postgresql://", 1)
        return f"sqlite:///{self.sqlite_path}"

    def is_sqlite(self) -> bool:
        return self.sqlalchemy_url().startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()
