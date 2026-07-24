import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { LeagueBadge } from "@/components/shared/LeagueBadge";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { CardSkeleton } from "@/components/shared/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { propResearchPath } from "@/lib/playerLinks";
import { EvPlusBadge, PLUS_EV_THRESHOLD } from "@/components/research";
import { usePickemApp } from "@/context/PickemAppContext";
import { PickemAppGate, PickemAppSwitcher } from "@/components/shared/PickemAppGate";
import type { LeagueCode } from "@/data/mock";

type SortKey = "ev" | "edge" | "confidence" | "researchScore";

type PlusEvProp = {
  id: string;
  player: string;
  team?: string;
  opponent?: string;
  market: string;
  side: string;
  line: number;
  league: LeagueCode | string;
  projectedValue?: number | null;
  evPercent?: number | null;
  modelEdge?: number | null;
  modelEdgePct?: number | null;
  modelProbability?: number | null;
  impliedProbability?: number | null;
  confidence?: number;
  researchScore?: number;
  isPlusEv?: boolean;
  isStrongPlusEv?: boolean;
  bestEvBook?: string | null;
  bestEvLine?: number | null;
  bestEvSide?: string | null;
  l10?: string;
};

const LEAGUES: Array<LeagueCode | "All"> = [
  "All",
  "NBA",
  "WNBA",
  "NFL",
  "MLB",
  "NHL",
  "Soccer",
  "ATP",
  "WTA",
];

const SORT_OPTIONS: Array<{ id: SortKey; label: string }> = [
  { id: "ev", label: "Highest EV" },
  { id: "edge", label: "Biggest model edge" },
  { id: "confidence", label: "Confidence score" },
  { id: "researchScore", label: "Research score" },
];

