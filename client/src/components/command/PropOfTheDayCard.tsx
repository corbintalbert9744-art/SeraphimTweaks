import { Link } from "wouter";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { cn } from "@/lib/utils";

export type PropOfDay = {
  id: string;
  player: string;
  shortName?: string;
  headshot?: string;
  team: string;
  opponent: string;
  market: string;
  side: string;
  line: number;
  evPercent: number;
  confidence: number;
  researchScore: number;
  dqs: number;
  noVigProb: number;
  l10: string;
  explanation: string[];
};

export function PropOfTheDayCard({ prop }: { prop: PropOfDay }) {
  return (
    <section className="card-3d-popular overflow-hidden rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/[0.12] via-[#0c0c0c] to-transparent p-5 transition duration-300 hover:border-yellow-500/50 hover:shadow-[0_0_40px_-16px_rgba(234,179,8,0.45)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-500/90">
            Prop of the Day
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
            {prop.player} · {prop.market}
          </h2>
          <p className="mt-1 text-sm text-neutral-400">
            {prop.side} {prop.line} · {prop.team} vs {prop.opponent}
          </p>
        </div>
        <ResearchScoreBadge score={prop.researchScore} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "EV", value: `+${prop.evPercent.toFixed(1)}%`, tone: "text-emerald-300" },
          { label: "Confidence", value: `${prop.confidence}`, tone: "text-yellow-400" },
          { label: "No-vig", value: `${(prop.noVigProb * 100).toFixed(1)}%`, tone: "text-neutral-100" },
          { label: "L10", value: prop.l10, tone: "text-neutral-100" },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-white/5 bg-black/30 px-3 py-3">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">{m.label}</p>
            <p className={cn("mt-1 text-lg font-semibold tabular-nums", m.tone)}>{m.value}</p>
          </div>
        ))}
      </div>

      <ul className="mt-5 space-y-2">
        {prop.explanation.slice(0, 3).map((line) => (
          <li key={line} className="text-sm leading-relaxed text-neutral-400">
            <span className="mr-2 text-yellow-500">•</span>
            {line}
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href="/nba"
          className="btn-3d inline-flex rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:brightness-105"
        >
          Open NBA board
        </Link>
        <span className="text-xs text-neutral-500">DQS {prop.dqs} · Research Score is checklist-backed</span>
      </div>
    </section>
  );
}
