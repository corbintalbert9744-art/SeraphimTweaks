const ESPN_SITE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const ESPN_WEB = "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba";

async function espnJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": "SeraphimAnalytics/1.0", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`ESPN ${res.status} for ${url}`);
  return res.json() as Promise<T>;
}

export type NbaGameDto = {
  id: string;
  name: string;
  shortName: string;
  tipoffAt: string;
  status: string;
  statusDetail: string;
  venue?: string;
  home: { id: string; abbreviation: string; name: string; score?: number; logo?: string };
  away: { id: string; abbreviation: string; name: string; score?: number; logo?: string };
};

export type NbaGamelogRow = {
  eventId: string;
  date: string;
  opponent: string;
  home: boolean;
  points: number;
  rebounds: number;
  assists: number;
  threes: number;
  minutes: number;
};

export async function fetchNbaScoreboard(dates?: string): Promise<{
  date: string;
  games: NbaGameDto[];
  source: "espn";
}> {
  const qs = dates ? `?dates=${dates}` : "";
  const data = await espnJson<any>(`${ESPN_SITE}/scoreboard${qs}`);
  const day = data?.day?.date ?? new Date().toISOString().slice(0, 10);
  const games: NbaGameDto[] = (data?.events ?? []).map((e: any) => {
    const comp = e.competitions?.[0];
    const home = (comp?.competitors ?? []).find((c: any) => c.homeAway === "home");
    const away = (comp?.competitors ?? []).find((c: any) => c.homeAway === "away");
    return {
      id: String(e.id),
      name: e.name,
      shortName: e.shortName,
      tipoffAt: e.date,
      status: e.status?.type?.name ?? "STATUS_UNKNOWN",
      statusDetail: e.status?.type?.description ?? e.status?.type?.detail ?? "",
      venue: comp?.venue?.fullName,
      home: {
        id: String(home?.team?.id ?? ""),
        abbreviation: home?.team?.abbreviation ?? "HOME",
        name: home?.team?.displayName ?? "Home",
        score: home?.score != null ? Number(home.score) : undefined,
        logo: home?.team?.logo,
      },
      away: {
        id: String(away?.team?.id ?? ""),
        abbreviation: away?.team?.abbreviation ?? "AWAY",
        name: away?.team?.displayName ?? "Away",
        score: away?.score != null ? Number(away.score) : undefined,
        logo: away?.team?.logo,
      },
    };
  });
  console.log(`[espn-nba] scoreboard ${day}: ${games.length} games`);
  return { date: day, games, source: "espn" };
}

export async function fetchNbaSummary(eventId: string): Promise<any> {
  return espnJson(`${ESPN_SITE}/summary?event=${eventId}`);
}

export async function fetchPlayerGamelog(athleteId: string): Promise<NbaGamelogRow[]> {
  const data = await espnJson<any>(`${ESPN_WEB}/athletes/${athleteId}/gamelog`);
  const labels: string[] = data?.labels ?? [];
  const names: string[] = data?.names ?? [];
  const idx = (key: string) => names.findIndex((n) => n.toLowerCase() === key.toLowerCase());
  const iPts = idx("points") >= 0 ? idx("points") : labels.findIndex((l) => l === "PTS");
  const iReb = idx("totalRebounds") >= 0 ? idx("totalRebounds") : labels.findIndex((l) => l === "REB");
  const iAst = idx("assists") >= 0 ? idx("assists") : labels.findIndex((l) => l === "AST");
  const i3 = idx("threePointFieldGoalsMade") >= 0 ? idx("threePointFieldGoalsMade") : labels.findIndex((l) => l === "3PT");
  const iMin = idx("minutes") >= 0 ? idx("minutes") : labels.findIndex((l) => l === "MIN");

  const eventsMap: Record<string, any> = data?.events ?? {};
  const rows: NbaGamelogRow[] = [];

  for (const season of data?.seasonTypes ?? []) {
    for (const cat of season.categories ?? []) {
      for (const ev of cat.events ?? []) {
        const eventId = String(ev.eventId);
        const meta = eventsMap[eventId] ?? {};
        const stats: string[] = ev.stats ?? [];
        const num = (i: number) => {
          if (i < 0 || i >= stats.length) return 0;
          const v = parseFloat(String(stats[i]).replace(/[^0-9.]/g, ""));
          return Number.isFinite(v) ? v : 0;
        };
        rows.push({
          eventId,
          date: meta.gameDate ?? meta.date ?? "",
          opponent: meta.opponent?.abbreviation ?? meta.opponentAbbreviation ?? "OPP",
          home: Boolean(meta.atVs === "vs" || meta.homeAway === "home"),
          points: num(iPts),
          rebounds: num(iReb),
          assists: num(iAst),
          threes: num(i3),
          minutes: num(iMin),
        });
      }
    }
  }

  // Newest first
  rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return rows;
}

export type FeaturedAthlete = {
  id: string;
  fullName: string;
  shortName: string;
  headshot?: string;
  position?: string;
  teamAbbr: string;
  teamId: string;
};

export function pickFeaturedAthleteFromSummary(summary: any, fallbackTeamAbbr: string): FeaturedAthlete | null {
  const leaders = summary?.leaders ?? [];
  for (const teamBlock of leaders) {
    const pts = (teamBlock.leaders ?? []).find((l: any) => l.name === "points");
    const top = pts?.leaders?.[0]?.athlete;
    if (top?.id) {
      return {
        id: String(top.id),
        fullName: top.displayName ?? top.fullName,
        shortName: top.shortName ?? top.displayName,
        headshot: top.headshot?.href,
        position: top.position?.abbreviation,
        teamAbbr: teamBlock.team?.abbreviation ?? fallbackTeamAbbr,
        teamId: String(teamBlock.team?.id ?? ""),
      };
    }
  }
  return null;
}

export function extractInjuries(summary: any): Array<{
  team: string;
  player: string;
  status: string;
  detail?: string;
}> {
  const out: Array<{ team: string; player: string; status: string; detail?: string }> = [];
  for (const block of summary?.injuries ?? []) {
    const team = block.team?.abbreviation ?? block.team?.displayName ?? "TEAM";
    for (const inj of block.injuries ?? []) {
      out.push({
        team,
        player: inj.athlete?.displayName ?? inj.athlete?.fullName ?? "Unknown",
        status: inj.status ?? inj.type?.description ?? "Unknown",
        detail: inj.details?.type ?? inj.longComment ?? inj.shortComment,
      });
    }
  }
  return out;
}
