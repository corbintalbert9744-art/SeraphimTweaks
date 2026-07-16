import { formatAmericanOdds, type BookQuote } from "@/data/propsCatalog";
import { CANONICAL_LINE_PROVIDERS, providerSpecByName } from "@/data/lineProviders";
import { cn } from "@/lib/utils";

export type LineComparisonRow = BookQuote & {
  placeholder?: boolean;
};

/** Merge API books with the canonical operators; fill unavailable when missing. */
export function mergeLineComparison(
  books: BookQuote[],
  opts: { projected: number; modelSide: "Over" | "Under"; consensusLine: number },
): LineComparisonRow[] {
  const bySlug = new Map<string, BookQuote>();
  const byName = new Map<string, BookQuote>();
  for (const b of books) {
    if (b.slug) bySlug.set(b.slug.toLowerCase(), b);
    byName.set(b.book.toLowerCase(), b);
  }

  const rows: LineComparisonRow[] = CANONICAL_LINE_PROVIDERS.map((spec) => {
    const hit =
      bySlug.get(spec.slug) ??
      byName.get(spec.name.toLowerCase()) ??
      books.find((b) => (b.slug || "").toLowerCase().replace(/[\s_-]/g, "") === spec.slug);
    if (hit) {
      return {
        ...hit,
        book: hit.book || spec.name,
        slug: hit.slug || spec.slug,
        kind: hit.kind || spec.kind,
        requiresIntegration: hit.requiresIntegration ?? hit.isMock ?? false,
        integrationNote:
          hit.integrationNote ??
          (hit.requiresIntegration || hit.isMock ? spec.notes : null),
        sourceProvider: hit.sourceProvider ?? hit.provider ?? null,
      };
    }
    const edge =
      opts.modelSide === "Over"
        ? opts.projected - opts.consensusLine
        : opts.consensusLine - opts.projected;
    return {
      book: spec.name,
      slug: spec.slug,
      kind: spec.kind,
      line: opts.consensusLine,
      over: -110,
      under: -110,
      isMock: true,
      connected: false,
      requiresIntegration: true,
      integrationNote: spec.notes,
      edgeVsProjection: Number(edge.toFixed(2)),
      projectedValue: opts.projected,
      modelSide: opts.modelSide,
      placeholder: true,
      sourceProvider: null,
    };
  });

  return rows.sort((a, b) => {
    const aPend = a.requiresIntegration ? 1 : 0;
    const bPend = b.requiresIntegration ? 1 : 0;
    if (aPend !== bPend) return aPend - bPend;
    return (b.edgeVsProjection ?? 0) - (a.edgeVsProjection ?? 0);
  });
}

