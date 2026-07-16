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
      <div className="flex min-w-max items-center gap-1.5">
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
                "group flex items-center gap-1.5 rounded-lg border px-2 py-1 transition",
                active
                  ? "border-white/20 bg-white/[0.08]"
                  : "border-transparent bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.05]",
                pending && !active && "opacity-70",
              )}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[9px] font-bold tracking-wide text-black"
                style={{ backgroundColor: accent }}
              >
                {spec?.mark ?? b.book.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-left">
                <span className={cn("block text-[11px] font-semibold", active ? "text-white" : "text-neutral-300")}>
                  {b.book}
                </span>
                <span className="block text-[9px] tabular-nums text-neutral-500">
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
      className="rounded-xl border border-white/[0.06] bg-[#0d0d0d] p-3 sm:p-4"
      data-feature="line-comparison"
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">Market comparison</h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            Proj {projected.toFixed(1)} · lean{" "}
            <span className={modelSide === "Over" ? "text-emerald-400" : "text-red-400"}>{modelSide}</span>
          </p>
        </div>
      </div>

      <SportsbookAppSwitcher rows={rows} selectedBook={selectedBook} onSelectBook={onSelectBook} />

      {/* Full table — no inner scroll so every operator is visible */}
      <div className="mt-2 overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="min-w-[560px] w-full text-left text-[11px]">
          <thead className="bg-[#111] text-[10px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-2 py-1 font-medium">Operator</th>
              <th className="px-2 py-1 font-medium">Line</th>
              <th className="px-2 py-1 font-medium">Over</th>
              <th className="px-2 py-1 font-medium">Under</th>
              <th className="px-2 py-1 font-medium">Edge</th>
              <th className="px-2 py-1 font-medium">Source</th>
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
                  <td className="px-2 py-1">
                    <button
                      type="button"
                      className="text-left font-medium text-neutral-100 hover:text-yellow-400"
                      onClick={() => onSelectBook(row.book)}
                    >
                      {row.book}
                      {isBest && (
                        <span className="ml-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-1 py-0.5 text-[9px] font-semibold uppercase text-emerald-300">
                          Best
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="px-2 py-1 tabular-nums text-neutral-200">
                    {unavailable ? "—" : row.line}
                  </td>
                  <td className="px-2 py-1 tabular-nums text-neutral-400">
                    {unavailable || row.kind === "pickem" ? "—" : formatAmericanOdds(row.over)}
                  </td>
                  <td className="px-2 py-1 tabular-nums text-neutral-400">
                    {unavailable || row.kind === "pickem" ? "—" : formatAmericanOdds(row.under)}
                  </td>
                  <td
                    className={cn(
                      "px-2 py-1 tabular-nums font-semibold",
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
                  <td className="px-2 py-1 text-[10px] text-neutral-500">
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
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-black"
              style={{ backgroundColor: spec?.accent ?? "#737373" }}
            >
              {spec?.mark ?? active.book.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">{active.book}</p>
              <p className="truncate text-[10px] text-neutral-500">
                {pending
                  ? active.integrationNote || "Unavailable"
                  : active.isBestValue
                    ? "Best value among connected books"
                    : `${active.kind === "pickem" ? "Pick'em" : "Book"} · ${sourceLabel(active.sourceProvider)}`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              {selectedSide} line
            </p>
            <p className="text-xl font-semibold tabular-nums text-white">
              {pending ? "—" : active.line}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
