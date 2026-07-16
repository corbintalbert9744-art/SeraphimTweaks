# Seraphim prediction engine (rule-based v1)

We are **not** a line-copying platform. The model generates its own projections
from modular factors; sportsbook lines are optional comparison inputs only.

## Outputs (per prop)

| Field | Meaning |
|-------|---------|
| `projectedValue` | Model-estimated stat |
| `overProbability` / `underProbability` | Model P(side) vs comparison line |
| `researchScore` | 0–100 evidence quality / agreement |
| `confidenceScore` | Conviction given samples + coverage |
| `explanation` | AI-style bullets of influential factors |
| `influentialFactors` | Ranked factor list |

## Factor stack (debuggable, no ML yet)

1. Season baseline  
2. Recent form (L5/L10)  
3. Home / away  
4. Rest days  
5. Injury / availability  
6. Opponent matchup *(skipped until `team_stats` filled)*  
7. Pace & usage  
8. Streak momentum  

Roadmap: keep this rule-based core → add ML once the warehouse has enough labeled history.

## API

- `GET /api/v1/predict/model` — model metadata  
- `POST /api/v1/predict/prop` — run prediction on supplied history  
- Featured NBA/NFL props include a top-level `prediction` object  

All probabilities are **model estimates**, not guaranteed chances of winning.
