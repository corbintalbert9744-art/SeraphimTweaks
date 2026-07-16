import { SportResearchBoard } from "@/components/shared/SportResearchBoard";

export default function WnbaPage() {
  return (
    <SportResearchBoard
      league="WNBA"
      title="WNBA Research Board"
      description="Live ESPN slate + Seraphim projections. Green OVER · red UNDER. Line Comparison includes PrizePicks and sportsbooks on every prop report."
      propsPath="/api/wnba/props"
      queryKey="wnba-board"
      emptyHint="No slate games with enough gamelog history right now — check back when ESPN has tonight’s card."
    />
  );
}
