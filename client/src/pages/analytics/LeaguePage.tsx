import { Redirect } from "wouter";
import { LeagueComingSoon } from "@/components/shared/LeagueComingSoon";
import { leagueMeta, type LeagueCode } from "@/data/mock";

/** Generic league hub — live boards only for NBA/NFL; others show coming soon. */
export default function LeaguePage({ league }: { league: LeagueCode }) {
  const meta = leagueMeta[league];

  if (league === "NBA") return <Redirect to="/nba" />;
  if (league === "NFL") return <Redirect to="/nfl" />;

  return (
    <LeagueComingSoon
      league={meta.name}
      title={`${meta.name} board`}
      reason={`${meta.name} props will load from the warehouse when a live provider is connected. NBA and NFL boards are live today.`}
    />
  );
}
