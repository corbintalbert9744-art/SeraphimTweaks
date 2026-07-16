# Seraphim Projection Engine V1

We are **not** a line-copying platform. The model generates its own projections
from modular factors; sportsbook lines are optional comparison inputs only.

## Outputs (every player prop)

| Field | Meaning |
|-------|---------|
| `projectedValue` / `projection` | Model-estimated stat |
| `confidenceScore` / `confidence` | Conviction given samples + factor coverage (0–100) |
| `researchScore` | Evidence quality / factor agreement (0–100) |
| `explanation` | Human-readable bullets of why |
| `overProbability` / `underProbability` | Model P(side) vs comparison line |
| `influentialFactors` / `factorBreakdown` | Ranked / full factor list |

## Factor stack (V1)

| # | Factor | Signal |
|---|--------|--------|
| 1 | Historical performance | Weighted season / L20 / L10 baseline |
| 2 | Recent form | L5 / L10 vs historical mean |
| 3 | Home / away | Venue split vs season |
| 4 | Rest days | Days from last game → tipoff |
| 5 | Injury / availability | Status haircut |
| 6 | Opponent strength | Def rank / allowed **or** H2H vs opponent |
| 7 | Expected minutes | Projected workload vs season minutes |
| 8 | Usage | Usage/pace index **or** per-minute rate |
| 9 | Streak momentum | Mild mean-reversion on long streaks |

```
projected = historical_baseline + Σ available factor adjustments
```

Roadmap: keep this rule-based core → add ML once the warehouse has enough labeled history.

## API

- `GET /api/v1/predict/model` — model metadata + factor list  
- `POST /api/v1/predict/prop` — run V1 on supplied history  
- NBA/NFL board props persist `projectedValue`, confidence, research score, and explanation  

All probabilities are **model estimates**, not guaranteed chances of winning.
