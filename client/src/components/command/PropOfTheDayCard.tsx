import { Link } from "wouter";
import { Check, Plus } from "lucide-react";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { withLegHitData } from "@/lib/legStats";
import { cn } from "@/lib/utils";

export type WhyPillar = {
  id: string;
  title: string;
  status: "strong" | "solid" | "watch";
  summary: string;
  detail: string;
};

export type PropOfDay = {
  id: string;
  player: string;
  shortName?: string;
  headshot?: string;
  team: string;
  opponent: string;
  market: string;
  side: "Over" | "Under" | string;
  line: number;
  tipTime?: string;
  gameLabel?: string;
  americanOdds?: number;
  evPercent: number;
  confidence: number;
  researchScore: number;
  dqs: number;
  noVigProb: number;
  l5?: string;
  l10: string;
  l20?: string;
  explanation: string[];
  why?: {
    headline: string;
    verdict: "strong" | "solid" | "watch";
    pillars: WhyPillar[];
  };
  linePath?: Array<{ t: string; line: number }>;
  recent?: Array<{ value: number; opponent: string; hit: boolean }>;
  checks?: Array<{ code: string; status: string; label: string }>;
  playerId?: string;
  position?: string;
  league?: string;
};

const statusTone = {
  strong: "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-200",
  solid: "border-yellow-500/25 bg-yellow-500/[0.07] text-yellow-100",
  watch: "border-amber-500/25 bg-amber-500/[0.07] text-amber-100",
};

function MiniLinePath({ points }: { points: Array<{ t: string; line: number }> }) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.line);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 220;
  const h = 56;
  const coords = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - 8 - ((v - min) / range) * (h - 16);
    return `${x},${y}`;
  });
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-14 w-full">
        <polyline
          fill="none"
          stroke="rgb(250, 204, 21)"
          strokeWidth="2.5"
          points={coords.join(" ")}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex justify-between text-[10px] text-neutral-500">
        {points.map((p) => (
          <span key={p.t}>
            {p.t} · {p.line}
          </span>
        ))}
      </div>
    </div>
  );
}

function MiniFormBars({ recent, line }: { recent: NonNullable<PropOfDay["recent"]>; line: number }) {
  const max = Math.max(...recent.map((r) => r.value), line) * 1.1;
  return (
    <div className="flex h-20 items-end gap-1">
      {recent.slice(0, 10).map((g, i) => (
        <div key={`${g.opponent}-${i}`} className="flex flex-1 flex-col items-center justify-end">
          <div
            className={cn(
              "w-full max-w-[14px] rounded-t-sm transition-all duration-500",
              g.hit ? "bg-emerald-400/90" : "bg-red-400/70",
            )}
            style={{ height: `${Math.max(12, (g.value / max) * 100)}%` }}
            title={`${g.opponent}: ${g.value}`}
          />
        </div>
      ))}
    </div>
  );
}

