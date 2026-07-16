import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Check, Info } from "lucide-react";
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
import { cn } from "@/lib/utils";
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
                y={h - 8}
                textAnchor="middle"
                className="fill-neutral-600"
                fontSize="8"
              >
                {g.date}
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
  const playerId = params?.id ?? "";

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
          league: raw.league || league,
          boardHref: raw.boardHref || boardHref,
        });
      }

      // Prefer league-specific endpoints; never accept an empty-market hit.
      const wnba = await tryLeague(
        `/api/wnba/players/${encodeURIComponent(playerId)}`,
        "WNBA",
        "/wnba",
      );
      if (wnba) return wnba;

      const nba = await tryLeague(
        `/api/nba/players/${encodeURIComponent(playerId)}`,
        "NBA",
        "/nba",
      );
      if (nba) return nba;

      // NFL players: build a minimal research profile from board props
      const nflRes = await fetch("/api/nfl/props");
      if (!nflRes.ok) throw new Error("player");
      const board = (await nflRes.json()) as { props: Record<string, unknown>[] };
      const mine = board.props.filter(
        (p) => String(p.playerId) === playerId || String(p.playerWarehouseId) === playerId,
      );
      if (!mine.length) throw new Error("player");
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
          { key: "l5", label: "Last 5", average: null, hitRate: 0, hitPct: 0, hits: String(p.l5 ?? "0/0") },
          { key: "l10", label: "Last 10", average: null, hitRate: 0, hitPct: 0, hits: String(p.l10 ?? "0/0") },
          { key: "l20", label: "Last 20", average: null, hitRate: 0, hitPct: 0, hits: String(p.l20 ?? "0/0") },
          { key: "all", label: "All", average: null, hitRate: 0, hitPct: 0, hits: String(p.season ?? "0/0") },
          { key: "matchup", label: "Matchup", average: null, hitRate: 0, hitPct: 0, hits: String(p.l10 ?? "0/0") },
        ],
        chartGames: [] as ChartGame[],
      }));
      return asLivePlayerResearch({
        id: playerId,
        name: String(top.player),
        league: "NFL",
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
        dataQualityScore: 70,
        aiExplain: {
          verdict: "neutral",
          headline: String((top.explanation as string[] | undefined)?.[0] ?? "Live NFL lean"),
          body: "Built from live ESPN NFL warehouse props.",
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
        boardHref: "/nfl",
      });
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
    <div className="mx-auto max-w-3xl">
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

      <div className="card-3d rounded-2xl border border-[#1a1a1a] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-yellow-500/35 bg-gradient-to-br from-yellow-400/20 to-amber-700/10 text-sm font-semibold text-yellow-300">
              {profile.initials}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-white sm:text-2xl">{profile.name}</h1>
                <ResearchScoreBadge score={profile.researchScore} size="sm" />
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                {profile.team} · {profile.position} · vs {profile.opponent}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMarketIdx((i) => (i - 1 + markets.length) % markets.length)}
              className="rounded-lg border border-[#1a1a1a] p-2 text-neutral-400 hover:border-yellow-500/30 hover:text-yellow-400"
              aria-label="Previous market"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-[7.5rem] text-center">
              <p className="text-2xl font-semibold tabular-nums text-white">{market.line}</p>
              <p className="text-[11px] uppercase tracking-wider text-neutral-500">{market.market}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-yellow-400/90">
                Model lean
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMarketIdx((i) => (i + 1) % markets.length)}
              className="rounded-lg border border-[#1a1a1a] p-2 text-neutral-400 hover:border-yellow-500/30 hover:text-yellow-400"
              aria-label="Next market"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex w-full gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setSide("Over");
                addCurrent("Over");
              }}
              className={cn(
                "flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition sm:flex-none",
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
                "flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition sm:flex-none",
                selectedSide === "Under"
                  ? "border-red-500/50 bg-red-500/15 text-red-300"
                  : "border-red-500/25 text-red-400/80 hover:bg-red-500/10",
              )}
            >
              UNDER
            </button>
          </div>
        </div>

        <div className="mt-5 flex gap-1 border-b border-[#1a1a1a]">
          {(
            [
              ["chart", "Chart"],
              ["lines", "Lines"],
              ["matchup", "Matchup"],
              ["log", "Game Log"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "px-3 py-2 text-sm font-medium transition",
                tab === id
                  ? "border-b-2 border-yellow-400 text-yellow-300"
                  : "text-neutral-500 hover:text-neutral-300",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {tab === "chart" && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-white">Last 10 Games · {market.market}</h2>
              <GameChart games={market.chartGames} line={market.line} />
            </div>
          )}

          {tab === "lines" && (
            <div className="space-y-3">
              <p className="text-xs text-neutral-500">
                Model recommendation <span className="text-yellow-400">{market.side}</span> at consensus{" "}
                {market.line}. Open the prop report for sportsbook / pick&apos;em comparison.
              </p>
              <Link
                href={`/prop/${market.propId}`}
                className="inline-flex rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm font-medium text-yellow-300 hover:bg-yellow-500/20"
              >
                Open full Research Report →
              </Link>
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
                        {m.market} {m.side} {m.line}
                      </span>
                      <span className="tabular-nums text-emerald-300">
                        Proj {m.projectedValue.toFixed(1)} · edge {m.edgeVsLine > 0 ? "+" : ""}
                        {m.edgeVsLine.toFixed(1)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === "matchup" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-white">{profile.matchup.title}</h2>
                <p className="mt-1 text-xs text-neutral-500">Defense rank · {profile.matchup.defenseRank}</p>
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
                          <p className="text-sm font-semibold tabular-nums text-neutral-100">{v.toFixed(1)}</p>
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
                    <tr key={`${log.date}-${log.opponent}`}>
                      <td className="py-2.5 text-neutral-300">{log.date}</td>
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
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {(market.hitWindows ?? []).map((w) => (
          <button
            key={w.key}
            type="button"
            onClick={() => setWindowKey(w.key)}
            className={cn(
              "min-w-[5.5rem] shrink-0 rounded-xl border px-3 py-2.5 text-left transition",
              windowKey === w.key
                ? "border-yellow-500/40 bg-yellow-500/10"
                : "border-[#1a1a1a] bg-[#0c0c0c]",
            )}
          >
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">{w.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-white">
              {w.average != null ? w.average.toFixed(1) : "—"}
            </p>
            <p className="text-xs tabular-nums text-emerald-300">{w.hitPct}%</p>
          </button>
        ))}
      </div>
      {activeWindow && (
        <p className="mt-2 text-[11px] text-neutral-500">
          {activeWindow.label}: avg {activeWindow.average ?? "—"} · hit {activeWindow.hits} (
          {activeWindow.hitPct}%) vs {market.side} {market.line}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Our Projection" value={market.projectedValue.toFixed(1)} hint="Seraphim model" />
        <Metric
          label="Projection Edge"
          value={`${market.edgeVsLine > 0 ? "+" : ""}${market.edgeVsLine.toFixed(1)}`}
          hint="vs consensus line"
          accent="emerald"
        />
        <Metric
          label="Proj Edge %"
          value={`${market.edgePercent > 0 ? "+" : ""}${market.edgePercent.toFixed(1)}%`}
          hint="edge / line"
          accent="emerald"
        />
        <Metric label="Confidence" value={`${market.confidence}%`} hint="model certainty" />
        <Metric label="Research Score" value={`${market.researchScore}`} hint="checklist-backed" />
        <Metric
          label="Model EV"
          value={`+${market.evPercent.toFixed(1)}%`}
          hint="vs comparison odds"
          accent="emerald"
        />
      </div>

      <ProOnly
        title="Why this lean"
        description="Upgrade to Pro for the AI writeup on this market."
        ctaLabel="Upgrade to Pro"
      >
        <section className="card-3d mt-4 rounded-2xl border border-[#1a1a1a] p-5">
          <h2 className="text-sm font-semibold text-white">Why · {market.market}</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-300">
            {market.why || profile.aiExplain.headline}
          </p>
          <ul className="mt-3 space-y-1.5">
            {(market.explanation.length ? market.explanation : [profile.aiExplain.body]).map((line) => (
              <li key={line} className="text-xs leading-relaxed text-neutral-500">
                <span className="mr-2 text-yellow-500">•</span>
                {line}
              </li>
            ))}
          </ul>
        </section>
      </ProOnly>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={added}
          onClick={() => addCurrent()}
          className={cn(
            "btn-3d inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold",
            added
              ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
              : "bg-gradient-to-b from-yellow-400 to-amber-500 text-black",
          )}
        >
          {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {added ? "In Builder" : `Add ${market.market} ${selectedSide} ${market.line}`}
        </button>
        <Link
          href={`/prop/${market.propId}`}
          className="inline-flex items-center rounded-xl border border-[#1a1a1a] bg-[#111] px-4 py-2.5 text-sm text-neutral-300 hover:border-yellow-500/30 hover:text-yellow-400"
        >
          Full prop report
        </Link>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "emerald";
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
          accent === "emerald" ? "text-emerald-300" : "text-white",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[10px] text-neutral-600">{hint}</p>}
    </div>
  );
}
