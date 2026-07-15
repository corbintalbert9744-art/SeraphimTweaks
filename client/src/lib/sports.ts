import type { LeagueCode } from "@/data/mock";

export type SportTabId = "NBA" | "NFL" | "MLB" | "ATP" | "WTA" | "WNBA";

export interface SportTab {
  id: SportTabId;
  label: string;
  href: string;
  league: LeagueCode;
}

export const SPORT_TABS: SportTab[] = [
  { id: "NBA", label: "NBA", href: "/nba", league: "NBA" },
  { id: "NFL", label: "NFL", href: "/nfl", league: "NFL" },
  { id: "MLB", label: "MLB", href: "/mlb", league: "MLB" },
  { id: "ATP", label: "ATP", href: "/atp", league: "ATP" },
  { id: "WTA", label: "WTA", href: "/wta", league: "WTA" },
  { id: "WNBA", label: "WNBA", href: "/wnba", league: "WNBA" },
];

export function sportTabFromPath(pathname: string): SportTabId | null {
  // Works for nested /app scope (/nba) and absolute /app/nba if ever used outside nest.
  const path = pathname.replace(/^\/app(?=\/|$)/, "") || "/";
  if (path === "/nba" || path.startsWith("/nba/")) return "NBA";
  if (path === "/nfl" || path.startsWith("/nfl/")) return "NFL";
  if (path === "/mlb" || path.startsWith("/mlb/")) return "MLB";
  if (path === "/atp" || path.startsWith("/atp/")) return "ATP";
  if (path === "/wta" || path.startsWith("/wta/")) return "WTA";
  if (path === "/wnba" || path.startsWith("/wnba/")) return "WNBA";
  return null;
}
