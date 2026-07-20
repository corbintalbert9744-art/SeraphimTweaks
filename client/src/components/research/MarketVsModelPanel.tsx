/**
 * Market vs Model — proprietary projection against every connected book.
 * Unavailable operators stay marked Unavailable; never invent lines.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { leanTextClass } from "@/lib/leanTheme";
import { propResearchPath } from "@/lib/playerLinks";
import { LineComparison, mergeLineComparison } from "@/components/shared/LineComparison";
import { LineMovementChart } from "@/components/research/LineMovementChart";
import type { BookQuote } from "@/data/propsCatalog";

export type MarketVsModelSummary = {
  projectedValue: number;
  marketLine: number;
  modelEdge: number;
  overProbability: number | null;
  underProbability: number | null;
  confidence: number | null;
  researchScore: number | null;
  evPercent: number | null;
  bestLine: number | null;
  bestLineBook: string | null;
  linesUpdatedAt: string | null;
  connectedCount: number;
  modelSide: "Over" | "Under";
};

type ComparisonPayload = {
  books?: BookQuote[];
  lines?: BookQuote[];
  projectedValue?: number;
  baselineLine?: number;
  consensusLine?: number | null;
  bestLine?: number | null;
  bestLineBook?: string | null;
  linesUpdatedAt?: string | null;
  connectedCount?: number;
  modelSide?: string;
  bestEvPercent?: number | null;
  movement?: Array<{ label: string; line: number; odds?: number }>;
};

function formatUpdated(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const secs = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return new Date(t).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const v = n <= 1 ? n * 100 : n;
  return `${v.toFixed(1)}%`;
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "emerald" | "red" | "yellow" | "neutral";
}) {
  return (
    <div className="rounded-xl border border-[#1f1f1f] bg-black/30 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums tracking-tight",
          accent === "emerald" && "text-emerald-300",
          accent === "red" && "text-red-300",
          accent === "yellow" && "text-yellow-300",
          (!accent || accent === "neutral") && "text-white",
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[10px] text-neutral-500">{sub}</p> : null}
    </div>
  );
}

export function summarizeMarketVsModel(opts: {
  projected: number;
  line: number;
  side: "Over" | "Under";
  overProbability?: number | null;
  underProbability?: number | null;
  confidence?: number | null;
  researchScore?: number | null;
  evPercent?: number | null;
  books?: BookQuote[];
  bestLine?: number | null;
  bestLineBook?: string | null;
  linesUpdatedAt?: string | null;
  connectedCount?: number;
}): MarketVsModelSummary {
  // Model Edge = projection − market line (signed gap; not side-flipped).
  const edge = opts.projected - opts.line;
  const connected = (opts.books ?? []).filter((b) => !b.requiresIntegration && !b.isMock);
  return {
    projectedValue: opts.projected,
    marketLine: opts.line,
    modelEdge: Number(edge.toFixed(2)),
    overProbability: opts.overProbability ?? null,
    underProbability: opts.underProbability ?? null,
    confidence: opts.confidence ?? null,
    researchScore: opts.researchScore ?? null,
    evPercent: opts.evPercent ?? null,
    bestLine: opts.bestLine ?? null,
    bestLineBook: opts.bestLineBook ?? null,
    linesUpdatedAt: opts.linesUpdatedAt ?? null,
    connectedCount: opts.connectedCount ?? connected.length,
    modelSide: opts.side,
  };
}

/** Compact metrics strip — use on every prop surface. */
export function MarketVsModelMetrics({
  summary,
  className,
}: {
  summary: MarketVsModelSummary;
  className?: string;
}) {
  const edgeAccent = summary.modelEdge >= 0 ? "emerald" : "red";
  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5", className)} data-feature="market-vs-model">
      <Stat label="Our projection" value={summary.projectedValue.toFixed(1)} sub="Seraphim model" accent="yellow" />
      <Stat
        label="Model edge"
        value={`${summary.modelEdge > 0 ? "+" : ""}${summary.modelEdge.toFixed(1)}`}
        sub={`vs line ${summary.marketLine}`}
        accent={edgeAccent}
      />
      <Stat label="P(Over)" value={pct(summary.overProbability)} accent="emerald" />
      <Stat label="P(Under)" value={pct(summary.underProbability)} accent="red" />
      <Stat
        label="Confidence"
        value={summary.confidence != null ? `${Math.round(summary.confidence)}` : "—"}
        sub="model certainty"
      />
      <Stat
        label="Research score"
        value={summary.researchScore != null ? `${Math.round(summary.researchScore)}` : "—"}
        sub="checklist-backed"
      />
      <Stat
        label="Expected value"
        value={
          summary.evPercent != null && Number.isFinite(summary.evPercent)
            ? `${summary.evPercent >= 0 ? "+" : ""}${summary.evPercent.toFixed(1)}%`
            : "—"
        }
        accent={summary.evPercent != null && summary.evPercent >= 0 ? "emerald" : "neutral"}
      />
      <Stat
        label="Best line"
        value={summary.bestLine != null ? String(summary.bestLine) : "—"}
        sub={
          summary.bestLineBook
            ? summary.bestLineBook
            : summary.connectedCount
              ? `${summary.connectedCount} connected`
              : "No live books"
        }
      />
      <Stat label="Last updated" value={formatUpdated(summary.linesUpdatedAt)} sub="line capture" />
    </div>
  );
}

