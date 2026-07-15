import type { LeagueCode } from "@/data/mock";

export type SportTabId = "NBA" | "NFL" | "ATP" | "WTA" | "WNBA";

export interface SportTab {
  id: SportTabId;
  label: string;
  emoji: string;
  href: string;
  league: LeagueCode;
}

export const SPORT_TABS: SportTab[] = [
  { id: "NBA", label: "NBA", emoji: "🏀", href: "/nba", league: "NBA" },
  { id: "NFL", label: "NFL", emoji: "🏈", href: "/nfl", league: "NFL" },
  { id: "ATP", label: "ATP", emoji: "🎾", href: "/atp", league: "ATP" },
  { id: "WTA", label: "WTA", emoji: "🎾", href: "/wta", league: "WTA" },
  { id: "WNBA", label: "WNBA", emoji: "🏀", href: "/wnba", league: "WNBA" },
];

export function sportTabFromPath(pathname: string): SportTabId | null {
  if (pathname === "/nba" || pathname.startsWith("/nba/")) return "NBA";
  if (pathname === "/nfl" || pathname.startsWith("/nfl/")) return "NFL";
  if (pathname === "/atp" || pathname.startsWith("/atp/")) return "ATP";
  if (pathname === "/wta" || pathname.startsWith("/wta/")) return "WTA";
  if (pathname === "/wnba" || pathname.startsWith("/wnba/")) return "WNBA";
  return null;
}
