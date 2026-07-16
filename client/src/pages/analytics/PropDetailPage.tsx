import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Plus, Check } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { LeagueBadge } from "@/components/shared/LeagueBadge";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import {
  formatAmericanOdds,
  bestBookForSide,
  type PropDetail,
} from "@/data/propsCatalog";
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
import { LineComparison } from "@/components/shared/LineComparison";

type HitWindow = "L5" | "L10" | "L20" | "Season";

function parseHitRate(value: string): { hits: number; samples: number; pct: number } {
  const [hits, samples] = value.split("/").map(Number);
  const h = Number.isFinite(hits) ? hits : 0;
  const s = Number.isFinite(samples) ? samples : 0;
  return { hits: h, samples: s, pct: s ? Math.round((h / s) * 100) : 0 };
}

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
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full">
        <polyline
          fill="none"
          stroke="rgb(250, 204, 21)"
          strokeWidth="2.5"
          points={line}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((c, i) => (
          <circle
            key={points[i].label}
            cx={c.x}
            cy={c.y}
            r="4"
            fill="#0a0a0a"
            stroke="rgb(250, 204, 21)"
            strokeWidth="2"
          />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-neutral-500">
        {points.map((p) => (
          <span key={p.label}>
            {p.label} · {p.line}
          </span>
        ))}
      </div>
    </div>
  );
}

