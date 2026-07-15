import { useMemo, useState } from "react";
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
import { recomputeLegSide } from "@/lib/legStats";
import { cn } from "@/lib/utils";

function MovementChart({
  points,
}: {
  points: Array<{ label: string; line: number; odds: number }>;
}) {
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

export default function PropDetailPage() {
  const [, params] = useRoute("/prop/:id");
  const propId = params?.id ?? "";
  const prop = getPropDetail(propId);
  const { addLeg, hasLeg } = useParlayDraft();
  const [side, setSide] = useState<"Over" | "Under" | null>(null);

  const selectedSide = side ?? prop?.side ?? "Over";
  const best = useMemo(
    () => (prop ? bestBookForSide(prop, selectedSide) : null),
    [prop, selectedSide],
  );

  if (!prop || !best) {
    return (
      <div className="card-3d rounded-2xl border border-[#1a1a1a] p-10 text-center">
        <h1 className="text-xl font-semibold text-white">Report not found</h1>
        <p className="mt-2 text-sm text-neutral-400">No mock Research Report for “{propId}”.</p>
        <Link href="/research" className="mt-6 inline-block text-sm text-yellow-400 hover:underline">
          Back to Research Reports
        </Link>
      </div>
    );
  }

  const selectedOdds = selectedSide === "Over" ? best.over : best.under;
  const selectedNoVig = selectedSide === prop.side ? prop.noVigProb : prop.noVigOpposite;
  const selectedEv =
    selectedSide === prop.side ? prop.evPercent : Math.max(0.2, prop.evPercent - 2.4);
  const added = hasLeg(prop.id);

  const similar = prop.similarPropIds
    .map((id) => getPropDetail(id))
    .filter((p): p is PropDetail => Boolean(p));

  const currentPropId = prop.id;
  function handleAdd() {
    const leg = propIdToBuilderLeg(currentPropId);
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
        eyebrow="Research Report"
        title={`${prop.player} · ${prop.market}`}
        description={`${prop.team} vs ${prop.opponent} · ${prop.position} · ${prop.tipTime}`}
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
        <span className="text-xs text-neutral-600">
          Model lean: {prop.side} {prop.line}
        </span>
      </div>

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
            <p className="mt-1 text-xl font-semibold tabular-nums text-white">{prop.line}</p>
            <p className="mt-1 text-sm text-neutral-400">
              Best {formatAmericanOdds(s === "Over" ? bestBookForSide(prop, "Over").over : bestBookForSide(prop, "Under").under)}
              {s === prop.side && (
                <span className="ml-2 text-[10px] uppercase tracking-wider text-yellow-400">Recommended</span>
              )}
            </p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" data-feature="metrics-row">
        <Metric label="Best line" value={`${best.line} @ ${formatAmericanOdds(selectedOdds)}`} sub={best.book} />
        <Metric label="No-Vig" value={`${(selectedNoVig * 100).toFixed(1)}%`} dataFeature="no-vig" />
        <Metric label="EV" value={`+${selectedEv.toFixed(1)}%`} accent="emerald" />
        <Metric label="Confidence" value={`${prop.confidence}`} accent="gold" />
        <Metric label="Research Score" value={`${prop.researchScore}`} accent="gold" dataFeature="research-score-metric" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section
            data-feature="research-score"
            className="card-3d rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/[0.07] to-transparent p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-500/90">
                  Why this is rated highly
                </p>
                <h2 className="mt-2 text-lg font-semibold text-white">{prop.why}</h2>
              </div>
              <ResearchScoreBadge score={prop.researchScore} />
            </div>
            <ul className="mt-5 space-y-2">
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

          <section data-feature="hit-rates" className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <h2 className="text-base font-semibold text-white">Hit-rate visualization</h2>
            <p className="mt-1 text-xs text-neutral-500">Clear rate at the current line</p>
            <div className="mt-4">
              <HitRateBars prop={prop} />
            </div>
          </section>

          <section data-feature="line-movement" className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <h2 className="text-base font-semibold text-white">Line movement timeline</h2>
            <p className="mt-1 text-xs text-neutral-500">Open → current (mock series)</p>
            <div className="mt-4">
              <MovementChart points={prop.movement} />
            </div>
          </section>

          <section data-feature="ai-analysis" className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <h2 className="text-base font-semibold text-white">AI explanation</h2>
            <ul className="mt-3 space-y-2">
              {prop.analysis.map((line) => (
                <li key={line} className="text-sm leading-relaxed text-neutral-400">
                  <span className="mr-2 text-yellow-500">•</span>
                  {line}
                </li>
              ))}
            </ul>
          </section>

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
                        {s.player} · {s.market} {s.side} {s.line}
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
          <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Data Quality</h2>
              <span className="text-2xl font-semibold tabular-nums text-yellow-400">{prop.dqs}</span>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Trust in inputs (freshness, injuries, book agreement). Separate from Research Score and Confidence.
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-600 to-yellow-400"
                style={{ width: `${prop.dqs}%` }}
              />
            </div>
          </section>

          <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <h2 className="text-base font-semibold text-white">Sportsbook comparison</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Viewing {selectedSide} prices · best: {best.book}
            </p>
            <ul className="mt-3 space-y-2">
              {prop.books.map((b) => {
                const odds = selectedSide === "Over" ? b.over : b.under;
                const isBest = b.book === best.book;
                return (
                  <li
                    key={b.book}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
                      isBest ? "border-yellow-500/30 bg-yellow-500/10" : "border-[#1a1a1a] bg-black/20",
                    )}
                  >
                    <span className="text-neutral-400">
                      {b.book}
                      {isBest && <span className="ml-2 text-[10px] uppercase text-yellow-400">Best</span>}
                    </span>
                    <span className="tabular-nums text-neutral-200">
                      {b.line} · {formatAmericanOdds(odds)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <h2 className="text-base font-semibold text-white">Opponent defensive matchup</h2>
            <p className="mt-2 text-sm text-yellow-400/90">
              #{prop.opponentDefense.rank} of {prop.opponentDefense.of} · {prop.opponentDefense.label}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">{prop.opponentDefense.note}</p>
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
    <div
      data-feature={dataFeature}
      className="card-3d rounded-2xl border border-[#1a1a1a] p-4"
    >
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
