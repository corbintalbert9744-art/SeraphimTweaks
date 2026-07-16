import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Check, Info } from "lucide-react";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { propIdToBuilderLeg } from "@/lib/addPropToBuilder";
import {
  asNbaPropFromApi,
  cacheNbaBoardProps,
  getCachedNbaProp,
} from "@/lib/nbaLiveCache";
import {
  asLivePlayerResearch,
  type ChartGame,
  type PlayerResearchProfile,
} from "@/lib/playerResearchProfile";
import { decodePlayerRouteId } from "@/lib/playerLinks";
import { cn } from "@/lib/utils";
import { leanTextClass } from "@/lib/leanTheme";
import { ProOnly } from "@/components/membership/ProOnly";
import { CardSkeleton } from "@/components/shared/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { nbaToBuilderLeg } from "@/lib/builderMappers";
import type { NbaProp } from "@/data/nbaMock";

type Tab = "chart" | "lines" | "matchup" | "log";

function GameChart({ games, line }: { games: ChartGame[]; line: number }) {
  if (!games.length) {
    return <p className="py-10 text-center text-sm text-neutral-500">No gamelogs for this market yet.</p>;
  }
  const maxStat = Math.max(...games.map((g) => g.value), line, 1) * 1.15;
  const maxMin = Math.max(...games.map((g) => g.minutes), 1);
  const w = 560;
  const h = 200;
  const padL = 28;
  const padR = 12;
  const padT = 16;
  const padB = 36;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const barW = Math.min(28, (innerW / games.length) * 0.55);
  const lineY = padT + innerH - (line / maxStat) * innerH;

  const minCoords = games.map((g, i) => {
    const x = padL + ((i + 0.5) / games.length) * innerW;
    const y = padT + innerH - (g.minutes / maxMin) * innerH;
    return { x, y, m: g.minutes };
  });
  const minPoly = minCoords.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-neutral-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/80" /> Over
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-500/70" /> Under
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-px w-4 border-t border-dashed border-yellow-400" /> Minutes / snaps
        </span>
        <span className="tabular-nums text-neutral-400">Line {line}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-52 w-full">
        <line x1={padL} y1={lineY} x2={w - padR} y2={lineY} stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
        {games.map((g, i) => {
          const x = padL + ((i + 0.5) / games.length) * innerW - barW / 2;
          const barH = (g.value / maxStat) * innerH;
          const y = padT + innerH - barH;
          return (
            <g key={g.label}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(2, barH)}
                rx={3}
                fill={g.hit ? "rgb(16, 185, 129)" : "rgb(239, 68, 68)"}
                opacity={0.85}
              />
              <text
                x={padL + ((i + 0.5) / games.length) * innerW}
                y={Math.max(12, y - 4)}
                textAnchor="middle"
                className="fill-neutral-200"
                fontSize="9"
                fontWeight="600"
              >
                {Number.isFinite(g.value) ? g.value : "—"}
              </text>
              <text
                x={padL + ((i + 0.5) / games.length) * innerW}
                y={h - 8}
                textAnchor="middle"
                className="fill-neutral-600"
                fontSize="8"
              >
                {g.opponent || (g.time ? `${g.date} ${g.time}` : g.date)}
              </text>
            </g>
          );
        })}
        <polyline
          fill="none"
          stroke="rgb(250, 204, 21)"
          strokeWidth="2"
          strokeDasharray="5 4"
          points={minPoly}
        />
        {minCoords.map((c, i) => (
          <g key={`m-${i}`}>
            <circle cx={c.x} cy={c.y} r="3" fill="#0a0a0a" stroke="rgb(250,204,21)" strokeWidth="1.5" />
            <text x={c.x} y={c.y - 6} textAnchor="middle" className="fill-yellow-400/90" fontSize="8">
              {Math.round(c.m)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function logStatKeys(profile: PlayerResearchProfile): string[] {
  const first = profile.recentLogs[0]?.stats ?? {};
  const keys = Object.keys(first);
  if (keys.length) return keys.slice(0, 4);
  return ["pts", "reb", "ast"];
}

export default function PlayerPage() {
  const [, params] = useRoute("/player/:id");
  const playerId = decodePlayerRouteId(params?.id);

  const live = useQuery({
    queryKey: ["live-player", playerId],
    enabled: Boolean(playerId),
    queryFn: async () => {
      async function tryLeague(
        path: string,
        league: string,
        boardHref: string,
      ): Promise<PlayerResearchProfile | null> {
        const res = await fetch(path);
        if (!res.ok) return null;
        const data = await res.json();
        const raw = (data.player ?? data) as PlayerResearchProfile;
        if (!raw?.markets?.length) return null;
        return asLivePlayerResearch({
          ...raw,
          id: raw.id || playerId,
          league: raw.league || league,
          boardHref: raw.boardHref || boardHref,
        });
      }

      const encoded = encodeURIComponent(playerId);
      // Prefer league-specific endpoints; try encoded + raw variants.
      const leagueTries: Array<{ path: string; league: string; href: string }> = [
        { path: `/api/mlb/players/${encoded}`, league: "MLB", href: "/mlb" },
        { path: `/api/wnba/players/${encoded}`, league: "WNBA", href: "/wnba" },
        { path: `/api/nba/players/${encoded}`, league: "NBA", href: "/nba" },
      ];
      for (const t of leagueTries) {
        const hit = await tryLeague(t.path, t.league, t.href);
        if (hit) return hit;
      }

      // Multi-sport boards: build a research profile from open props.
      let platformQs = "";
      try {
        const saved = localStorage.getItem("seraphim.pickemApp");
        if (saved) platformQs = `?platform=${encodeURIComponent(saved)}`;
      } catch {
        /* ignore */
      }
      const boardSources: Array<{ path: string; league: string; boardHref: string }> = [
        { path: `/api/wnba/props${platformQs}`, league: "WNBA", boardHref: "/wnba" },
        { path: `/api/nba/props${platformQs}`, league: "NBA", boardHref: "/nba" },
        { path: `/api/nfl/props`, league: "NFL", boardHref: "/nfl" },
        { path: `/api/mlb/props`, league: "MLB", boardHref: "/mlb" },
        { path: `/api/nhl/props`, league: "NHL", boardHref: "/nhl" },
        { path: `/api/soccer/props`, league: "Soccer", boardHref: "/soccer" },
        { path: `/api/tennis/props?tour=ATP`, league: "ATP", boardHref: "/tennis" },
        { path: `/api/tennis/props?tour=WTA`, league: "WTA", boardHref: "/tennis" },
      ];

      function matchesPlayer(p: Record<string, unknown>): boolean {
        const candidates = [
          p.playerId,
          p.playerExternalId,
          p.playerWarehouseId,
          p.id,
          typeof p.playerWarehouseId === "string" && String(p.playerWarehouseId).includes(":")
            ? String(p.playerWarehouseId).split(":").pop()
            : null,
          typeof p.playerId === "string" && String(p.playerId).includes(":")
            ? String(p.playerId).split(":").pop()
            : null,
        ];
        return candidates.some((c) => c != null && String(c) === playerId);
      }

      for (const src of boardSources) {
        const res = await fetch(src.path);
        if (!res.ok) continue;
        const board = (await res.json()) as { props: Record<string, unknown>[] };
        const mine = (board.props ?? []).filter(matchesPlayer);
        if (!mine.length) continue;
        const top = mine[0];
        const markets = mine.map((p) => ({
          propId: String(p.id),
          market: String(p.market),
          side: (p.side === "Under" ? "Under" : "Over") as "Over" | "Under",
          line: Number(p.line),
          americanOdds: Number(p.americanOdds ?? -110),
          projectedValue: Number(p.projectedValue ?? p.line),
          edgeVsLine: Number(p.edgeVsLine ?? 0),
          edgePercent: Number(p.line) ? (Number(p.edgeVsLine ?? 0) / Number(p.line)) * 100 : 0,
          researchScore: Number(p.researchScore ?? p.confidence ?? 50),
          confidence: Number(p.confidence ?? 50),
          evPercent: Number(p.evPercent ?? 0),
          explanation: (p.explanation as string[]) || [],
          why: `${p.side} ${p.line} ${p.market}`,
          hitWindows: [
            { key: "l5", label: "L5", average: null, hitRate: 0, hitPct: 0, hits: String(p.l5 ?? "0/0") },
            { key: "l10", label: "L10", average: null, hitRate: 0, hitPct: 0, hits: String(p.l10 ?? "0/0") },
            { key: "l20", label: "L20", average: null, hitRate: 0, hitPct: 0, hits: String(p.l20 ?? "0/0") },
            { key: "all", label: "Season", average: null, hitRate: 0, hitPct: 0, hits: String(p.season ?? "0/0") },
            { key: "matchup", label: "H2H", average: null, hitRate: 0, hitPct: 0, hits: "0/0" },
          ],
          chartGames: [] as ChartGame[],
        }));
        return asLivePlayerResearch({
          id: playerId,
          name: String(top.player),
          league: src.league,
          team: String(top.team ?? ""),
          opponent: String(top.opponent ?? ""),
          position: String(top.position ?? ""),
          initials: String(top.player)
            .split(/\s+/)
            .slice(0, 2)
            .map((s) => s[0] ?? "")
            .join("")
            .toUpperCase(),
          injury: "None",
          tipTime: String(top.tipTime ?? ""),
          researchScore: Number(top.researchScore ?? top.confidence ?? 50),
          dataQualityScore: Number(top.dqs ?? 70),
          aiExplain: {
            verdict: "neutral",
            headline: String((top.explanation as string[] | undefined)?.[0] ?? `Live ${src.league} lean`),
            body: `Built from live ${src.league} warehouse props.`,
          },
          matchup: {
            title: `vs ${top.opponent}`,
            defenseRank: "Live slate",
            bullets: [`${top.market} ${top.side} ${top.line}`],
          },
          homeSplit: { label: "Home", samples: 0, averages: {} },
          awaySplit: { label: "Away", samples: 0, averages: {} },
          recentLogs: [],
          markets,
          boardHref: src.boardHref,
        });
      }

      throw new Error("player");
    },
    staleTime: 120_000,
    retry: 1,
  });

  const boardProps = useQuery({
    queryKey: ["nba-board"],
    enabled: Boolean(live.data) && live.data?.league === "NBA",
    queryFn: async () => {
      const res = await fetch("/api/nba/props");
      if (!res.ok) throw new Error("board");
      return res.json() as Promise<{ props: Record<string, unknown>[] }>;
    },
    staleTime: 120_000,
  });

  const profile = live.data;
  const { addLeg, hasLeg } = useParlayDraft();
  const [tab, setTab] = useState<Tab>("chart");
  const [marketIdx, setMarketIdx] = useState(0);
  const [side, setSide] = useState<"Over" | "Under" | null>(null);
  const [windowKey, setWindowKey] = useState("l10");

  const markets = profile?.markets ?? [];
  useEffect(() => {
    setMarketIdx(0);
    setSide(null);
    setWindowKey("l10");
  }, [playerId]);

  const market = markets[Math.min(marketIdx, Math.max(0, markets.length - 1))] ?? null;
  const selectedSide = (side ?? market?.side ?? "Over") as "Over" | "Under";

  useEffect(() => {
    if (boardProps.data?.props?.length) {
      cacheNbaBoardProps(boardProps.data.props.map(asNbaPropFromApi));
    }
  }, [boardProps.data]);

  const activeWindow = useMemo(
    () => market?.hitWindows?.find((w) => w.key === windowKey) ?? market?.hitWindows?.[1],
    [market, windowKey],
  );

  if (live.isLoading && !profile) {
    return <CardSkeleton rows={5} />;
  }

  if (!profile || !market) {
    return (
      <div className="mt-6">
        <EmptyState
          title="Player not found"
          description="Open a sport board and pick a player card."
        />
        <div className="mt-4 text-center">
          <Link href="/nba" className="text-sm text-yellow-400 hover:underline">
            Back to boards
          </Link>
        </div>
      </div>
    );
  }

  const boardHref = profile.boardHref || "/nba";
  const added = hasLeg(market.propId);
  const logKeys = logStatKeys(profile);

  function addCurrent(overrideSide?: "Over" | "Under") {
    const s = overrideSide ?? selectedSide;
    let leg = propIdToBuilderLeg(market!.propId);
    if (!leg) {
      const cached = getCachedNbaProp(market!.propId);
      const row: NbaProp =
        cached ??
        ({
          id: market!.propId,
          playerId: profile!.id,
          player: profile!.name,
          team: profile!.team,
          opponent: profile!.opponent,
          position: profile!.position,
          market: market!.market as NbaProp["market"],
          side: market!.side === "Under" ? "Under" : "Over",
          line: market!.line,
          americanOdds: market!.americanOdds,
          noVigProb: market!.overProbability ?? 0.5,
          evPercent: market!.evPercent,
          confidence: market!.confidence,
          l5: "0/0",
          l10: "0/0",
          l20: "0/0",
          season: "0/0",
          tipTime: profile!.tipTime,
          projectedMinutes: 32,
          injury: "None",
        } as NbaProp);
      leg = nbaToBuilderLeg({ ...row, side: s });
    } else {
      leg = { ...leg, side: s };
    }
    addLeg(leg);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Link
          href={boardHref}
          className="inline-flex items-center gap-2 text-neutral-400 transition hover:text-yellow-400"
        >
          <ArrowLeft className="h-4 w-4" />
          {profile.league} board
        </Link>
        <span className="text-neutral-700">·</span>
        <Link href="/players" className="text-neutral-500 hover:text-yellow-400">
          All players
        </Link>
      </div>

      {/* Header */}
      <div className="card-3d rounded-2xl border border-[#1a1a1a] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-yellow-500/35 bg-gradient-to-br from-yellow-400/20 to-amber-700/10 text-sm font-semibold text-yellow-300">
              {profile.initials}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-white sm:text-2xl">{profile.name}</h1>
                <ResearchScoreBadge score={profile.researchScore} size="sm" />
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-neutral-500">
                {profile.league}
                {profile.position ? ` · ${profile.position}` : ""}
              </p>
              <p className="mt-0.5 text-sm text-neutral-300">
                {profile.team && profile.team !== "—" ? `${profile.team} vs ${profile.opponent}` : `vs ${profile.opponent}`}
                {profile.tipTime
                  ? ` · ${(() => {
                      const t = Date.parse(profile.tipTime);
                      return Number.isFinite(t)
                        ? new Date(t).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : profile.tipTime;
                    })()}`
                  : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wider text-yellow-500/80">Line</p>
              <p className="text-xl font-semibold tabular-nums text-yellow-300">{market.line}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSide("Over");
                addCurrent("Over");
              }}
              className={cn(
                "rounded-xl border px-4 py-2.5 text-sm font-semibold transition",
                selectedSide === "Over"
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                  : "border-emerald-500/25 text-emerald-400/80 hover:bg-emerald-500/10",
              )}
            >
              OVER
            </button>
            <button
              type="button"
              onClick={() => {
                setSide("Under");
                addCurrent("Under");
              }}
              className={cn(
                "rounded-xl border px-4 py-2.5 text-sm font-semibold transition",
                selectedSide === "Under"
                  ? "border-red-500/50 bg-red-500/15 text-red-300"
                  : "border-red-500/25 text-red-400/80 hover:bg-red-500/10",
              )}
            >
              UNDER
            </button>
            <button
              type="button"
              disabled={added}
              onClick={() => addCurrent()}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold",
                added
                  ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                  : "bg-gradient-to-b from-yellow-400 to-amber-500 text-black",
              )}
            >
              {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {added ? "Added" : "Parlay"}
            </button>
          </div>
        </div>

        {/* OddsIQ-style market tabs — one chip per available line/stat */}
        <div className="mt-5 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {markets.map((m, i) => (
            <button
              key={m.propId}
              type="button"
              onClick={() => {
                setMarketIdx(i);
                setSide(null);
                setTab("chart");
              }}
              className={cn(
                "shrink-0 rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-wide transition",
                i === marketIdx
                  ? "bg-yellow-400 text-black"
                  : "bg-[#141414] text-neutral-400 hover:bg-[#1a1a1a] hover:text-neutral-200",
              )}
            >
              {m.market}
              <span className="ml-1.5 tabular-nums opacity-80">{m.line}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          {/* Hit-rate strip */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(market.hitWindows ?? []).map((w) => (
              <button
                key={w.key}
                type="button"
                onClick={() => setWindowKey(w.key)}
                className={cn(
                  "min-w-[5.75rem] shrink-0 rounded-xl border px-3 py-2.5 text-left transition",
                  windowKey === w.key
                    ? "border-yellow-500/40 bg-yellow-500/10"
                    : "border-[#1a1a1a] bg-[#0c0c0c]",
                )}
              >
                <p className="text-[10px] uppercase tracking-wider text-neutral-500">{w.label}</p>
                <p
                  className={cn(
                    "mt-1 text-lg font-semibold tabular-nums",
                    w.hitPct >= 55 ? "text-emerald-300" : w.hitPct <= 45 ? "text-red-300" : "text-white",
                  )}
                >
                  {w.hitPct}%
                </p>
                <p className="text-[11px] tabular-nums text-neutral-400">
                  Avg {w.average != null ? w.average.toFixed(1) : "—"}
                </p>
              </button>
            ))}
          </div>
          {activeWindow && (
            <p className="text-[11px] text-neutral-500">
              {activeWindow.label}: {activeWindow.hits} hits ({activeWindow.hitPct}% over) vs line{" "}
              {market.line}
            </p>
          )}

          <div className="card-3d rounded-2xl border border-[#1a1a1a] p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">
                {profile.league} · {market.market}
              </h2>
              <div className="flex gap-1">
                {(
                  [
                    ["chart", "Chart"],
                    ["log", "Game Log"],
                    ["matchup", "Matchup"],
                    ["lines", "All lines"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-medium transition",
                      tab === id
                        ? "bg-yellow-400/15 text-yellow-300"
                        : "text-neutral-500 hover:text-neutral-300",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {tab === "chart" && (
              <div>
                <p className="mb-2 text-xs text-neutral-500">
                  Last {market.chartGames.length || 10} games · line {market.line} · proj{" "}
                  {market.projectedValue.toFixed(1)} (
                  {market.edgeVsLine > 0 ? "+" : ""}
                  {market.edgeVsLine.toFixed(1)} vs line)
                </p>
                <GameChart games={market.chartGames} line={market.line} />
              </div>
            )}

            {tab === "lines" && (
              <ul className="space-y-2">
                {markets.map((m, i) => (
                  <li key={m.propId}>
                    <button
                      type="button"
                      onClick={() => setMarketIdx(i)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-sm",
                        i === marketIdx
                          ? "border-yellow-500/35 bg-yellow-500/10"
                          : "border-[#1a1a1a] bg-black/20",
                      )}
                    >
                      <span className="text-neutral-200">
                        {m.market} · {m.side} {m.line}
                      </span>
                      <span className={cn("tabular-nums", leanTextClass(m.side))}>
                        Proj {m.projectedValue.toFixed(1)} ·{" "}
                        {m.edgePercent > 0 ? "+" : ""}
                        {m.edgePercent.toFixed(1)}%
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {tab === "matchup" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">{profile.matchup.title}</h3>
                  <p className="mt-1 text-xs text-neutral-500">Defense · {profile.matchup.defenseRank}</p>
                  <ul className="mt-3 space-y-2">
                    {profile.matchup.bullets.map((b) => (
                      <li key={b} className="text-sm text-neutral-400">
                        <span className="mr-2 text-yellow-500">•</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[profile.homeSplit, profile.awaySplit].map((s) => (
                    <div key={s.label} className="rounded-xl border border-[#1a1a1a] bg-black/25 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        {s.label} · {s.samples} gms
                      </p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        {Object.entries(s.averages).map(([k, v]) => (
                          <div key={k}>
                            <p className="text-[10px] uppercase text-neutral-600">{k}</p>
                            <p className="text-sm font-semibold tabular-nums text-neutral-100">
                              {typeof v === "number" ? v.toFixed(1) : v}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "log" && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wider text-neutral-500">
                    <tr>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Time</th>
                      <th className="pb-3 font-medium">Opp</th>
                      <th className="pb-3 font-medium">H/A</th>
                      {logKeys.map((k) => (
                        <th key={k} className="pb-3 font-medium">
                          {k}
                        </th>
                      ))}
                      <th className="pb-3 font-medium">Min</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#151515]">
                    {profile.recentLogs.map((log) => (
                      <tr key={`${log.date}-${log.time ?? ""}-${log.opponent}`}>
                        <td className="py-2.5 text-neutral-300">{log.date}</td>
                        <td className="py-2.5 tabular-nums text-neutral-400">{log.time || "—"}</td>
                        <td className="py-2.5 text-neutral-200">{log.opponent}</td>
                        <td className="py-2.5 text-neutral-500">{log.home ? "H" : "A"}</td>
                        {logKeys.map((k) => (
                          <td key={k} className="py-2.5 tabular-nums text-neutral-200">
                            {log.stats[k] ?? "—"}
                          </td>
                        ))}
                        <td className="py-2.5 tabular-nums text-neutral-400">{log.minutesOrSnaps}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric
              label="Our Projection"
              value={market.projectedValue.toFixed(1)}
              hint="Seraphim model"
              lean={market.side}
            />
            <Metric
              label="Edge"
              value={`${market.edgeVsLine > 0 ? "+" : ""}${market.edgeVsLine.toFixed(1)}`}
              hint="vs platform line"
              lean={market.side}
            />
            <Metric
              label="Edge %"
              value={`${market.edgePercent > 0 ? "+" : ""}${market.edgePercent.toFixed(1)}%`}
              hint="edge / line"
              lean={market.side}
            />
            <Metric label="Confidence" value={`${market.confidence}%`} hint="model certainty" />
            <Metric label="Research Score" value={`${market.researchScore}`} hint="checklist-backed" />
            <Metric
              label="Model EV"
              value={`+${market.evPercent.toFixed(1)}%`}
              hint="vs comparison odds"
              lean={market.side}
            />
          </div>

          <ProOnly
            title="Why this lean"
            description="Upgrade to Pro for the AI writeup on this market."
            ctaLabel="Upgrade to Pro"
          >
            <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
              <h2 className="text-sm font-semibold text-white">Why · {market.market}</h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                {market.why || profile.aiExplain.headline}
              </p>
              <ul className="mt-3 space-y-1.5">
                {(market.explanation.length ? market.explanation : [profile.aiExplain.body]).map(
                  (line) => (
                    <li key={line} className="text-xs leading-relaxed text-neutral-500">
                      <span className="mr-2 text-yellow-500">•</span>
                      {line}
                    </li>
                  ),
                )}
              </ul>
            </section>
          </ProOnly>
        </div>

        {/* Insights sidebar (OddsIQ-style) */}
        <aside className="space-y-3">
          <div className="card-3d rounded-2xl border border-[#1a1a1a] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Insights
            </p>
            <h3 className="mt-1 text-sm font-semibold text-white">{profile.matchup.title}</h3>
            <p className="mt-1 text-xs text-neutral-500">{profile.matchup.defenseRank}</p>
            <div className="mt-4 flex items-center justify-center">
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-yellow-500/40">
                <div className="text-center">
                  <p className="text-2xl font-semibold tabular-nums text-yellow-300">
                    {Math.round(market.confidence)}%
                  </p>
                  <p className="text-[10px] uppercase text-neutral-500">Conf</p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-neutral-400">
              Model lean{" "}
              <span className={cn("font-semibold", leanTextClass(market.side))}>
                {market.side} {market.line}
              </span>
            </p>
          </div>

          <div className="card-3d rounded-2xl border border-[#1a1a1a] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Home / Away
            </p>
            <div className="mt-3 space-y-2">
              {[profile.homeSplit, profile.awaySplit].map((s) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between rounded-lg border border-[#1a1a1a] bg-black/30 px-3 py-2"
                >
                  <span className="text-xs text-neutral-400">
                    {s.label} · {s.samples}
                  </span>
                  <span className="text-xs tabular-nums text-neutral-200">
                    {Object.entries(s.averages)
                      .slice(0, 2)
                      .map(([k, v]) => `${k} ${typeof v === "number" ? v.toFixed(1) : v}`)
                      .join(" · ") || "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card-3d rounded-2xl border border-[#1a1a1a] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Available lines
            </p>
            <ul className="mt-2 space-y-1.5">
              {markets.map((m, i) => (
                <li key={m.propId}>
                  <button
                    type="button"
                    onClick={() => setMarketIdx(i)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition",
                      i === marketIdx ? "bg-yellow-500/10 text-yellow-300" : "text-neutral-400 hover:bg-white/5",
                    )}
                  >
                    <span>{m.market}</span>
                    <span className="tabular-nums">{m.line}</span>
                  </button>
                </li>
              ))}
            </ul>
            <Link
              href={`/prop/${encodeURIComponent(market.propId)}`}
              className="mt-3 inline-flex text-xs font-medium text-yellow-400 hover:underline"
            >
              Full research report →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  lean,
}: {
  label: string;
  value: string;
  hint?: string;
  lean?: "Over" | "Under" | string | null;
}) {
  return (
    <div className="card-3d rounded-2xl border border-[#1a1a1a] p-3.5">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
        {hint && <Info className="h-3 w-3 opacity-50" aria-label={hint} />}
      </div>
      <p
        className={cn(
          "mt-2 text-xl font-semibold tabular-nums",
          lean ? leanTextClass(lean) : "text-white",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[10px] text-neutral-600">{hint}</p>}
    </div>
  );
}