export function PropOfTheDayCard({ prop }: { prop: PropOfDay }) {
  const { addLeg, hasLeg } = useParlayDraft();
  const added = hasLeg(prop.id);
  const why = prop.why;
  const initials = (prop.shortName ?? prop.player)
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function handleAdd() {
    if (added) return;
    const leg = withLegHitData({
      id: prop.id,
      league: (prop.league as "NBA") ?? "NBA",
      playerId: prop.playerId ?? prop.id,
      player: prop.player,
      team: prop.team,
      opponent: prop.opponent,
      position: prop.position ?? "G",
      market: prop.market,
      side: (prop.side === "Under" ? "Under" : "Over") as "Over" | "Under",
      line: prop.line,
      americanOdds: prop.americanOdds ?? -110,
      noVigProb: prop.noVigProb,
      evPercent: prop.evPercent,
      confidence: prop.confidence,
      tipTime: prop.tipTime ?? "Tonight",
      eventKey: `${prop.team}-${prop.opponent}-${prop.tipTime ?? "slate"}`,
      l10: prop.l10,
    });
    addLeg(leg);
  }

  return (
    <section className="card-3d-popular overflow-hidden rounded-2xl border border-yellow-500/35 bg-gradient-to-br from-yellow-500/[0.14] via-[#0b0b0b] to-[#0a0a0a] p-5 sm:p-6 transition duration-300 hover:border-yellow-500/55 hover:shadow-[0_0_48px_-14px_rgba(234,179,8,0.5)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {prop.headshot ? (
            <img
              src={prop.headshot}
              alt=""
              className="h-16 w-16 shrink-0 rounded-2xl border border-yellow-500/30 object-cover bg-[#111]"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-400/20 to-amber-700/10 text-sm font-semibold text-yellow-300">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-500/90">
              Prop of the Day
            </p>
            <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-white sm:text-2xl">
              {prop.player}
            </h2>
            <p className="mt-1 text-sm text-neutral-300">
              <span className="font-medium text-yellow-300">
                {prop.side} {prop.line}
              </span>{" "}
              {prop.market}
              <span className="text-neutral-600"> · </span>
              {prop.team} vs {prop.opponent}
            </p>
            {(prop.gameLabel || prop.tipTime) && (
              <p className="mt-1 text-xs text-neutral-500">
                {prop.gameLabel}
                {prop.tipTime ? ` · ${new Date(prop.tipTime).toLocaleString()}` : ""}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <ResearchScoreBadge score={prop.researchScore} />
          {why && (
            <span
              className={cn(
                "rounded-lg border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider",
                why.verdict === "strong" && "border-emerald-500/35 bg-emerald-500/10 text-emerald-300",
                why.verdict === "solid" && "border-yellow-500/35 bg-yellow-500/10 text-yellow-300",
                why.verdict === "watch" && "border-amber-500/35 bg-amber-500/10 text-amber-300",
              )}
            >
              {why.verdict} lean
            </span>
          )}
        </div>
      </div>

      {why && (
        <div className="mt-5 rounded-2xl border border-yellow-500/20 bg-black/25 p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-500/90">
            Why this is the strongest play
          </p>
          <p className="mt-2 text-base font-medium leading-snug text-neutral-100 sm:text-lg">{why.headline}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {why.pillars.map((pillar) => (
              <div
                key={pillar.id}
                className={cn(
                  "rounded-xl border px-3 py-3 transition duration-300 hover:-translate-y-0.5",
                  statusTone[pillar.status],
                )}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{pillar.title}</p>
                <p className="mt-1.5 text-sm font-semibold text-white">{pillar.summary}</p>
                <p className="mt-1.5 text-[11px] leading-relaxed opacity-80">{pillar.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-2 lg:grid-cols-4">
          {[
            { label: "EV", value: `+${prop.evPercent.toFixed(1)}%`, tone: "text-emerald-300" },
            { label: "Confidence", value: `${prop.confidence}`, tone: "text-yellow-400" },
            { label: "No-vig", value: `${(prop.noVigProb * 100).toFixed(1)}%`, tone: "text-neutral-100" },
            { label: "DQS", value: `${prop.dqs}`, tone: "text-neutral-100" },
          ].map((m) => (
            <div key={m.label} className="rounded-xl border border-white/5 bg-black/30 px-3 py-3">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">{m.label}</p>
              <p className={cn("mt-1 text-lg font-semibold tabular-nums", m.tone)}>{m.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[#1a1a1a] bg-black/30 px-3 py-3">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Line path</p>
          <div className="mt-2">
            {prop.linePath ? (
              <MiniLinePath points={prop.linePath} />
            ) : (
              <p className="text-xs text-neutral-500">Movement pending books adapter</p>
            )}
          </div>
        </div>
      </div>

      {prop.recent && prop.recent.length > 0 && (
        <div className="mt-5 rounded-xl border border-[#1a1a1a] bg-black/25 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-neutral-200">Recent form vs {prop.line}</p>
            <p className="text-xs text-neutral-500">
              L5 {prop.l5 ?? "—"} · L10 {prop.l10}
              {prop.l20 ? ` · L20 ${prop.l20}` : ""}
            </p>
          </div>
          <MiniFormBars recent={prop.recent} line={prop.line} />
          <div className="mt-2 flex justify-between text-[10px] text-neutral-600">
            <span>Oldest →</span>
            <span className="inline-flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Hit
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400/80" /> Miss
              </span>
            </span>
          </div>
        </div>
      )}

      {prop.checks && prop.checks.length > 0 && (
        <div className="mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Research checklist
          </p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {prop.checks.map((c) => (
              <li
                key={c.code}
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs",
                  c.status === "pass" && "border-emerald-500/20 bg-emerald-500/5 text-emerald-200",
                  c.status === "warn" && "border-amber-500/20 bg-amber-500/5 text-amber-200",
                  c.status === "fail" && "border-red-500/20 bg-red-500/5 text-red-200",
                  c.status === "unknown" && "border-neutral-700 bg-white/[0.02] text-neutral-400",
                )}
              >
                <span className="mr-1.5 opacity-70">{c.status === "pass" ? "✓" : "~"}</span>
                {c.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={added}
          onClick={handleAdd}
          className={cn(
            "btn-3d inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
            added
              ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
              : "bg-gradient-to-b from-yellow-400 to-amber-500 text-black hover:brightness-105",
          )}
        >
          {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {added ? "In Builder" : "Add to Builder"}
        </button>
        <Link
          href="/nba"
          className="rounded-xl border border-[#1a1a1a] bg-[#111] px-4 py-2.5 text-sm text-neutral-300 transition hover:border-yellow-500/30 hover:text-yellow-400"
        >
          Open NBA board
        </Link>
        <Link
          href="/parlay-builder"
          className="text-sm text-neutral-500 transition hover:text-yellow-400"
        >
          View slip →
        </Link>
      </div>
    </section>
  );
}
