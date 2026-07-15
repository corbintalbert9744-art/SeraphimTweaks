import { useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import { mockNbaProps, formatAmericanOdds } from "@/data/nbaMock";
import { cn } from "@/lib/utils";

type SortKey = "l10" | "ev" | "line";

function parseHit(value: string) {
  const [h, n] = value.split("/").map(Number);
  if (!n) return 0;
  return Math.round((h / n) * 100);
}

export function WorkflowDemo() {
  const [sort, setSort] = useState<SortKey>("l10");
  const [selectedId, setSelectedId] = useState(mockNbaProps[0]?.id ?? "");
  const [picks, setPicks] = useState<string[]>([]);

  const rows = useMemo(() => {
    const list = [...mockNbaProps].slice(0, 8);
    list.sort((a, b) => {
      if (sort === "ev") return b.evPercent - a.evPercent;
      if (sort === "line") return a.line - b.line;
      return parseHit(b.l10) - parseHit(a.l10);
    });
    return list;
  }, [sort]);

  const selected = rows.find((r) => r.id === selectedId) ?? rows[0];

  function togglePick(id: string) {
    setPicks((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 4)));
    setSelectedId(id);
  }

  const avgL10 =
    picks.length === 0
      ? 0
      : Math.round(
          picks.reduce((sum, id) => {
            const p = mockNbaProps.find((r) => r.id === id);
            return sum + (p ? parseHit(p.l10) : 0);
          }, 0) / picks.length,
        );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section className="rounded-2xl border border-[#222] bg-[#0c0c0c] p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Sort
          </span>
          {(
            [
              { key: "l10" as const, label: "Last 10" },
              { key: "ev" as const, label: "EV+" },
              { key: "line" as const, label: "Line" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSort(opt.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                sort === opt.key
                  ? "border-yellow-400/60 bg-yellow-400/15 text-yellow-300"
                  : "border-[#2a2a2a] text-neutral-400 hover:text-white",
              )}
            >
              {opt.label}
            </button>
          ))}
          <span className="ml-auto hidden text-xs text-neutral-500 sm:inline">NBA Props Lab</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[640px] w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="pb-3 pr-3 font-medium">Prop</th>
                <th className="pb-3 px-2 font-medium">L5</th>
                <th className="pb-3 px-2 font-medium">L10</th>
                <th className="pb-3 px-2 font-medium">L20</th>
                <th className="pb-3 px-2 font-medium">EV+</th>
                <th className="pb-3 pl-2 font-medium text-right">Add</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {rows.map((row) => {
                const active = selected?.id === row.id;
                const inBuilder = picks.includes(row.id);
                const l10 = parseHit(row.l10);
                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    className={cn(
                      "cursor-pointer transition",
                      active ? "bg-yellow-500/[0.06]" : "hover:bg-white/[0.02]",
                    )}
                  >
                    <td className="py-3 pr-3">
                      <p className="font-medium text-neutral-100">{row.player}</p>
                      <p className="text-xs text-neutral-500">
                        {row.team} vs {row.opponent} · {row.market} {row.side} {row.line}
                      </p>
                    </td>
                    <td className="px-2 py-3 tabular-nums text-neutral-300">{parseHit(row.l5)}%</td>
                    <td
                      className={cn(
                        "px-2 py-3 tabular-nums font-medium",
                        l10 >= 75 ? "text-emerald-300" : l10 >= 65 ? "text-yellow-300" : "text-neutral-300",
                      )}
                    >
                      {l10}%
                    </td>
                    <td className="px-2 py-3 tabular-nums text-neutral-300">{parseHit(row.l20)}%</td>
                    <td className="px-2 py-3 tabular-nums text-emerald-300">
                      +{row.evPercent.toFixed(1)}%
                    </td>
                    <td className="py-3 pl-2 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePick(row.id);
                        }}
                        className={cn(
                          "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition",
                          inBuilder
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                            : "border-[#2a2a2a] text-neutral-400 hover:border-yellow-500/40 hover:text-yellow-300",
                        )}
                        aria-label={inBuilder ? "Remove from builder" : "Add to builder"}
                      >
                        {inBuilder ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="space-y-4">
        {selected && (
          <section className="rounded-2xl border border-[#222] bg-[#0c0c0c] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Why this prop
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              {selected.player} · {selected.market}
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              {selected.side} {selected.line} · {formatAmericanOdds(selected.americanOdds)}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-[#222] bg-black/30 p-3 text-center">
                <p className="text-[10px] uppercase text-neutral-500">L10</p>
                <p className="mt-1 text-lg font-semibold text-emerald-300">{parseHit(selected.l10)}%</p>
              </div>
              <div className="rounded-xl border border-[#222] bg-black/30 p-3 text-center">
                <p className="text-[10px] uppercase text-neutral-500">EV</p>
                <p className="mt-1 text-lg font-semibold text-emerald-300">
                  +{selected.evPercent.toFixed(1)}%
                </p>
              </div>
              <div className="rounded-xl border border-[#222] bg-black/30 p-3 text-center">
                <p className="text-[10px] uppercase text-neutral-500">No-vig</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {(selected.noVigProb * 100).toFixed(0)}%
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/[0.07] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-yellow-400">
                Confidence
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-yellow-300">
                {selected.confidence}
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                vs {selected.opponent} · {selected.tipTime}
              </p>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-[#222] bg-[#0c0c0c] p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">Builder</h3>
            <span className="rounded-full bg-yellow-400/15 px-2 py-0.5 text-[11px] font-semibold text-yellow-300">
              {picks.length} picks
            </span>
          </div>
          {picks.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">Add props from the board to preview a slip.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {picks.map((id) => {
                const p = mockNbaProps.find((r) => r.id === id);
                if (!p) return null;
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between rounded-xl border border-[#222] bg-black/25 px-3 py-2.5 text-sm"
                  >
                    <span className="text-neutral-200">
                      {p.player} · {p.market}
                    </span>
                    <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
                      {p.side}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-5 flex items-end justify-between border-t border-[#1a1a1a] pt-4">
            <div>
              <p className="text-xs text-neutral-500">Avg L10</p>
              <p className="text-[11px] text-neutral-600">{picks.length} legs</p>
            </div>
            <p className="text-3xl font-semibold tabular-nums text-emerald-300">{avgL10}%</p>
          </div>
        </section>
      </div>
    </div>
  );
}
