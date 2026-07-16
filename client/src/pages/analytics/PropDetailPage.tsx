import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Plus, Check } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { LeagueBadge } from "@/components/shared/LeagueBadge";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import {
  getPropDetail,
  formatAmericanOdds,
  bestBookForSide,
  type PropDetail,
} from "@/data/propsCatalog";
import "@/data/registerLeagueProps";
import { propIdToBuilderLeg } from "@/lib/addPropToBuilder";
import {
  asPropDetailFromApi,
  cacheNbaPropDetail,
  getCachedNbaPropDetail,
} from "@/lib/nbaLiveCache";
import { recomputeLegSide } from "@/lib/legStats";
import { cn } from "@/lib/utils";
import { ProOnly } from "@/components/membership/ProOnly";
import { CardSkeleton } from "@/components/shared/Skeleton";

function MovementChart({
  points,
}: {
  points: Array<{ label: string; line: number; odds: number }>;
}) {
  if (!points.length) return <p className="text-sm text-neutral-500">No line ticks yet.</p>;
  const values = points.map((p) => p.line);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 320;
  const height = 120;
  const coords = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * width;
    const y = height - 20 - ((v - min) / range) * (height - 40);
    return { x, y };
  });
  const line = coords.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full">
        <polyline
          fill="none"
          stroke="rgb(250, 204, 21)"
          strokeWidth="2.5"
          points={line}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((c, i) => (
          <circle key={points[i].label} cx={c.x} cy={c.y} r="4" fill="#0a0a0a" stroke="rgb(250, 204, 21)" strokeWidth="2" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
        {points.map((p) => (
          <span key={p.label}>
            {p.label} · {p.line}
          </span>
        ))}
      </div>
    </div>
  );
}

