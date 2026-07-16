# Provider status

| Provider | Leagues | Live? | Config needed |
|----------|---------|-------|---------------|
| espn-nba | NBA | Yes | None |
| espn-nfl | NFL | Yes | None |
| the-odds-api | NBA, NFL, WNBA, ATP*, WTA* | When keyed | `ODDS_API_KEY` |
| mock-odds | all | Dev fallback | None — labeled `oddsAreMock` |
| espn-wnba | WNBA | Not yet | Build adapter (next) |
| tennis | ATP, WTA | Not yet | **REQUIRES PROVIDER SELECTION** (licensed schedule + odds) |

\* ATP/WTA sport keys in The Odds API must be verified per tournament before production use.

See `GET /api/v1/providers` for the machine-readable version.
