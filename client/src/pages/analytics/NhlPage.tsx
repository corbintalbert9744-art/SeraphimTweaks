import { SportResearchBoard } from "@/components/shared/SportResearchBoard";

export default function NhlPage() {
  return (
    <SportResearchBoard
      league="NHL"
      title="NHL Research Board"
      description="Live NHL API → warehouse gamelogs → Seraphim projections. Same analytics layout as WNBA — open any prop for Line Comparison."
      propsPath="/api/nhl/props"
      queryKey="nhl-board"
      emptyHint="Sync NHL via the data platform (POST /api/v1/nhl/jobs/sync) when the board is empty."
    />
  );
}
