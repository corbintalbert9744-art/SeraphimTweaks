import { SportResearchBoard } from "@/components/shared/SportResearchBoard";

export default function MlbPage() {
  return (
    <SportResearchBoard
      league="MLB"
      title="MLB Research Board"
      description="Live MLB Stats API → warehouse gamelogs → Seraphim projections. Same analytics layout as WNBA — open any prop for Line Comparison."
      propsPath="/api/mlb/props"
      queryKey="mlb-board"
      emptyHint="Sync MLB via the data platform (POST /api/v1/mlb/jobs/sync) when the board is empty."
    />
  );
}