/** Horizontal betting-app switcher — pick which book’s line you’re comparing. */
export function SportsbookAppSwitcher({
  rows,
  selectedBook,
  onSelectBook,
}: {
  rows: LineComparisonRow[];
  selectedBook: string | null;
  onSelectBook: (book: string) => void;
}) {
  const best = rows.find((r) => r.isBestValue && !r.requiresIntegration) ?? rows.find((r) => !r.requiresIntegration);
  const activeName = selectedBook ?? best?.book ?? rows[0]?.book;

  return (
    <div className="overflow-x-auto pb-1" data-feature="sportsbook-switcher">
      <div className="flex min-w-max items-center gap-3">
        {rows.map((b) => {
          const spec = providerSpecByName(b.book) ?? CANONICAL_LINE_PROVIDERS.find((p) => p.slug === b.slug);
          const active = activeName === b.book;
          const pending = Boolean(b.requiresIntegration || b.placeholder);
          const accent = spec?.accent ?? "#737373";
          return (
            <button
              key={b.slug || b.book}
              type="button"
              onClick={() => onSelectBook(b.book)}
              title={pending ? b.integrationNote || "Unavailable" : b.book}
              className={cn(
                "group flex items-center gap-3 rounded-2xl border px-4 py-3 transition",
                active
                  ? "border-white/20 bg-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
                  : "border-transparent bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.05]",
                pending && !active && "opacity-70",
              )}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold tracking-wide text-black"
                style={{ backgroundColor: accent }}
              >
                {spec?.mark ?? b.book.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-left">
                <span className={cn("block text-sm font-semibold", active ? "text-white" : "text-neutral-300")}>
                  {b.book}
                </span>
                <span className="mt-0.5 block text-[11px] tabular-nums text-neutral-500">
                  {pending ? "Unavailable" : `Line ${b.line}`}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function sourceLabel(source: string | null | undefined): string {
  if (!source) return "—";
  const map: Record<string, string> = {
    propline: "PropLine",
    sharpapi: "SharpAPI",
    "the-odds-api": "The Odds API",
    antelytics: "Antelytics",
    "line-aggregator": "Aggregator",
  };
  return map[source] ?? source;
}

export function LineComparison({
  books,
  projected,
  modelSide,
  consensusLine,
  selectedSide,
  selectedBook,
  onSelectBook,
}: {
  books: BookQuote[];
  projected: number;
  modelSide: "Over" | "Under";
  consensusLine: number;
  selectedSide: "Over" | "Under";
  selectedBook: string | null;
  onSelectBook: (book: string) => void;
}) {
  const rows = mergeLineComparison(books, { projected, modelSide, consensusLine });
  const best = rows.find((r) => r.isBestValue && !r.requiresIntegration) ?? rows.find((r) => !r.requiresIntegration);
  const activeName = selectedBook ?? best?.book ?? rows[0]?.book;
  const active = rows.find((r) => r.book === activeName) ?? rows[0];
  const odds = active ? (selectedSide === "Over" ? active.over : active.under) : -110;
  const pending = Boolean(active?.requiresIntegration || active?.placeholder);
  const spec = active ? providerSpecByName(active.book) : undefined;

  return (
    <section
      className="rounded-3xl border border-white/[0.06] bg-[#0d0d0d] p-6 sm:p-8"
      data-feature="line-comparison"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Market comparison</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Lines from every connected provider vs our projection ({projected.toFixed(1)}). Best value
            highlighted.
          </p>
        </div>
        <p className="text-xs text-neutral-600">
          Lean{" "}
          <span className={modelSide === "Over" ? "text-emerald-400" : "text-red-400"}>{modelSide}</span>
        </p>
      </div>

      <SportsbookAppSwitcher rows={rows} selectedBook={selectedBook} onSelectBook={onSelectBook} />

      {/* Full comparison table — source attributed per row */}
      <div className="mt-8 overflow-x-auto rounded-2xl border border-white/[0.06]">
        <table className="min-w-[720px] w-full text-left text-sm">
          <thead className="bg-white/[0.02] text-[11px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Operator</th>
              <th className="px-4 py-3 font-medium">Line</th>
              <th className="px-4 py-3 font-medium">Over</th>
              <th className="px-4 py-3 font-medium">Under</th>
              <th className="px-4 py-3 font-medium">Edge</th>
              <th className="px-4 py-3 font-medium">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map((row) => {
              const unavailable = Boolean(row.requiresIntegration || row.placeholder);
              const isBest = Boolean(row.isBestValue && !unavailable);
              return (
                <tr
                  key={row.slug || row.book}
                  className={cn(
                    "transition",
                    isBest && "bg-emerald-500/[0.06]",
                    activeName === row.book && !isBest && "bg-white/[0.02]",
                  )}
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-left font-medium text-neutral-100 hover:text-yellow-400"
                      onClick={() => onSelectBook(row.book)}
                    >
                      {row.book}
                      {isBest && (
                        <span className="ml-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
                          Best
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-neutral-200">
                    {unavailable ? "—" : row.line}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-neutral-400">
                    {unavailable || row.kind === "pickem" ? "—" : formatAmericanOdds(row.over)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-neutral-400">
                    {unavailable || row.kind === "pickem" ? "—" : formatAmericanOdds(row.under)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 tabular-nums font-semibold",
                      unavailable
                        ? "text-neutral-600"
                        : (row.edgeVsProjection ?? 0) >= 0
                          ? "text-emerald-400"
                          : "text-red-400",
                    )}
                  >
                    {unavailable
                      ? "—"
                      : `${(row.edgeVsProjection ?? 0) > 0 ? "+" : ""}${(row.edgeVsProjection ?? 0).toFixed(1)}`}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500">
                    {unavailable ? (
                      <span className="text-amber-300/80" title={row.integrationNote || undefined}>
                        Unavailable
                      </span>
                    ) : (
                      sourceLabel(row.sourceProvider)
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {active && (
        <div className="mt-8 grid gap-6 border-t border-white/[0.06] pt-8 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex items-start gap-4">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-black"
              style={{ backgroundColor: spec?.accent ?? "#737373" }}
            >
              {spec?.mark ?? active.book.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <p className="text-base font-semibold text-white">{active.book}</p>
              <p className="mt-1 text-sm text-neutral-500">
                {pending
                  ? active.integrationNote || "Unavailable from configured providers"
                  : active.isBestValue
                    ? "Best value among connected books"
                    : `${active.kind === "pickem" ? "Pick'em" : "Sportsbook"} · via ${sourceLabel(active.sourceProvider)}`}
              </p>
              <p className="mt-3 text-sm text-neutral-400">
                Model edge{" "}
                <span className="tabular-nums text-neutral-200">
                  {(active.edgeVsProjection ?? 0) > 0 ? "+" : ""}
                  {(active.edgeVsProjection ?? 0).toFixed(1)}
                </span>
                {" · "}projection {projected.toFixed(1)} − line {active.line}
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              {selectedSide} line
            </p>
            <p className="mt-1 text-4xl font-semibold tabular-nums text-white">
              {pending ? "—" : active.line}
            </p>
            {active.kind !== "pickem" && !pending && (
              <p className="mt-1 text-sm tabular-nums text-neutral-400">{formatAmericanOdds(odds)}</p>
            )}
            {pending && (
              <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-amber-300/90">
                Data unavailable
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
