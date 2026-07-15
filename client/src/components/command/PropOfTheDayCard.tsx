import { Link } from "wouter";
import { Check, Plus } from "lucide-react";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { withLegHitData } from "@/lib/legStats";
import { cn } from "@/lib/utils";
import { useIsPro } from "@/components/membership/ProOnly";

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

export function PropOfTheDayCard({ prop }: { prop: PropOfDay }) {
  const { addLeg, hasLeg } = useParlayDraft();
  const isPro = useIsPro();
  const added = hasLeg(prop.id);
  const why = isPro ? prop.why : undefined;
  const initials = (prop.shortName ?? prop.player)
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function handleAdd() {
    if (added) return;
    addLeg(
      withLegHitData({
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
      }),
    );
  }

  const recent = prop.recent?.slice(0, 10) ?? [];
  const maxRecent = recent.length
    ? Math.max(...recent.map((r) => r.value), prop.line) * 1.1
    : 1;

  return (
    <section className="rounded-xl border border-yellow-500/20 bg-[#0c0c0c] p-4 transition hover:border-yellow-500/35">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {prop.headshot ? (
            <img
              src={prop.headshot}
              alt=""
              className="h-10 w-10 shrink-0 rounded-lg border border-[#1a1a1a] object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#1a1a1a] bg-yellow-500/10 text-[11px] font-semibold text-yellow-400">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-yellow-500/80">
              Prop of the Day
            </p>
            <h2 className="truncate text-base font-semibold text-white">{prop.player}</h2>
            <p className="truncate text-xs text-neutral-400">
              <span className="text-yellow-400/90">
                {prop.side} {prop.line}
              </span>{" "}
              {prop.market} · {prop.team} vs {prop.opponent}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <ResearchScoreBadge score={prop.researchScore} size="sm" />
          {why && (
            <span className="hidden rounded border border-[#2a2a2a] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400 sm:inline">
              {why.verdict}
            </span>
          )}
        </div>
      </div>

      {why && (
        <p className="mt-3 text-xs leading-relaxed text-neutral-400">{why.headline}</p>
      )}
      {!isPro && (
        <p className="mt-3 rounded-lg border border-yellow-500/20 bg-yellow-500/[0.04] px-3 py-2 text-xs text-neutral-400">
          Premium insight writeup is Pro-only. Standard still includes EV, confidence, Research Score,
          L10, and the checklist.{" "}
          <Link href="/pricing" className="font-medium text-yellow-400 hover:underline">
            Upgrade to Pro
          </Link>
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-neutral-300">
        <span>
          EV <span className="text-emerald-300">+{prop.evPercent.toFixed(1)}%</span>
        </span>
        <span>
          Conf <span className="text-neutral-100">{prop.confidence}</span>
        </span>
        <span>
          No-vig <span className="text-neutral-100">{(prop.noVigProb * 100).toFixed(0)}%</span>
        </span>
        <span>
          L10 <span className="text-neutral-100">{prop.l10}</span>
        </span>
      </div>

      {why && (
        <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {why.pillars.map((pillar) => (
            <div
              key={pillar.id}
              title={pillar.detail}
              className="flex items-baseline justify-between gap-2 rounded-lg border border-[#1a1a1a] bg-black/30 px-2.5 py-1.5"
            >
              <span className="text-[10px] uppercase tracking-wide text-neutral-500">{pillar.title}</span>
              <span className="truncate text-xs text-neutral-200">{pillar.summary}</span>
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-[10px] text-neutral-500">
            <span>Last {recent.length} vs line</span>
            <span>
              {prop.l5 ? `L5 ${prop.l5} · ` : ""}L10 {prop.l10}
            </span>
          </div>
          <div className="flex h-10 items-end gap-0.5">
            {recent.map((g, i) => (
              <div
                key={`${g.opponent}-${i}`}
                className={cn(
                  "flex-1 rounded-t-[2px]",
                  g.hit ? "bg-emerald-500/70" : "bg-red-500/50",
                )}
                style={{ height: `${Math.max(15, (g.value / maxRecent) * 100)}%` }}
                title={`${g.opponent}: ${g.value}`}
              />
            ))}
          </div>
        </div>
      )}

      {prop.checks && prop.checks.length > 0 && (
        <details className="mt-3 group">
          <summary className="cursor-pointer list-none text-[11px] text-neutral-500 transition hover:text-neutral-300">
            Research checklist
            <span className="ml-1 text-neutral-600 group-open:hidden">▸</span>
            <span className="ml-1 hidden text-neutral-600 group-open:inline">▾</span>
          </summary>
          <ul className="mt-2 space-y-1">
            {prop.checks.map((c) => (
              <li key={c.code} className="text-[11px] text-neutral-400">
                <span className="mr-1 text-neutral-600">{c.status === "pass" ? "✓" : "~"}</span>
                {c.label}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={added}
          onClick={handleAdd}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
            added
              ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
              : "bg-yellow-500 text-black hover:bg-yellow-400",
          )}
        >
          {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {added ? "Added" : "Add to Builder"}
        </button>
        <Link href="/nba" className="text-xs text-neutral-500 hover:text-yellow-400">
          NBA board
        </Link>
        <Link href="/parlay-builder" className="text-xs text-neutral-500 hover:text-yellow-400">
          Slip
        </Link>
      </div>
    </section>
  );
}