function HitRateBars({ prop }: { prop: PropDetail }) {
  const rows = [
    { label: "L5", value: prop.l5 },
    { label: "L10", value: prop.l10 },
    { label: "L20", value: prop.l20 },
    { label: "Season", value: prop.season },
  ];
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const [hits, samples] = row.value.split("/").map(Number);
        const pct = samples ? Math.round((hits / samples) * 100) : 0;
        return (
          <div key={row.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-neutral-400">{row.label}</span>
              <span className="tabular-nums text-neutral-200">
                {row.value} · {pct}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-700 to-yellow-400 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MinutesTrend({ points }: { points: NonNullable<PropDetail["minutesTrend"]> }) {
  if (!points.length) return <p className="text-sm text-neutral-500">Minutes trend fills as gamelogs land.</p>;
  const values = points.map((p) => p.minutes);
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-1.5 h-28">
      {points.map((p) => (
        <div key={`${p.date}-${p.opponent}`} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-gradient-to-t from-amber-700/80 to-yellow-400/90"
            style={{ height: `${Math.max(8, (p.minutes / max) * 100)}%` }}
            title={`${p.minutes} min · ${p.value ?? "—"}`}
          />
          <span className="text-[9px] text-neutral-600">{p.date}</span>
        </div>
      ))}
    </div>
  );
}

export default function PropDetailPage() {
  const [, params] = useRoute("/prop/:id");
  const propId = params?.id ?? "";
  const mockProp = getPropDetail(propId);
  const cached = getCachedNbaPropDetail(propId);
  const looksNbaLive = propId.startsWith("nba:prop:") || (!mockProp && Boolean(propId));

  const live = useQuery({
    queryKey: ["nba-prop", propId],
    enabled: Boolean(propId) && looksNbaLive,
    queryFn: async () => {
      const res = await fetch(`/api/nba/props/${encodeURIComponent(propId)}`);
      if (!res.ok) throw new Error("prop");
      const data = await res.json();
      const detail = asPropDetailFromApi((data.prop ?? data) as Record<string, unknown>);
      cacheNbaPropDetail(detail);
      return detail;
    },
    staleTime: 120_000,
  });

  const prop = live.data ?? cached ?? mockProp;
  const { addLeg, hasLeg } = useParlayDraft();
  const [side, setSide] = useState<"Over" | "Under" | null>(null);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);

  const recommendation = prop?.recommendation ?? prop?.side ?? "Over";
  const selectedSide = side ?? recommendation;
  const best = useMemo(
    () => (prop && prop.books.length ? bestBookForSide(prop, selectedSide) : null),
    [prop, selectedSide],
  );

  const rankedBooks = useMemo(() => {
    if (!prop) return [];
    return [...prop.books].sort(
      (a, b) => (b.edgeVsProjection ?? -999) - (a.edgeVsProjection ?? -999),
    );
  }, [prop]);

  if (live.isLoading && !prop) {
    return <CardSkeleton rows={4} />;
  }

  if (!prop || !best) {
    return (
      <div className="card-3d rounded-2xl border border-[#1a1a1a] p-10 text-center">
        <h1 className="text-xl font-semibold text-white">Report not found</h1>
        <p className="mt-2 text-sm text-neutral-400">
          No Research Report for “{propId}”. Start the data platform for live NBA props.
        </p>
        <Link href="/nba" className="mt-6 inline-block text-sm text-yellow-400 hover:underline">
          Back to NBA board
        </Link>
      </div>
    );
  }

  const projected = prop.projectedValue ?? prop.line;
  const selectedOdds = selectedSide === "Over" ? best.over : best.under;
  const selectedNoVig = selectedSide === prop.side ? prop.noVigProb : prop.noVigOpposite;
  const selectedEv =
    selectedSide === prop.side ? prop.evPercent : Math.max(0.2, prop.evPercent - 2.4);
  const added = hasLeg(prop.id);
  const activeBook =
    rankedBooks.find((b) => b.book === selectedBook) ??
    rankedBooks.find((b) => b.isBestValue) ??
    rankedBooks[0];

  const similar = prop.similarPropIds
    .map((id) => getCachedNbaPropDetail(id) ?? getPropDetail(id))
    .filter((p): p is PropDetail => Boolean(p));

  function handleAdd() {
    if (!prop) return;
    cacheNbaPropDetail(prop);
    const leg = propIdToBuilderLeg(prop.id);
    if (leg) addLeg(recomputeLegSide(leg, selectedSide));
  }

  const boardHref =
    prop.league === "NFL"
      ? "/nfl"
      : prop.league === "WNBA"
        ? "/wnba"
        : prop.league === "ATP"
          ? "/atp"
          : prop.league === "WTA"
            ? "/wta"
            : "/nba";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Link href="/research" className="inline-flex items-center gap-2 text-neutral-400 transition hover:text-yellow-400">
          <ArrowLeft className="h-4 w-4" />
          Research Reports
        </Link>
        <span className="text-neutral-700">·</span>
        <Link href={boardHref} className="text-neutral-500 hover:text-yellow-400">
          {prop.league} board
        </Link>
      </div>

      <PageHeader
        eyebrow="Independent model research"
        title={`${prop.player} · ${prop.market}`}
        description={`${prop.team} vs ${prop.opponent} · ${prop.position} · Our projection vs operator lines — not a sportsbook copy.`}
        actions={
          <button
            type="button"
            disabled={added}
            onClick={handleAdd}
            className={cn(
              "btn-3d inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold",
              added
                ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                : "bg-gradient-to-b from-yellow-400 to-amber-500 text-black",
            )}
          >
            {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {added ? "In Builder" : "Add to Builder"}
          </button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <LeagueBadge league={prop.league} />
        <Link href={`/player/${prop.playerId}`} className="text-sm font-medium text-yellow-400 hover:underline">
          Open Player Profile
        </Link>
        {prop.linesAreMock && (
          <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-200">
            Comparison lines · mock until live providers
          </span>
        )}
      </div>

      {/* Model hero */}
      <section className="card-3d mb-6 rounded-2xl border border-yellow-500/25 bg-gradient-to-br from-yellow-500/[0.08] to-transparent p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-500/90">
              Seraphim model
            </p>
            <p className="mt-3 text-sm text-neutral-400">Projected {prop.market}</p>
            <p className="mt-1 text-5xl font-semibold tabular-nums text-white">{projected.toFixed(1)}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-300">
                Recommendation · {recommendation}
              </span>
              {prop.edgeVsLine != null && (
                <span className="rounded-lg border border-[#1a1a1a] bg-black/30 px-3 py-1.5 text-sm tabular-nums text-neutral-200">
                  Edge vs consensus {prop.edgeVsLine > 0 ? "+" : ""}
                  {prop.edgeVsLine.toFixed(1)}
                </span>
              )}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-neutral-500">{prop.why}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Confidence" value={`${prop.confidence}%`} accent="gold" />
            <Metric label="Research Score" value={`${prop.researchScore}/100`} accent="gold" />
            <Metric
              label="Over prob"
              value={`${((prop.overProbability ?? prop.noVigProb) * 100).toFixed(0)}%`}
            />
            <Metric
              label="Under prob"
              value={`${((prop.underProbability ?? prop.noVigOpposite) * 100).toFixed(0)}%`}
            />
          </div>
        </div>
      </section>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {(["Over", "Under"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={cn(
              "rounded-2xl border px-4 py-4 text-left transition",
              selectedSide === s
                ? "border-yellow-500/40 bg-yellow-500/10 shadow-[0_0_28px_-12px_rgba(234,179,8,0.5)]"
                : "border-[#1a1a1a] bg-black/20 hover:border-neutral-700",
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{s}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-white">
              vs model {projected.toFixed(1)}
            </p>
            <p className="mt-1 text-sm text-neutral-400">
              Best book {formatAmericanOdds(s === "Over" ? bestBookForSide(prop, "Over").over : bestBookForSide(prop, "Under").under)}
              {s === recommendation && (
                <span className="ml-2 text-[10px] uppercase tracking-wider text-yellow-400">Model lean</span>
              )}
            </p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" data-feature="metrics-row">
        <Metric
          label="Best value line"
          value={`${activeBook?.line ?? best.line}`}
          sub={activeBook?.book ?? best.book}
        />
        <Metric
          label="Edge vs line"
          value={`${(activeBook?.edgeVsProjection ?? 0) > 0 ? "+" : ""}${(activeBook?.edgeVsProjection ?? 0).toFixed(1)}`}
          accent="emerald"
        />
        <Metric label="No-Vig" value={`${(selectedNoVig * 100).toFixed(1)}%`} dataFeature="no-vig" />
        <Metric label="Model EV" value={`+${selectedEv.toFixed(1)}%`} accent="emerald" />
        <Metric label="DQS" value={`${prop.dqs}`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <div className="mb-1 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-white">Sportsbook / Pick&apos;em lines</h2>
              <p className="text-[11px] text-neutral-500">Click a line · sorted by model edge</p>
            </div>
            <p className="mb-4 text-xs text-neutral-500">
              Projection {projected.toFixed(1)} · recommendation {recommendation}. Greatest edge marked Best Value.
            </p>
            <ul className="space-y-2">
              {rankedBooks.map((b) => {
                const active = (selectedBook ?? rankedBooks.find((x) => x.isBestValue)?.book) === b.book;
                const odds = selectedSide === "Over" ? b.over : b.under;
                return (
                  <li key={b.book}>
                    <button
                      type="button"
                      onClick={() => setSelectedBook(b.book)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left text-sm transition",
                        active
                          ? "border-yellow-500/40 bg-yellow-500/10"
                          : "border-[#1a1a1a] bg-black/20 hover:border-neutral-700",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-neutral-100">{b.book}</span>
                          <span className="rounded border border-[#222] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-neutral-500">
                            {b.kind === "pickem" ? "Pick'em" : "Sportsbook"}
                          </span>
                          {b.isBestValue && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                              Best Value
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-neutral-500">
                          Edge vs projection{" "}
                          <span className="tabular-nums text-neutral-300">
                            {(b.edgeVsProjection ?? 0) > 0 ? "+" : ""}
                            {(b.edgeVsProjection ?? 0).toFixed(1)}
                          </span>
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

          <section data-feature="hit-rates" className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <h2 className="text-base font-semibold text-white">L5 / L10 / L20 hit rates</h2>
            <p className="mt-1 text-xs text-neutral-500">Clear rate at the consensus research line ({prop.line})</p>
            <div className="mt-4">
              <HitRateBars prop={prop} />
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
              <h2 className="text-base font-semibold text-white">Home vs Away</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {(["home", "away"] as const).map((key) => {
                  const split = prop.homeAway?.[key];
                  return (
                    <div key={key} className="rounded-xl border border-[#1a1a1a] bg-black/25 px-3 py-3">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{key}</p>
                      <p className="mt-1 text-xl font-semibold tabular-nums text-white">
                        {split?.average != null ? split.average.toFixed(1) : "—"}
                      </p>
                      <p className="mt-1 text-[11px] text-neutral-500">{split?.samples ?? 0} samples</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
              <h2 className="text-base font-semibold text-white">Opponent history</h2>
              <p className="mt-2 text-sm text-yellow-400/90">
                vs {prop.opponentHistory?.opponent ?? prop.opponent}
                {prop.opponentHistory?.average != null
                  ? ` · avg ${prop.opponentHistory.average.toFixed(1)}`
                  : ""}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {prop.opponentHistory?.meetings ?? 0} meetings in warehouse gamelogs
              </p>
              <ul className="mt-3 space-y-1.5">
                {(prop.opponentHistory?.recent ?? []).slice(0, 4).map((m) => (
                  <li key={`${m.date}-${m.value}`} className="flex justify-between text-xs text-neutral-400">
                    <span>{m.date}</span>
                    <span className="tabular-nums text-neutral-200">{m.value ?? "—"}</span>
                  </li>
                ))}
                {(prop.opponentHistory?.recent ?? []).length === 0 && (
                  <li className="text-xs text-neutral-600">No H2H logs vs this opponent yet.</li>
                )}
              </ul>
            </div>
          </section>

          <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">Minutes played trend</h2>
                <p className="mt-1 text-xs text-neutral-500">
                  Projected workload · {prop.projectedMinutes ?? "—"} min · Usage proxy{" "}
                  {prop.usageRate != null ? `${prop.usageRate}%` : "—"}
                </p>
              </div>
            </div>
            <MinutesTrend points={prop.minutesTrend ?? []} />
          </section>

          <section data-feature="line-movement" className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <h2 className="text-base font-semibold text-white">Line movement</h2>
            <p className="mt-1 text-xs text-neutral-500">
              {prop.movement.length ? "Open → current (warehouse ticks when available)" : "Snapshots wire as providers land"}
            </p>
            <div className="mt-4">
              <MovementChart points={prop.movement} />
            </div>
          </section>

          <ProOnly
            title="AI explanation"
            description="Standard keeps projection, hit rates, and line comparison. Upgrade to Pro for the AI writeup."
            ctaLabel="Upgrade to Pro"
          >
            <section data-feature="ai-analysis" className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
              <h2 className="text-base font-semibold text-white">AI explanation</h2>
              <ul className="mt-3 space-y-2">
                {(prop.analysis.length ? prop.analysis : [prop.why]).map((line) => (
                  <li key={line} className="text-sm leading-relaxed text-neutral-400">
                    <span className="mr-2 text-yellow-500">•</span>
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          </ProOnly>

          {similar.length > 0 && (
            <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
              <h2 className="text-base font-semibold text-white">Similar props</h2>
              <ul className="mt-4 space-y-2">
                {similar.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#1a1a1a] bg-black/20 px-3 py-3"
                  >
                    <div>
                      <Link href={`/prop/${s.id}`} className="text-sm font-medium text-neutral-100 hover:text-yellow-400">
                        {s.player} · {s.market} {s.recommendation ?? s.side}{" "}
                        {Number(s.projectedValue ?? s.line).toFixed(1)}
                      </Link>
                      <p className="mt-0.5 text-[11px] text-neutral-500">
                        EV +{s.evPercent.toFixed(1)}% · Conf {s.confidence}
                      </p>
                    </div>
                    <ResearchScoreBadge score={s.researchScore} size="sm" />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section
            data-feature="research-score"
            className="card-3d rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/[0.07] to-transparent p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-500/90">
                  Research Score
                </p>
                <h2 className="mt-2 text-3xl font-semibold tabular-nums text-white">{prop.researchScore}</h2>
                <p className="mt-1 text-xs text-neutral-500">Checklist-backed · not win probability</p>
              </div>
              <ResearchScoreBadge score={prop.researchScore} />
            </div>
            <ul className="mt-5 space-y-2">
              {prop.checks.length === 0 && (
                <li className="rounded-lg border border-[#1a1a1a] bg-black/20 px-3 py-2.5 text-sm text-neutral-400">
                  Influential factors: {(prop.analysis.slice(0, 2).join(" · ") || prop.why)}
                </li>
              )}
              {prop.checks.map((check) => (
                <li
                  key={check.code}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
                    check.status === "pass" && "border-emerald-500/20 bg-black/20 text-emerald-200",
                    check.status === "warn" && "border-amber-500/20 bg-black/20 text-amber-200",
                    check.status === "fail" && "border-red-500/20 bg-black/20 text-red-200",
                    check.status === "unknown" && "border-neutral-700 bg-black/20 text-neutral-400",
                  )}
                >
                  <span className="w-4 shrink-0 text-center">
                    {check.status === "pass" ? "✓" : check.status === "fail" ? "✗" : "~"}
                  </span>
                  {check.label}
                </li>
              ))}
            </ul>
          </section>

          <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <h2 className="text-base font-semibold text-white">Confidence</h2>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-yellow-400">{prop.confidence}%</p>
            <p className="mt-2 text-xs text-neutral-500">
              Model certainty in the projection — separate from Research Score and EV.
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-600 to-yellow-400"
                style={{ width: `${prop.confidence}%` }}
              />
            </div>
          </section>

          <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <h2 className="text-base font-semibold text-white">Injury impact</h2>
            <p
              className={cn(
                "mt-2 text-sm font-medium",
                prop.injuryImpact?.status === "None" || !prop.injuryImpact
                  ? "text-emerald-300"
                  : "text-amber-300",
              )}
            >
              {prop.injuryImpact?.status ?? "None"}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-neutral-500">
              {prop.injuryImpact?.detail ?? "No active injury designation in warehouse."}
            </p>
          </section>

          <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <h2 className="text-base font-semibold text-white">Opponent defensive matchup</h2>
            <p className="mt-2 text-sm text-yellow-400/90">
              #{prop.opponentDefense.rank} of {prop.opponentDefense.of} · {prop.opponentDefense.label}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">{prop.opponentDefense.note}</p>
          </section>

          <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Data Quality</h2>
              <span className="text-2xl font-semibold tabular-nums text-yellow-400">{prop.dqs}</span>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Trust in inputs (freshness, injuries, book agreement). Separate from Research Score and Confidence.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  accent,
  dataFeature,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "emerald" | "gold";
  dataFeature?: string;
}) {
  return (
    <div data-feature={dataFeature} className="card-3d rounded-2xl border border-[#1a1a1a] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{label}</p>
      <p
        className={cn(
          "mt-2 text-xl font-semibold tabular-nums sm:text-2xl",
          accent === "emerald" && "text-emerald-300",
          accent === "gold" && "text-yellow-400",
          !accent && "text-white",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-[11px] text-neutral-500">{sub}</p>}
    </div>
  );
}
