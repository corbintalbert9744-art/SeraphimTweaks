import { formatAmericanOdds, type BookQuote } from "@/data/propsCatalog";
import { CANONICAL_LINE_PROVIDERS } from "@/data/lineProviders";
import { cn } from "@/lib/utils";

export type LineComparisonRow = BookQuote & {
  placeholder?: boolean;
};

/** Merge API books with the canonical 8 operators; fill placeholders when missing. */
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
        integrationNote: hit.integrationNote ?? (hit.requiresIntegration || hit.isMock ? spec.notes : null),
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
    };
  });

  // Rank: connected first by edge, then placeholders
  return rows.sort((a, b) => {
    const aPend = a.requiresIntegration ? 1 : 0;
    const bPend = b.requiresIntegration ? 1 : 0;
    if (aPend !== bPend) return aPend - bPend;
    return (b.edgeVsProjection ?? 0) - (a.edgeVsProjection ?? 0);
  });
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

  return (
    <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5" data-feature="line-comparison">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">Line Comparison</h2>
        <p className="text-[11px] text-neutral-500">Our projection vs supported operators</p>
      </div>
      <p className="mb-4 text-xs text-neutral-500">
        Projection <span className="tabular-nums text-neutral-300">{projected.toFixed(1)}</span>
        {" · "}
        lean <span className="text-yellow-400">{modelSide}</span>
        {" · "}
        best available line highlighted when a provider is connected. Unconnected operators show
        placeholders marked Requires integration.
      </p>

      <ul className="space-y-2">
        {rows.map((b) => {
          const active = activeName === b.book;
          const odds = selectedSide === "Over" ? b.over : b.under;
          const pending = Boolean(b.requiresIntegration || b.placeholder);
          return (
            <li key={b.slug || b.book}>
              <button
                type="button"
                onClick={() => onSelectBook(b.book)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left text-sm transition",
                  active
                    ? "border-yellow-500/40 bg-yellow-500/10"
                    : "border-[#1a1a1a] bg-black/20 hover:border-neutral-700",
                  pending && "opacity-90",
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-neutral-100">{b.book}</span>
                    <span className="rounded border border-[#222] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-neutral-500">
                      {b.kind === "pickem" ? "Pick'em" : "Sportsbook"}
                    </span>
                    {b.isBestValue && !pending && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                        Best Value
                      </span>
                    )}
                    {pending && (
                      <span className="rounded border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
                        Requires integration
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    {pending ? (
                      <>
                        Placeholder vs projection{" "}
                        <span className="tabular-nums text-neutral-400">
                          {(b.edgeVsProjection ?? 0) > 0 ? "+" : ""}
                          {(b.edgeVsProjection ?? 0).toFixed(1)}
                        </span>
                        {b.integrationNote ? ` · ${b.integrationNote}` : ""}
                      </>
                    ) : (
                      <>
                        Edge vs projection{" "}
                        <span className="tabular-nums text-neutral-300">
                          {(b.edgeVsProjection ?? 0) > 0 ? "+" : ""}
                          {(b.edgeVsProjection ?? 0).toFixed(1)}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold tabular-nums text-white">{b.line}</p>
                  {b.kind !== "pickem" && (
                    <p className="text-xs tabular-nums text-neutral-400">{formatAmericanOdds(odds)}</p>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
