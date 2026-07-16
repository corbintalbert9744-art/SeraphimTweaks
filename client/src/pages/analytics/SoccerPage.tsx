import { SportResearchBoard } from "@/components/shared/SportResearchBoard";

export default function SoccerPage() {
  return (
    <SportResearchBoard
      league="Soccer"
      title="Soccer Research Board"
      description="ESPN soccer schedules (no key) plus optional Football-Data.org when FOOTBALL_DATA_API_KEY is set. Same research layout as WNBA — props appear once gamelogs land."
      propsPath="/api/soccer/props"
      queryKey="soccer-board"
      emptyHint="Schedule syncs from ESPN. Player prop logs need event stats — FOOTBALL_DATA_API_KEY enables Football-Data.org fixtures. We do not fabricate soccer props."
    />
  );
}
