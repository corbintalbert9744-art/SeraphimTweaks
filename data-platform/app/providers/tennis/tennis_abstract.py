"""Tennis Abstract adapter placeholder.

Tennis Abstract (tennisabstract.com) is a research site without a public
documented API. Scraping HTML is brittle and may violate site terms — we do
**not** fabricate match data and we do **not** scrape by default.

REQUIRES PROVIDER SELECTION: plug in a licensed tennis feed (or an approved
export) before ATP/WTA boards go live. The Odds API tennis keys are tournament-
specific placeholders only.
"""

from __future__ import annotations

from typing import Optional

from app.providers.base import NormalizedGame, ProviderMeta


class TennisAbstractProvider:
    """Explicit non-live adapter — returns empty until a real source is wired."""

    meta = ProviderMeta(
        name="tennis-abstract",
        leagues=["ATP", "WTA"],
        capabilities=["schedule", "gamelog"],
        requires_api_key=True,  # treat as "requires configuration"
        is_mock=False,
        notes=(
            "REQUIRES CONFIGURATION / PROVIDER SELECTION. Tennis Abstract has no "
            "public API; Seraphim will not scrape or invent ATP/WTA data. "
            "Wire a licensed tennis + odds source, then implement this adapter."
        ),
        homepage="https://www.tennisabstract.com/",
    )

    def __init__(self, *, enabled: bool = False) -> None:
        self.enabled = enabled

    def configured(self) -> bool:
        return False  # never auto-enabled

    def fetch_schedule(self, league: str = "ATP", date: Optional[str] = None) -> list[NormalizedGame]:
        _ = (league, date, self.enabled)
        return []
