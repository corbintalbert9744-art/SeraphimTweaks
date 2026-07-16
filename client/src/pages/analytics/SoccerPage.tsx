import { SportResearchBoard } from "@/components/shared/SportResearchBoard";

export default function SoccerPage() {
  return (
    <SportResearchBoard
      league="Soccer"
      title="Soccer Research Board"
      description="ESPN soccer slate with PrizePicks-style markets (Goals, Shots, SOT, G+A, Passes). Green OVER · red UNDER. Same research layout as WNBA."
      propsPath="/api/soccer/props"
      queryKey="soccer-board"
      emptyHint="Soccer board builds from ESPN fixtures + team rosters. Refresh when matchday squads are posted."
    />
  );
}
