import { LeagueComingSoon } from "@/components/shared/LeagueComingSoon";

export default function TennisPage({ tour = "ATP" }: { tour?: "ATP" | "WTA" }) {
  return (
    <LeagueComingSoon
      league={tour}
      title={`${tour} Research Board`}
      reason="REQUIRES PROVIDER SELECTION — Tennis Abstract has no public API. Seraphim will not scrape or invent match data. Wire a licensed tennis + odds source, then ATP/WTA boards go live."
    />
  );
}
