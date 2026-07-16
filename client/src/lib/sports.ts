import type { LeagueCode } from "@/data/mock";

export type SportTabId = "NBA" | "NFL" | "MLB" | "NHL" | "Soccer" | "ATP" | "WTA" | "WNBA";

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
  { id: "NHL", label: "NHL", href: "/nhl", league: "NHL" },
  { id: "Soccer", label: "Soccer", href: "/soccer", league: "Soccer" },
  { id: "WNBA", label: "WNBA", href: "/wnba", league: "WNBA" },
  { id: "ATP", label: "ATP", href: "/atp", league: "ATP" },
  { id: "WTA", label: "WTA", href: "/wta", league: "WTA" },
];

export function sportTabFromPath(pathname: string): SportTabId | null {
  const path = pathname.replace(/^\/app(?=\/|$)/, "") || "/";
  if (path === "/nba" || path.startsWith("/nba/")) return "NBA";
  if (path === "/nfl" || path.startsWith("/nfl/")) return "NFL";
  if (path === "/mlb" || path.startsWith("/mlb/")) return "MLB";
  if (path === "/nhl" || path.startsWith("/nhl/")) return "NHL";
  if (path === "/soccer" || path.startsWith("/soccer/")) return "Soccer";
  if (path === "/atp" || path.startsWith("/atp/")) return "ATP";
  if (path === "/wta" || path.startsWith("/wta/")) return "WTA";
  if (path === "/wnba" || path.startsWith("/wnba/")) return "WNBA";
  return null;
}
