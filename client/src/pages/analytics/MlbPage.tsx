import { LeagueComingSoon } from "@/components/shared/LeagueComingSoon";

export default function MlbPage() {
  return (
    <LeagueComingSoon
      league="MLB"
      title="MLB Research Board"
      reason="MLB is not connected to a live provider yet. Mock slates have been removed."
    />
  );
}
