import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { LeagueBadge } from "@/components/shared/LeagueBadge";
import { CardSkeleton } from "@/components/shared/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatAmericanOdds } from "@/data/propsCatalog";
import { propResearchPath } from "@/lib/playerLinks";
import { cn } from "@/lib/utils";
import type { LeagueCode } from "@/data/mock";

type ArbAllocation = {
  over: { book: string; side: string; american: number; stake: number };
  under: { book: string; side: string; american: number; stake: number };
};

type ArbDetail = {
  line: number;
  overBook: string;
  underBook: string;
  overAmerican: number;
  underAmerican: number;
  profitPct: number;
  totalStake: number;
  stakeOver: number;
  stakeUnder: number;
  expectedReturn: number;
  profit: number;
  stakeAllocation: ArbAllocation;
  linesUpdatedAt?: string | null;
  sumImplied: number;
};

type ArbOpportunity = {
  id: string;
  propId: string;
  league: LeagueCode | string;
  player: string;
  team?: string;
  opponent?: string;
  market: string;
  booksScanned?: string[];
  arbitrage: ArbDetail;
  profitPct: number;
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

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const secs = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return new Date(t).toLocaleString();
}

export default function ArbitragePage() {
  const [league, setLeague] = useState<(typeof LEAGUES)[number]>("All");
  const [totalStake, setTotalStake] = useState(100);
  const [minProfit, setMinProfit] = useState(0);

  const board = useQuery({
    queryKey: ["arbitrage-board", league, totalStake, minProfit],
    queryFn: async () => {
      const qs = new URLSearchParams({
        totalStake: String(totalStake),
        minProfitPct: String(minProfit),
        limit: "40",
      });
      if (league !== "All") qs.set("league", league);
      const res = await fetch(`/api/arbitrage?${qs}`);
      if (!res.ok) throw new Error("arbitrage");
      return res.json() as Promise<{
        ok: boolean;
        generatedAt?: string;
        refreshSeconds?: number;
        scannedProps?: number;
        count: number;
        opportunities: ArbOpportunity[];
        disclaimer?: string;
      }>;
    },
    staleTime: 60_000,
    refetchInterval: 300_000,
  });

  const rows = board.data?.opportunities ?? [];
  const refreshSec = board.data?.refreshSeconds ?? 300;

  const summary = useMemo(() => {
    if (!rows.length) return null;
    const best = Math.max(...rows.map((r) => Number(r.profitPct || 0)));
    const avg =
      rows.reduce((s, r) => s + Number(r.profitPct || 0), 0) / Math.max(1, rows.length);
    return { best, avg, count: rows.length };
  }, [rows]);

  const loading = board.isLoading && rows.length === 0;
  const lastScan = board.dataUpdatedAt
    ? formatRelative(new Date(board.dataUpdatedAt).toISOString())
    : "—";

  return (
    <div>
      <PageHeader
        eyebrow="Pricing desk"
        title="Arbitrage Finder"
        description={`Scan connected sportsbooks for guaranteed Over/Under arbs. Auto-refreshes every ${Math.round(refreshSec / 60)} minutes as lines update.`}
        actions={
          <button
            type="button"
            onClick={() => board.refetch()}
            className="rounded-xl border border-white/[0.08] bg-[#111] px-3 py-2 text-sm text-neutral-300 transition hover:border-yellow-500/30 hover:text-yellow-400"
          >
            Refresh now
          </button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
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

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-[11px] text-neutral-400">
          Total stake ($)
          <input
            type="number"
            min={1}
            step={10}
            value={totalStake}
            onChange={(e) => setTotalStake(Math.max(1, Number(e.target.value) || 100))}
            className="mt-1 block w-28 rounded-lg border border-white/[0.08] bg-[#111] px-2 py-1.5 text-sm tabular-nums text-white"
          />
        </label>
        <label className="text-[11px] text-neutral-400">
          Min profit %
          <input
            type="number"
            min={0}
            step={0.1}
            value={minProfit}
            onChange={(e) => setMinProfit(Math.max(0, Number(e.target.value) || 0))}
            className="mt-1 block w-28 rounded-lg border border-white/[0.08] bg-[#111] px-2 py-1.5 text-sm tabular-nums text-white"
          />
        </label>
        <p className="ml-auto text-[11px] tabular-nums text-neutral-500">
          Scanned {board.data?.scannedProps ?? "—"} props · Updated {lastScan}
          {board.isFetching ? " · refreshing…" : ""}
        </p>
      </div>

      {summary && (
        <div className="mb-4 grid grid-cols-3 gap-2 sm:max-w-lg">
          <div className="rounded-xl border border-white/[0.06] bg-[#0d0d0d] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Arbs</p>
            <p className="text-lg font-semibold tabular-nums text-white">{summary.count}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-[#0d0d0d] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Best</p>
            <p className="text-lg font-semibold tabular-nums text-emerald-300">
              +{summary.best.toFixed(2)}%
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-[#0d0d0d] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Avg</p>
            <p className="text-lg font-semibold tabular-nums text-emerald-300/80">
              +{summary.avg.toFixed(2)}%
            </p>
          </div>
        </div>
      )}

      {loading && <CardSkeleton rows={3} />}

      {!loading && rows.length === 0 && (
        <EmptyState
          title="No arbitrage opportunities right now"
          description={`No guaranteed Over/Under arbs among connected sportsbooks for ${league === "All" ? "any league" : league}. Pick'em apps are excluded. Lines refresh automatically.`}
        />
      )}

      <div className="space-y-3">
        {rows.map((row) => {
          const arb = row.arbitrage;
          const alloc = arb.stakeAllocation;
          return (
            <article
              key={`${row.propId}-${arb.overBook}-${arb.underBook}-${arb.line}`}
              className="overflow-hidden rounded-xl border border-emerald-500/20 bg-[#0d0d0d]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.04] px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <LeagueBadge league={row.league as LeagueCode} />
                    <h2 className="text-sm font-semibold text-white">{row.player}</h2>
                    <span className="rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                      Arb +{Number(arb.profitPct).toFixed(2)}%
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-neutral-400">
                    {row.market} · line {arb.line} · {row.team} vs {row.opponent}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Expected return
                  </p>
                  <p className="text-xl font-semibold tabular-nums text-white">
                    ${Number(arb.expectedReturn).toFixed(2)}
                  </p>
                  <p className="text-[11px] tabular-nums text-emerald-300">
                    Profit ${Number(arb.profit).toFixed(2)} on ${Number(arb.totalStake).toFixed(0)}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
                    Over · {alloc.over.book}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                    {formatAmericanOdds(alloc.over.american)}
                  </p>
                  <p className="mt-1 text-[12px] text-neutral-400">
                    Stake{" "}
                    <span className="font-semibold tabular-nums text-neutral-100">
                      ${Number(alloc.over.stake).toFixed(2)}
                    </span>
                  </p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400/90">
                    Under · {alloc.under.book}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                    {formatAmericanOdds(alloc.under.american)}
                  </p>
                  <p className="mt-1 text-[12px] text-neutral-400">
                    Stake{" "}
                    <span className="font-semibold tabular-nums text-neutral-100">
                      ${Number(alloc.under.stake).toFixed(2)}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.04] px-4 py-2.5 text-[11px] text-neutral-500">
                <p>
                  Implied sum {(Number(arb.sumImplied) * 100).toFixed(2)}% · Lines updated{" "}
                  {formatRelative(arb.linesUpdatedAt)}
                  {row.booksScanned?.length
                    ? ` · ${row.booksScanned.length} books scanned`
                    : ""}
                </p>
                <Link
                  href={propResearchPath(row.propId)}
                  className={cn("text-yellow-400 hover:underline")}
                >
                  Open report
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      {board.data?.disclaimer && rows.length > 0 && (
        <p className="mt-4 text-[10px] text-neutral-600">{board.data.disclaimer}</p>
      )}
    </div>
  );
}
