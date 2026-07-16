import { LeagueComingSoon } from "@/components/shared/LeagueComingSoon";

export default function NhlPage() {
  return (
    <LeagueComingSoon
      league="NHL"
      title="NHL Research Board"
      reason="NHL requires a live schedule + stats provider. Line Comparison adapters (DraftKings, FanDuel, etc.) are ready once props sync."
    />
  );
}
