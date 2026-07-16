import { LeagueComingSoon } from "@/components/shared/LeagueComingSoon";

export default function TennisPage({ tour }: { tour: "ATP" | "WTA" }) {
  return (
    <LeagueComingSoon
      league={tour}
      title={`${tour} Research Board`}
      reason={`${tour} requires a licensed tennis + odds provider before live data can ship.`}
    />
  );
}