export default function PlusEvPage() {
  const { appId, app, ready } = usePickemApp();
  const platform = appId || "prizepicks";
  const [league, setLeague] = useState<(typeof LEAGUES)[number]>("All");
  const [sort, setSort] = useState<SortKey>("ev");
  const [plusOnly, setPlusOnly] = useState(true);

  const board = useQuery({
    queryKey: ["plus-ev-board", platform, league, sort, plusOnly],
    enabled: ready,
    queryFn: async () => {
      const qs = new URLSearchParams({
        platform,
        sort,
        plusEvOnly: plusOnly ? "true" : "false",
        limit: "100",
      });
      if (league !== "All") qs.set("league", league);
      const res = await fetch(`/api/plus-ev?${qs}`);
      if (!res.ok) throw new Error("plus-ev");
      return res.json() as Promise<{
        props: PlusEvProp[];
        count: number;
        plusEvCount: number;
        threshold: number;
        disclaimer?: string;
      }>;
    },
    staleTime: 90_000,
    refetchInterval: 300_000,
  });

  const props = board.data?.props ?? [];
  const threshold = board.data?.threshold ?? PLUS_EV_THRESHOLD;

  const summary = useMemo(() => {
    if (!props.length) return null;
    const avgEv =
      props.reduce((s, p) => s + Number(p.evPercent || 0), 0) / Math.max(1, props.length);
    return { avgEv, count: props.length, plus: board.data?.plusEvCount ?? props.length };
  }, [props, board.data?.plusEvCount]);

  if (!ready) {
    return (
      <div>
        <PageHeader
          eyebrow="Pricing desk"
          title="+EV Engine"
          description="Compare Seraphim projections against every available market line and surface positive expected value."
        />
        <PickemAppGate />
      </div>
    );
  }

  const loading = board.isLoading && props.length === 0;

  return (
    <div>
      <PageHeader
        eyebrow="Pricing desk"
        title="+EV Engine"
        description={`Projection vs ${app?.name || "pick'em"} / sportsbook lines — model edge, implied probability, and expected value. Threshold ≥ ${threshold}%.`}
        actions={<PickemAppSwitcher />}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {LEAGUES.map((lg) => (
          <button
            key={lg}
            type="button"
            onClick={() => setLeague(lg)}
            className={
              league === lg
                ? "rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-2.5 py-1 text-[11px] font-semibold text-yellow-300"
                : "rounded-lg border border-transparent bg-white/[0.03] px-2.5 py-1 text-[11px] text-neutral-400 hover:border-white/10 hover:text-neutral-200"
            }
          >
            {lg}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
          Sort
        </span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setSort(opt.id)}
            className={
              sort === opt.id
                ? "rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300"
                : "rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px] text-neutral-400 hover:text-neutral-200"
            }
          >
            {opt.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-[11px] text-neutral-400">
          <input
            type="checkbox"
            checked={plusOnly}
            onChange={(e) => setPlusOnly(e.target.checked)}
            className="rounded border-white/20 bg-transparent"
          />
          +EV only (≥{threshold}%)
        </label>
      </div>

      {summary && (
        <div className="mb-4 grid grid-cols-3 gap-2 sm:max-w-lg">
          <div className="rounded-xl border border-white/[0.06] bg-[#0d0d0d] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Qualifying</p>
            <p className="text-lg font-semibold tabular-nums text-white">{summary.plus}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-[#0d0d0d] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Listed</p>
            <p className="text-lg font-semibold tabular-nums text-white">{summary.count}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-[#0d0d0d] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Avg EV</p>
            <p className="text-lg font-semibold tabular-nums text-emerald-300">
              +{summary.avgEv.toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {loading && <CardSkeleton rows={4} />}

      {!loading && props.length === 0 && (
        <EmptyState
          title="No +EV props right now"
          description={`No live ${app?.name || "pick'em"} lines currently clear the ${threshold}% EV threshold for ${league === "All" ? "any league" : league}. Try another app or turn off “+EV only”.`}
        />
      )}

      {props.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0d0d0d]">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="border-b border-[#1a1a1a] bg-white/[0.02] text-[10px] uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Player</th>
                  <th className="px-3 py-2.5 font-medium">Market</th>
                  <th className="px-3 py-2.5 font-medium">Line</th>
                  <th className="px-3 py-2.5 font-medium">Proj</th>
                  <th className="px-3 py-2.5 font-medium">Edge</th>
                  <th className="px-3 py-2.5 font-medium">Model P</th>
                  <th className="px-3 py-2.5 font-medium">Implied</th>
                  <th className="px-3 py-2.5 font-medium">EV</th>
                  <th className="px-3 py-2.5 font-medium">Conf</th>
                  <th className="px-3 py-2.5 font-medium">RS</th>
                  <th className="px-3 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#151515]">
                {props.map((prop) => {
                  const ev = Number(prop.evPercent ?? 0);
                  const edge = Number(prop.modelEdge ?? 0);
                  const modelP = prop.modelProbability;
                  const implied = prop.impliedProbability;
                  return (
                    <tr
                      key={prop.id}
                      className={
                        prop.isPlusEv
                          ? "bg-emerald-500/[0.03] transition hover:bg-emerald-500/[0.05]"
                          : "transition hover:bg-white/[0.02]"
                      }
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <LeagueBadge league={prop.league as LeagueCode} />
                          <div>
                            <p className="font-medium text-neutral-100">{prop.player}</p>
                            <p className="text-[11px] text-neutral-500">
                              {prop.team} vs {prop.opponent}
                              {prop.bestEvBook ? ` · ${prop.bestEvBook}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-neutral-300">{prop.market}</td>
                      <td className="px-3 py-3 tabular-nums text-neutral-200">
                        {prop.bestEvSide || prop.side} {prop.bestEvLine ?? prop.line}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-neutral-300">
                        {prop.projectedValue != null ? Number(prop.projectedValue).toFixed(1) : "—"}
                      </td>
                      <td
                        className={`px-3 py-3 tabular-nums font-semibold ${
                          edge >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {edge > 0 ? "+" : ""}
                        {edge.toFixed(1)}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-neutral-300">
                        {modelP != null ? `${(Number(modelP) * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-neutral-400">
                        {implied != null ? `${(Number(implied) * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <EvPlusBadge ev={ev} compact />
                      </td>
                      <td className="px-3 py-3">
                        <ConfidenceBadge score={Number(prop.confidence ?? 50)} size="sm" />
                      </td>
                      <td className="px-3 py-3">
                        <ResearchScoreBadge score={Number(prop.researchScore ?? 50)} size="sm" />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link
                          href={propResearchPath(prop.id)}
                          className="text-xs text-yellow-400 hover:underline"
                        >
                          Report
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {board.data?.disclaimer && (
            <p className="border-t border-[#1a1a1a] px-3 py-2 text-[10px] text-neutral-600">
              {board.data.disclaimer}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
