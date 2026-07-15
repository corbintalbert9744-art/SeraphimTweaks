import { Link } from "wouter";
import { PageHeader } from "@/components/shared/PageHeader";
import { LeagueBadge } from "@/components/shared/LeagueBadge";
import type { LeagueCode } from "@/data/mock";
import { cn } from "@/lib/utils";

type AlertItem = {
  id: string;
  title: string;
  detail: string;
  league: LeagueCode;
  time: string;
  tone: "line" | "injury" | "research" | "system";
};

const mockAlerts: AlertItem[] = [
  {
    id: "a1",
    title: "Line moved +1.5 on Tatum Points",
    detail: "27.5 → 29.0 across sharp books. Re-check Research Score before locking.",
    league: "NBA",
    time: "4m ago",
    tone: "line",
  },
  {
    id: "a2",
    title: "Injury flag: KC skill group",
    detail: "Doubtful designation raised Data Quality penalty on correlated Chiefs props.",
    league: "NFL",
    time: "18m ago",
    tone: "injury",
  },
  {
    id: "a3",
    title: "Research Score refreshed — Miami Open",
    detail: "ATP adapter finished slate recalc. 6 props crossed RS ≥ 85.",
    league: "ATP",
    time: "42m ago",
    tone: "research",
  },
  {
    id: "a4",
    title: "WNBA board heartbeat OK",
    detail: "Collector cycle complete. No missing books in the last 15 minutes.",
    league: "WNBA",
    time: "1h ago",
    tone: "system",
  },
  {
    id: "a5",
    title: "WTA total games steam",
    detail: "Soft book lagged 8¢ vs consensus. EV window may be short-lived.",
    league: "WTA",
    time: "2h ago",
    tone: "line",
  },
];

const toneClass: Record<AlertItem["tone"], string> = {
  line: "border-yellow-500/25 bg-yellow-500/[0.06]",
  injury: "border-amber-500/25 bg-amber-500/[0.06]",
  research: "border-emerald-500/25 bg-emerald-500/[0.06]",
  system: "border-[#1a1a1a] bg-black/25",
};

export default function AlertsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Monitoring"
        title="Alerts"
        description="Line moves, injury flags, and research refresh signals — mock feed until jobs are wired."
        actions={
          <Link
            href="/research"
            className="rounded-xl border border-[#1a1a1a] bg-[#111] px-3 py-2 text-sm text-neutral-300 transition hover:border-yellow-500/30 hover:text-yellow-400"
          >
            Open Research
          </Link>
        }
      />

      <ul className="space-y-3">
        {mockAlerts.map((alert) => (
          <li
            key={alert.id}
            className={cn("card-3d rounded-2xl border p-4 transition hover:border-yellow-500/20", toneClass[alert.tone])}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <LeagueBadge league={alert.league} />
                  <span className="text-[11px] uppercase tracking-wider text-neutral-500">{alert.tone}</span>
                </div>
                <p className="mt-2 font-medium text-neutral-100">{alert.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-neutral-400">{alert.detail}</p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-neutral-500">{alert.time}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
