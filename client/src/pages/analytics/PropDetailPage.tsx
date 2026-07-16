import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Plus, Check } from "lucide-react";
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
import { decodeRouteId, playerProfilePath, propResearchPath } from "@/lib/playerLinks";
import { cn } from "@/lib/utils";
import { ProOnly } from "@/components/membership/ProOnly";
import { CardSkeleton } from "@/components/shared/Skeleton";
import { LineComparison } from "@/components/shared/LineComparison";
import {
  HitRateBars,
  HitRateSummaryBoxes,
  LineMovementChart,
  NoVigOddsCard,
  parseHitRate,
  type HitWindow,
} from "@/components/research";

export default function PropDetailPage() {
  const [, params] = useRoute("/prop/:id");
  const propId = decodeRouteId(params?.id);
  const cached = getCachedNbaPropDetail(propId);

  const live = useQuery({
    queryKey: ["live-prop", propId],
    enabled: Boolean(propId),
    queryFn: async () => {
      const tryProp = async (path: string, league?: string) => {
        const res = await fetch(path);
        if (!res.ok) return null;
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) return null;
        const data = await res.json();
        const raw = (data.prop ?? data) as Record<string, unknown>;
        if (!raw?.id && raw?.line == null) return null;
        const detail = asPropDetailFromApi(league ? { ...raw, league } : raw);
        cacheNbaPropDetail(detail);
        return detail;
      };

      const encoded = encodeURIComponent(propId);
      if (propId.startsWith("wnba:")) {
        const d = await tryProp(`/api/wnba/props/${encoded}`, "WNBA");
        if (d) return d;
      }
      if (propId.startsWith("mlb:")) {
        const d = await tryProp(`/api/mlb/props/${encoded}`, "MLB");
        if (d) return d;
      }
      if (propId.startsWith("nhl:")) {
        const d = await tryProp(`/api/nhl/props/${encoded}`, "NHL");
        if (d) return d;
      }
      if (propId.startsWith("soccer:") || propId.startsWith("atp:") || propId.startsWith("wta:")) {
        const league = propId.startsWith("soccer:")
          ? "Soccer"
          : propId.startsWith("wta:")
            ? "WTA"
            : "ATP";
        let platformQs = "";
        try {
          const saved = localStorage.getItem("seraphim.pickemApp");
          if (saved) platformQs = `platform=${encodeURIComponent(saved)}`;
        } catch {
          /* ignore */
        }
        if (propId.startsWith("soccer:")) {
          const d = await tryProp(
            `/api/soccer/props/${encoded}${platformQs ? `?${platformQs}` : ""}`,
            "Soccer",
          );
          if (d) return d;
        } else {
          const tour = league;
          const d = await tryProp(
            `/api/tennis/props/${encoded}?tour=${tour}${platformQs ? `&${platformQs}` : ""}`,
            league,
          );
          if (d) return d;
        }
        const path = propId.startsWith("soccer:")
          ? `/api/soccer/props${platformQs ? `?${platformQs}` : ""}`
          : `/api/tennis/props?tour=${league}${platformQs ? `&${platformQs}` : ""}`;
        const board = await fetch(path);
        if (board.ok) {
          const data = (await board.json()) as { props: Record<string, unknown>[] };
          const row = data.props.find((p) => String(p.id) === propId);
          if (row) {
            const detail = asPropDetailFromApi({ ...row, league });
            cacheNbaPropDetail(detail);
            return detail;
          }
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
      const nba = await tryProp(`/api/nba/props/${encoded}`);
      if (nba) return nba;
      const wnba = await tryProp(`/api/wnba/props/${encoded}`, "WNBA");
      if (wnba) return wnba;
      // Fallback: scan boards with selected pick'em platform
      let platformQs = "";
      try {
        const saved = localStorage.getItem("seraphim.pickemApp");
        if (saved) platformQs = `?platform=${encodeURIComponent(saved)}`;
      } catch {
        /* ignore */
      }
      for (const [path, league] of [
        [`/api/mlb/props${platformQs}`, "MLB"],
        [`/api/nhl/props${platformQs}`, "NHL"],
        [`/api/wnba/props${platformQs}`, "WNBA"],
        [`/api/nba/props${platformQs}`, "NBA"],
      ] as const) {
        const board = await fetch(path);
        if (!board.ok) continue;
        const ct = board.headers.get("content-type") || "";
        if (!ct.includes("application/json")) continue;
        const data = (await board.json()) as { props: Record<string, unknown>[] };
        const row = data.props.find((p) => String(p.id) === propId);
        if (row) {
          const detail = asPropDetailFromApi({ ...row, league });
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
    () => (prop ? bestBookForSide(prop, selectedSide) : null),
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

  if (!prop) {
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
  const resolvedBest =
    best ??
    ({
      book: "Consensus",
      line: prop.line,
      over: prop.americanOdds,
      under: -110,
    } as const);
  const activeBook =
    rankedBooks.find((b) => b.book === selectedBook) ??
    rankedBooks.find((b) => b.isBestValue) ??
    rankedBooks[0] ??
    resolvedBest;

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
        : prop.league === "MLB"
          ? "/mlb"
          : prop.league === "NHL"
            ? "/nhl"
            : prop.league === "Soccer"
              ? "/soccer"
              : prop.league === "ATP" || prop.league === "WTA"
                ? "/tennis"
                : "/nba";

  const panel = "rounded-xl border border-white/[0.06] bg-[#0d0d0d]";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
          <Link
            href="/research"
            className="inline-flex items-center gap-1.5 text-neutral-400 transition hover:text-yellow-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Reports
          </Link>
          <span className="text-neutral-700">·</span>
          <Link href={boardHref} className="text-neutral-500 hover:text-yellow-400">
            {prop.league}
          </Link>
          <span className="text-neutral-700">·</span>
          <LeagueBadge league={prop.league} />
          <Link
            href={playerProfilePath(prop.playerId)}
            className="font-medium text-yellow-400 hover:underline"
          >
            {prop.player}
          </Link>
          <span className="truncate text-neutral-500">
            {prop.market} · {prop.team} vs {prop.opponent}
          </span>
        </div>
        <button
          type="button"
          disabled={added}
          onClick={handleAdd}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold",
            added
              ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
              : "bg-yellow-400 text-black hover:bg-yellow-300",
          )}
        >
          {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {added ? "In Builder" : "Add"}
        </button>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-3">
          <section className={cn(panel, "p-3 sm:p-4")}>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-yellow-500/90">
                  Seraphim projection · {prop.market}
                </p>
                <div className="mt-1 flex flex-wrap items-end gap-3">
                  <p
                    className={cn(
                      "text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl",
                      recommendation === "Over" ? "text-emerald-400" : "text-red-400",
                    )}
                  >
                    {projected.toFixed(1)}
                  </p>
                  <span
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                      recommendation === "Over"
                        ? "border-emerald-500/35 bg-emerald-500/12 text-emerald-300"
                        : "border-red-500/35 bg-red-500/12 text-red-300",
                    )}
                  >
                    Lean {recommendation}
                  </span>
                  {prop.edgeVsLine != null && (
                    <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11px] tabular-nums text-neutral-300">
                      Edge {prop.edgeVsLine > 0 ? "+" : ""}
                      {prop.edgeVsLine.toFixed(1)}
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-1 text-[11px] text-neutral-500">{prop.why}</p>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {(["Over", "Under"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSide(s)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition",
                      selectedSide === s
                        ? s === "Over"
                          ? "border-emerald-500/40 bg-emerald-500/[0.1]"
                          : "border-red-500/40 bg-red-500/[0.1]"
                        : "border-white/[0.06] bg-white/[0.02] hover:border-white/15",
                    )}
                  >
                    <p
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wider",
                        s === "Over" ? "text-emerald-400" : "text-red-400",
                      )}
                    >
                      {s}
                      {s === recommendation ? " · lean" : ""}
                    </p>
                    <p className="mt-0.5 text-base font-semibold tabular-nums text-white">
                      {formatAmericanOdds(
                        s === "Over"
                          ? bestBookForSide(prop, "Over").over
                          : bestBookForSide(prop, "Under").under,
                      )}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className={cn(panel, "p-3 sm:p-4")} data-feature="hit-history">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-white">Game log vs line</h2>
                <p className="text-[11px] text-neutral-500">
                  Green cleared {prop.line} · red missed
                </p>
              </div>
              <HitRateSummaryBoxes
                compact
                windows={[
                  { key: "L5", label: "L5", hitPct: parseHitRate(prop.l5).pct, average: null, hits: prop.l5 },
                  { key: "L10", label: "L10", hitPct: parseHitRate(prop.l10).pct, average: null, hits: prop.l10 },
                  { key: "L20", label: "L20", hitPct: parseHitRate(prop.l20).pct, average: null, hits: prop.l20 },
                  { key: "Season", label: "Szn", hitPct: parseHitRate(prop.season).pct, average: null, hits: prop.season },
                ]}
                activeKey={hitWindow}
                onSelect={(k) => setHitWindow(k as HitWindow)}
              />
            </div>
            <HitRateBars
              compact
              history={
                (prop.hitHistory?.length
                  ? prop.hitHistory
                  : (prop.recentGameLogs ?? []).map((g) => ({
                      label: g.opponent || g.date,
                      opponent: g.opponent,
                      value: g.value ?? null,
                      hit:
                        g.value == null
                          ? false
                          : selectedSide === "Under"
                            ? g.value < prop.line
                            : g.value > prop.line,
                    }))) ?? []
              }
              line={prop.line}
              window={hitWindow}
              windowLabel={hitWindow}
              propId={prop.id}
              side={selectedSide}
              fallbackRate={
                hitWindow === "L5"
                  ? prop.l5
                  : hitWindow === "L10"
                    ? prop.l10
                    : hitWindow === "L20"
                      ? prop.l20
                      : prop.season
              }
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
        </div>

        <aside className="space-y-2 xl:sticky xl:top-20 xl:self-start">
          <NoVigOddsCard
            compact
            overPct={Math.round((selectedNoVig || prop.noVigProb) * 1000) / 10}
            vigPct={5.2}
            side={selectedSide}
          />
          <section className={cn(panel, "p-3")} data-feature="metrics-row">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
              {activeBook?.book ?? resolvedBest.book}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <SidebarStat compact label="Line" value={`${activeBook?.line ?? resolvedBest.line}`} sub={`proj ${projected.toFixed(1)}`} />
              <SidebarStat
                compact
                label="Edge"
                value={`${(activeBook?.edgeVsProjection ?? 0) > 0 ? "+" : ""}${(activeBook?.edgeVsProjection ?? 0).toFixed(1)}`}
                accent="emerald"
              />
              <SidebarStat compact label={`${hitWindow}`} value={`${windowRate.pct}%`} sub={`${windowRate.hits}/${windowRate.samples}`} />
              <SidebarStat compact label="EV" value={`+${selectedEv.toFixed(1)}%`} accent="emerald" />
            </div>
          </section>

          <section
            data-feature="research-score"
            className={cn(panel, "border-yellow-500/15 bg-gradient-to-br from-yellow-500/[0.06] to-[#0d0d0d] p-3")}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-yellow-500/90">Research</p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums text-white">{prop.researchScore}</p>
              </div>
              <ResearchScoreBadge score={prop.researchScore} size="sm" />
            </div>
            <ul className="mt-2 max-h-24 space-y-1 overflow-y-auto">
              {prop.checks.length === 0 && (
                <li className="text-[11px] text-neutral-500">Checklist fills with warehouse factors.</li>
              )}
              {prop.checks.slice(0, 4).map((c) => (
                <li key={c.code} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate text-neutral-400">{c.label}</span>
                  <span
                    className={cn(
                      "shrink-0 font-medium",
                      c.status === "pass" ? "text-emerald-400" : c.status === "warn" ? "text-amber-300" : "text-red-300",
                    )}
                  >
                    {c.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className={cn(panel, "p-3")}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Injury</p>
            <p
              className={cn(
                "mt-1 text-sm font-medium",
                prop.injuryImpact?.status === "None" || !prop.injuryImpact ? "text-emerald-300" : "text-amber-300",
              )}
            >
              {prop.injuryImpact?.status ?? "None"}
            </p>
          </section>
        </aside>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className={cn(panel, "p-3 sm:p-4")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold text-white">Home vs Away</h2>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["home", "away"] as const).map((key) => {
                  const split = prop.homeAway?.[key];
                  return (
                    <div key={key} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{key}</p>
                      <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">
                        {split?.average != null ? split.average.toFixed(1) : "—"}
                      </p>
                      <p className="text-[10px] text-neutral-500">{split?.samples ?? 0} samples</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Opponent</h2>
              <p className="mt-2 text-xs text-yellow-400/90">
                vs {prop.opponentHistory?.opponent ?? prop.opponent}
                {prop.opponentHistory?.average != null ? ` · avg ${prop.opponentHistory.average.toFixed(1)}` : ""}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">{prop.opponentDefense.note}</p>
            </div>
          </div>
        </section>

        <section className={cn(panel, "p-3 sm:p-4")} data-feature="line-movement">
          <h2 className="text-sm font-semibold text-white">Line movement</h2>
          <div className="mt-2">
            <LineMovementChart points={prop.movement} />
          </div>
        </section>
      </div>

      <ProOnly
        title="AI explanation"
        description="Standard keeps projection, hit rates, and line comparison. Upgrade to Pro for the AI writeup."
        ctaLabel="Upgrade to Pro"
      >
        <section className={cn(panel, "p-3 sm:p-4")} data-feature="ai-analysis">
          <h2 className="text-sm font-semibold text-white">AI explanation</h2>
          <ul className="mt-2 space-y-1.5">
            {(prop.analysis.length ? prop.analysis : [prop.why]).map((line) => (
              <li key={line} className="text-xs leading-relaxed text-neutral-400">
                <span className="mr-2 text-yellow-500">•</span>
                {line}
              </li>
            ))}
          </ul>
        </section>
      </ProOnly>

      {similar.length > 0 && (
        <section className={cn(panel, "p-3 sm:p-4")}>
          <h2 className="text-sm font-semibold text-white">Similar props</h2>
          <ul className="mt-2 space-y-1.5">
            {similar.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
              >
                <Link
                  href={propResearchPath(s.id)}
                  className="truncate text-xs font-medium text-neutral-100 hover:text-yellow-400"
                >
                  {s.player} · {s.market} {s.recommendation ?? s.side}{" "}
                  {Number(s.projectedValue ?? s.line).toFixed(1)}
                </Link>
                <ResearchScoreBadge score={s.researchScore} size="sm" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SidebarStat({
  label,
  value,
  sub,
  accent,
  dataFeature,
  compact,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "emerald" | "gold";
  dataFeature?: string;
  compact?: boolean;
}) {
  return (
    <div data-feature={dataFeature}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{label}</p>
      <p
        className={cn(
          "font-semibold tabular-nums",
          compact ? "mt-0.5 text-lg" : "mt-1.5 text-3xl",
          accent === "emerald" && "text-emerald-300",
          accent === "gold" && "text-yellow-400",
          !accent && "text-white",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-neutral-500">{sub}</p>}
    </div>
  );
}