/** Full panel: metrics + multi-book comparison (+ optional movement). */
export function MarketVsModelPanel({
  propId,
  projected,
  line,
  side,
  overProbability,
  underProbability,
  confidence,
  researchScore,
  evPercent,
  books: booksProp,
  movement,
  linesUpdatedAt: linesUpdatedAtProp,
  bestLine: bestLineProp,
  bestLineBook: bestLineBookProp,
  connectedCount: connectedCountProp,
  selectedBook: selectedBookProp,
  onSelectBook,
  selectedSide: selectedSideProp,
  onSelectSide,
  showComparison = true,
  showMovement = false,
  compact = false,
  className,
}: {
  propId?: string;
  projected: number;
  line: number;
  side: "Over" | "Under";
  overProbability?: number | null;
  underProbability?: number | null;
  confidence?: number | null;
  researchScore?: number | null;
  evPercent?: number | null;
  books?: BookQuote[];
  movement?: Array<{ label: string; line: number; odds?: number }>;
  linesUpdatedAt?: string | null;
  bestLine?: number | null;
  bestLineBook?: string | null;
  connectedCount?: number;
  selectedBook?: string | null;
  onSelectBook?: (book: string | null) => void;
  selectedSide?: "Over" | "Under";
  onSelectSide?: (side: "Over" | "Under") => void;
  showComparison?: boolean;
  showMovement?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const [internalBook, setInternalBook] = useState<string | null>(null);
  const [internalSide, setInternalSide] = useState<"Over" | "Under">(side);
  const selectedBook = selectedBookProp !== undefined ? selectedBookProp : internalBook;
  const setSelectedBook = onSelectBook ?? setInternalBook;
  const selectedSide = selectedSideProp ?? internalSide;
  const setSelectedSide = onSelectSide ?? setInternalSide;

  const live = useQuery({
    queryKey: ["odds-comparison", propId],
    enabled: Boolean(propId) && (!booksProp || booksProp.length === 0),
    queryFn: async () => {
      const res = await fetch(`/api/odds/comparison/${encodeURIComponent(propId!)}`);
      if (!res.ok) throw new Error("comparison");
      return res.json() as Promise<ComparisonPayload>;
    },
    staleTime: 60_000,
    retry: 1,
  });

  const books = booksProp?.length
    ? booksProp
    : (live.data?.books ?? live.data?.lines ?? []);
  const linesUpdatedAt = linesUpdatedAtProp ?? live.data?.linesUpdatedAt ?? null;
  const bestLine = bestLineProp ?? live.data?.bestLine ?? null;
  const bestLineBook = bestLineBookProp ?? live.data?.bestLineBook ?? null;
  const connectedCount =
    connectedCountProp ??
    live.data?.connectedCount ??
    books.filter((b) => !b.requiresIntegration && !b.isMock).length;

  const summary = useMemo(
    () =>
      summarizeMarketVsModel({
        projected,
        line: live.data?.consensusLine ?? live.data?.baselineLine ?? line,
        side,
        overProbability,
        underProbability,
        confidence,
        researchScore,
        evPercent: evPercent ?? live.data?.bestEvPercent ?? null,
        books,
        bestLine,
        bestLineBook,
        linesUpdatedAt,
        connectedCount,
      }),
    [
      projected,
      line,
      side,
      overProbability,
      underProbability,
      confidence,
      researchScore,
      evPercent,
      books,
      bestLine,
      bestLineBook,
      linesUpdatedAt,
      connectedCount,
      live.data?.consensusLine,
      live.data?.baselineLine,
      live.data?.bestEvPercent,
    ],
  );

  const consensus = live.data?.consensusLine ?? line;
  const rows = mergeLineComparison(books, {
    projected,
    modelSide: side,
    consensusLine: consensus,
  });

  return (
    <section
      className={cn(
        "rounded-2xl border border-[#1a1a1a] bg-[#0c0c0c]",
        compact ? "p-3" : "p-4 sm:p-5",
        className,
      )}
      data-feature="market-vs-model-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-yellow-500/90">
            Market vs model
          </p>
          <h2 className="mt-1 text-sm font-semibold text-white sm:text-base">
            Projection · live books · edge
          </h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            Connected books only. Unavailable providers stay blank — never fabricated.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["Over", "Under"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSelectedSide(s)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition",
                selectedSide === s
                  ? s === "Over"
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                    : "border-red-500/40 bg-red-500/15 text-red-300"
                  : "border-[#222] text-neutral-500 hover:text-neutral-300",
              )}
            >
              {s}
            </button>
          ))}
          {propId ? (
            <Link
              href={propResearchPath(propId)}
              className="rounded-lg border border-yellow-500/30 px-2.5 py-1 text-[11px] font-semibold text-yellow-400 hover:bg-yellow-500/10"
            >
              Full report →
            </Link>
          ) : null}
        </div>
      </div>

      <MarketVsModelMetrics summary={{ ...summary, modelSide: selectedSide }} className="mt-4" />

      {live.isLoading && !booksProp?.length ? (
        <p className="mt-3 text-xs text-neutral-500">Loading live books…</p>
      ) : null}
      {live.isError && !booksProp?.length ? (
        <p className="mt-3 text-xs text-amber-300/90">
          Live comparison unavailable — showing model metrics only.
        </p>
      ) : null}

      {showComparison ? (
        <div className="mt-4">
          <LineComparison
            books={books}
            projected={projected}
            modelSide={side}
            consensusLine={consensus}
            selectedSide={selectedSide}
            selectedBook={selectedBook}
            onSelectBook={setSelectedBook}
            linesUpdatedAt={linesUpdatedAt}
          />
        </div>
      ) : (
        <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
          {rows.slice(0, 8).map((r) => {
            const pending = Boolean(r.requiresIntegration || r.placeholder);
            return (
              <li
                key={r.slug || r.book}
                className="flex items-center justify-between rounded-lg border border-[#1f1f1f] bg-black/25 px-3 py-2 text-xs"
              >
                <span className="text-neutral-300">{r.book}</span>
                <span className={cn("tabular-nums", pending ? "text-neutral-600" : leanTextClass(side))}>
                  {pending ? "Unavailable" : r.line}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {showMovement ? (
        <div className="mt-4 border-t border-[#1a1a1a] pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Live line movement
          </p>
          <div className="mt-2">
            <LineMovementChart points={movement ?? []} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