function HitHistoryChart({
  history,
  line,
  window,
  windowLabel,
}: {
  history: NonNullable<PropDetail["hitHistory"]>;
  line: number;
  window: HitWindow;
  windowLabel: string;
}) {
  const limit = window === "L5" ? 5 : window === "L10" ? 10 : window === "L20" ? 20 : history.length;
  const slice = history.slice(0, Math.max(limit, 0));
  if (!slice.length) {
    return <p className="text-sm text-neutral-500">Hit-rate history fills as warehouse gamelogs land.</p>;
  }
  const vals = slice.map((h) => h.value ?? 0);
  const max = Math.max(...vals, line, 1) * 1.2;
  const hits = slice.filter((g) => g.hit).length;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Hit rate · {windowLabel}
          </p>
          <p className="mt-2 text-5xl font-semibold tabular-nums tracking-tight text-white sm:text-6xl">
            {hits}
            <span className="text-neutral-600">/{slice.length}</span>
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Cleared line {line} in {hits} of last {slice.length} games
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-emerald-500" /> Hit
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-red-500/80" /> Miss
          </span>
        </div>
      </div>

      <div className="relative h-56 sm:h-64">
        <div
          className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
          style={{ bottom: `${(line / max) * 100}%` }}
        >
          <div className="h-px flex-1 border-t border-dashed border-neutral-500/60" />
          <span className="ml-3 shrink-0 rounded-md bg-[#0d0d0d] px-2 py-0.5 text-[11px] font-medium text-neutral-400">
            Line {line}
          </span>
        </div>

        <div className="absolute inset-0 flex items-end justify-between gap-2 px-1">
          {slice.map((g, i) => {
            const v = g.value ?? 0;
            const h = Math.max(10, (v / max) * 100);
            return (
              <div key={`${g.label}-${i}`} className="flex h-full flex-1 flex-col items-center justify-end">
                <span
                  className={cn(
                    "mb-2 text-[11px] font-semibold tabular-nums sm:text-xs",
                    g.hit ? "text-emerald-300" : "text-red-300/85",
                  )}
                >
                  {g.value != null ? g.value : "—"}
                </span>
                <div
                  className={cn(
                    "w-full max-w-[36px] rounded-t-lg transition-all duration-500",
                    g.hit
                      ? "bg-gradient-to-t from-emerald-800 to-emerald-400"
                      : "bg-gradient-to-t from-red-950/90 to-red-500/75",
                  )}
                  style={{ height: `${h}%` }}
                  title={g.label}
                />
                <span className="mt-3 text-[10px] tabular-nums text-neutral-600">{g.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function PropDetailPage() {
  const [, params] = useRoute("/prop/:id");
  const propId = params?.id ?? "";
  const cached = getCachedNbaPropDetail(propId);

  const live = useQuery({
    queryKey: ["live-prop", propId],
    enabled: Boolean(propId),
    queryFn: async () => {
      if (propId.startsWith("wnba:")) {
        const wnbaRes = await fetch(`/api/wnba/props/${encodeURIComponent(propId)}`);
        if (wnbaRes.ok) {
          const data = await wnbaRes.json();
          const detail = asPropDetailFromApi({
            ...((data.prop ?? data) as Record<string, unknown>),
            league: "WNBA",
          });
          cacheNbaPropDetail(detail);
          return detail;
        }
      }
      if (propId.startsWith("nfl:")) {
        const nflBoard = await fetch("/api/nfl/props");
        if (nflBoard.ok) {
          const data = (await nflBoard.json()) as { props: Record<string, unknown>[] };
          const row = data.props.find((p) => String(p.id) === propId);
          if (row) {
            const detail = asPropDetailFromApi({ ...row, league: "NFL" });
            cacheNbaPropDetail(detail);
            return detail;
          }
        }
      }
      const nbaRes = await fetch(`/api/nba/props/${encodeURIComponent(propId)}`);
      if (nbaRes.ok) {
        const data = await nbaRes.json();
        const detail = asPropDetailFromApi((data.prop ?? data) as Record<string, unknown>);
        cacheNbaPropDetail(detail);
        return detail;
      }
      const wnbaRes = await fetch(`/api/wnba/props/${encodeURIComponent(propId)}`);
      if (wnbaRes.ok) {
        const data = await wnbaRes.json();
        const detail = asPropDetailFromApi({
          ...((data.prop ?? data) as Record<string, unknown>),
          league: "WNBA",
        });
        cacheNbaPropDetail(detail);
        return detail;
      }
      const nflBoard = await fetch("/api/nfl/props");
      if (nflBoard.ok) {
        const data = (await nflBoard.json()) as { props: Record<string, unknown>[] };
        const row = data.props.find((p) => String(p.id) === propId);
        if (row) {
          const detail = asPropDetailFromApi({ ...row, league: "NFL" });
          cacheNbaPropDetail(detail);
          return detail;
        }
      }
      throw new Error("prop");
    },
    staleTime: 120_000,
  });

  const prop = live.data ?? cached;
  const { addLeg, hasLeg } = useParlayDraft();
  const [side, setSide] = useState<"Over" | "Under" | null>(null);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [hitWindow, setHitWindow] = useState<HitWindow>("L10");

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
      <div className="rounded-3xl border border-white/[0.06] bg-[#0d0d0d] p-12 text-center">
        <h1 className="text-xl font-semibold text-white">Report not found</h1>
        <p className="mt-3 text-sm text-neutral-400">
          No live Research Report for “{propId}”. Open a board after starting the data platform.
        </p>
        <Link href="/nba" className="mt-8 inline-block text-sm text-yellow-400 hover:underline">
          Back to NBA board
        </Link>
      </div>
    );
  }

  const projected = prop.projectedValue ?? prop.line;
  const selectedNoVig = selectedSide === prop.side ? prop.noVigProb : prop.noVigOpposite;
  const selectedEv =
    selectedSide === prop.side ? prop.evPercent : Math.max(0.2, prop.evPercent - 2.4);
  const added = hasLeg(prop.id);
  const activeBook =
    rankedBooks.find((b) => b.book === selectedBook) ??
    rankedBooks.find((b) => b.isBestValue) ??
    rankedBooks[0];

  const similar = prop.similarPropIds
    .map((id) => getCachedNbaPropDetail(id))
    .filter((p): p is PropDetail => Boolean(p));

  const windowRate = parseHitRate(
    hitWindow === "L5" ? prop.l5 : hitWindow === "L10" ? prop.l10 : hitWindow === "L20" ? prop.l20 : prop.season,
  );

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

  const panel = "rounded-3xl border border-white/[0.06] bg-[#0d0d0d]";

  return (
    <div className="space-y-10">
      <div>
        <div className="mb-5 flex flex-wrap items-center gap-3 text-sm">
          <Link
            href="/research"
            className="inline-flex items-center gap-2 text-neutral-400 transition hover:text-yellow-400"
          >
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
                "btn-3d inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold",
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

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <LeagueBadge league={prop.league} />
          <Link
            href={`/player/${prop.playerId}`}
            className="text-sm font-medium text-yellow-400 hover:underline"
          >
            Open Player Profile
          </Link>
          {prop.linesAreMock && (
            <span className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-amber-200">
              Some lines · require integration
            </span>
          )}
        </div>
      </div>

      {/* Hero: projection + Over/Under — one composition */}
      <section className={cn(panel, "p-6 sm:p-8")}>
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-500/90">
              Seraphim projection
            </p>
            <p className="mt-4 text-sm text-neutral-500">{prop.market}</p>
            <p className="mt-1 text-6xl font-semibold tabular-nums tracking-tight text-white sm:text-7xl">
              {projected.toFixed(1)}
            </p>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-500">{prop.why}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300">
                Lean {recommendation}
              </span>
              {prop.edgeVsLine != null && (
                <span className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm tabular-nums text-neutral-200">
                  Edge {prop.edgeVsLine > 0 ? "+" : ""}
                  {prop.edgeVsLine.toFixed(1)} vs consensus
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(["Over", "Under"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                className={cn(
                  "rounded-2xl border px-5 py-5 text-left transition",
                  selectedSide === s
                    ? "border-yellow-500/35 bg-yellow-500/[0.08]"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/15",
                )}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{s}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
                  {formatAmericanOdds(
                    s === "Over"
                      ? bestBookForSide(prop, "Over").over
                      : bestBookForSide(prop, "Under").under,
                  )}
                </p>
                {s === recommendation && (
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-yellow-400">Model lean</p>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main research composition: chart + sidebar */}
      <div className="grid gap-8 xl:grid-cols-[1.4fr_0.85fr]">
        <div className="space-y-8">
          <section className={cn(panel, "p-6 sm:p-8")} data-feature="hit-history">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Game log vs line</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Green cleared {prop.line} · red missed · lean {recommendation}
                </p>
              </div>
              <div className="flex flex-wrap gap-2" data-feature="hit-rates">
                {(["L5", "L10", "L20", "Season"] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setHitWindow(w)}
                    className={cn(
                      "rounded-full px-4 py-2 text-xs font-semibold tracking-wide transition",
                      hitWindow === w
                        ? "bg-white text-black"
                        : "bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08] hover:text-neutral-200",
                    )}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <HitHistoryChart
              history={prop.hitHistory ?? []}
              line={prop.line}
              window={hitWindow}
              windowLabel={hitWindow}
            />
          </section>

          <LineComparison
            books={prop.books}
            projected={projected}
            modelSide={recommendation}
            consensusLine={prop.line}
            selectedSide={selectedSide}
            selectedBook={selectedBook}
            onSelectBook={setSelectedBook}
          />

          <section className={cn(panel, "p-6 sm:p-8")}>
            <div className="grid gap-10 sm:grid-cols-2">
              <div>
                <h2 className="text-base font-semibold text-white">Home vs Away</h2>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  {(["home", "away"] as const).map((key) => {
                    const split = prop.homeAway?.[key];
                    return (
                      <div key={key} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-5">
                        <p className="text-[10px] uppercase tracking-wider text-neutral-500">{key}</p>
                        <p className="mt-2 text-3xl font-semibold tabular-nums text-white">
                          {split?.average != null ? split.average.toFixed(1) : "—"}
                        </p>
                        <p className="mt-2 text-xs text-neutral-500">{split?.samples ?? 0} samples</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Opponent history</h2>
                <p className="mt-3 text-sm text-yellow-400/90">
                  vs {prop.opponentHistory?.opponent ?? prop.opponent}
                  {prop.opponentHistory?.average != null
                    ? ` · avg ${prop.opponentHistory.average.toFixed(1)}`
                    : ""}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {prop.opponentHistory?.meetings ?? 0} meetings in warehouse gamelogs
                </p>
                <ul className="mt-5 space-y-3">
                  {(prop.opponentHistory?.recent ?? []).slice(0, 4).map((m) => (
                    <li key={`${m.date}-${m.value}`} className="flex justify-between text-sm text-neutral-400">
                      <span>{m.date}</span>
                      <span className="tabular-nums text-neutral-200">{m.value ?? "—"}</span>
                    </li>
                  ))}
                  {(prop.opponentHistory?.recent ?? []).length === 0 && (
                    <li className="text-sm text-neutral-600">No H2H logs vs this opponent yet.</li>
                  )}
                </ul>
              </div>
            </div>
          </section>

          <section className={cn(panel, "p-6 sm:p-8")} data-feature="game-logs">
            <h2 className="text-base font-semibold text-white">Recent game logs</h2>
            <p className="mt-1 text-sm text-neutral-500">{prop.market} from warehouse</p>
            {(prop.recentGameLogs ?? []).length === 0 ? (
              <p className="mt-6 text-sm text-neutral-500">Game logs appear after sync.</p>
            ) : (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wider text-neutral-500">
                    <tr>
                      <th className="pb-3 pr-4 font-medium">Date</th>
                      <th className="pb-3 pr-4 font-medium">Opp</th>
                      <th className="pb-3 pr-4 font-medium">Min</th>
                      <th className="pb-3 font-medium tabular-nums">{prop.market}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {(prop.recentGameLogs ?? []).map((g) => (
                      <tr key={`${g.date}-${g.opponent}`}>
                        <td className="py-3.5 pr-4 text-neutral-400">{g.date}</td>
                        <td className="py-3.5 pr-4 text-neutral-300">
                          {g.home ? "vs" : "@"} {g.opponent}
                        </td>
                        <td className="py-3.5 pr-4 tabular-nums text-neutral-400">{g.minutes ?? "—"}</td>
                        <td className="py-3.5 tabular-nums font-medium text-neutral-100">
                          {g.value != null ? g.value : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className={cn(panel, "p-6 sm:p-8")} data-feature="line-movement">
            <h2 className="text-base font-semibold text-white">Line movement</h2>
            <p className="mt-1 text-sm text-neutral-500">
              {prop.movement.length
                ? "Open → current (warehouse ticks when available)"
                : "Snapshots wire as providers land"}
            </p>
            <div className="mt-6">
              <MovementChart points={prop.movement} />
            </div>
          </section>

          <ProOnly
            title="AI explanation"
            description="Standard keeps projection, hit rates, and line comparison. Upgrade to Pro for the AI writeup."
            ctaLabel="Upgrade to Pro"
          >
            <section className={cn(panel, "p-6 sm:p-8")} data-feature="ai-analysis">
              <h2 className="text-base font-semibold text-white">AI explanation</h2>
              <ul className="mt-5 space-y-3">
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
            <section className={cn(panel, "p-6 sm:p-8")}>
              <h2 className="text-base font-semibold text-white">Similar props</h2>
              <ul className="mt-6 space-y-3">
                {similar.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4"
                  >
                    <div>
                      <Link
                        href={`/prop/${s.id}`}
                        className="text-sm font-medium text-neutral-100 hover:text-yellow-400"
                      >
                        {s.player} · {s.market} {s.recommendation ?? s.side}{" "}
                        {Number(s.projectedValue ?? s.line).toFixed(1)}
                      </Link>
                      <p className="mt-1 text-xs text-neutral-500">
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

        {/* Roomier right rail */}
        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <section className={cn(panel, "p-6 sm:p-8")} data-feature="metrics-row">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Selected book
            </p>
            <p className="mt-3 text-lg font-semibold text-white">{activeBook?.book ?? best.book}</p>
            <div className="mt-8 space-y-6">
              <SidebarStat
                label="Line"
                value={`${activeBook?.line ?? best.line}`}
                sub={`vs projection ${projected.toFixed(1)}`}
              />
              <SidebarStat
                label="Edge"
                value={`${(activeBook?.edgeVsProjection ?? 0) > 0 ? "+" : ""}${(activeBook?.edgeVsProjection ?? 0).toFixed(1)}`}
                accent="emerald"
              />
              <SidebarStat
                label={`${hitWindow} hit rate`}
                value={`${windowRate.pct}%`}
                sub={`${windowRate.hits}/${windowRate.samples}`}
              />
              <SidebarStat label="No-vig" value={`${(selectedNoVig * 100).toFixed(1)}%`} dataFeature="no-vig" />
              <SidebarStat label="Model EV" value={`+${selectedEv.toFixed(1)}%`} accent="emerald" />
            </div>
          </section>

          <section
            data-feature="research-score"
            className={cn(panel, "border-yellow-500/15 bg-gradient-to-br from-yellow-500/[0.06] to-[#0d0d0d] p-6 sm:p-8")}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-500/90">
                  Research Score
                </p>
                <h2 className="mt-3 text-5xl font-semibold tabular-nums text-white">{prop.researchScore}</h2>
                <p className="mt-2 text-xs text-neutral-500">Checklist-backed · not win probability</p>
              </div>
              <ResearchScoreBadge score={prop.researchScore} />
            </div>
            <ul className="mt-8 space-y-2.5">
              {prop.checks.length === 0 && (
                <li className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3 text-sm text-neutral-400">
                  Influential factors: {prop.analysis.slice(0, 2).join(" · ") || prop.why}
                </li>
              )}
              {prop.checks.map((check) => (
                <li
                  key={check.code}
                  className={cn(
                    "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm",
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

          <section className={cn(panel, "p-6 sm:p-8")}>
            <h2 className="text-base font-semibold text-white">Confidence</h2>
            <p className="mt-3 text-4xl font-semibold tabular-nums text-yellow-400">{prop.confidence}%</p>
            <p className="mt-3 text-sm leading-relaxed text-neutral-500">
              Model certainty in the projection — separate from Research Score and EV.
            </p>
            <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-600 to-yellow-400"
                style={{ width: `${prop.confidence}%` }}
              />
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-8">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-neutral-500">Over</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                  {((prop.overProbability ?? prop.noVigProb) * 100).toFixed(0)}%
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-neutral-500">Under</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                  {((prop.underProbability ?? prop.noVigOpposite) * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </section>

          <section className={cn(panel, "p-6 sm:p-8")}>
            <h2 className="text-base font-semibold text-white">Injury</h2>
            <p
              className={cn(
                "mt-3 text-base font-medium",
                prop.injuryImpact?.status === "None" || !prop.injuryImpact
                  ? "text-emerald-300"
                  : "text-amber-300",
              )}
            >
              {prop.injuryImpact?.status ?? "None"}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-neutral-500">
              {prop.injuryImpact?.detail ?? "No active injury designation in warehouse."}
            </p>
          </section>

          <section className={cn(panel, "p-6 sm:p-8")}>
            <h2 className="text-base font-semibold text-white">Opponent defense</h2>
            <p className="mt-3 text-sm text-yellow-400/90">
              #{prop.opponentDefense.rank} of {prop.opponentDefense.of} · {prop.opponentDefense.label}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">{prop.opponentDefense.note}</p>
          </section>

          <section className={cn(panel, "p-6 sm:p-8")}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Data quality</h2>
              <span className="text-3xl font-semibold tabular-nums text-yellow-400">{prop.dqs}</span>
            </div>
            <p className="mt-3 text-sm text-neutral-500">
              Trust in inputs (freshness, injuries, book agreement).
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SidebarStat({
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
    <div data-feature={dataFeature}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{label}</p>
      <p
        className={cn(
          "mt-1.5 text-3xl font-semibold tabular-nums",
          accent === "emerald" && "text-emerald-300",
          accent === "gold" && "text-yellow-400",
          !accent && "text-white",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}
