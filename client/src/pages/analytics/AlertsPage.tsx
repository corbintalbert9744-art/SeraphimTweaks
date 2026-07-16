import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { PageHeader } from "@/components/shared/PageHeader";
import { LeagueBadge } from "@/components/shared/LeagueBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { CardSkeleton } from "@/components/shared/Skeleton";
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

const toneClass: Record<AlertItem["tone"], string> = {
  line: "border-yellow-500/25 bg-yellow-500/[0.06]",
  injury: "border-amber-500/25 bg-amber-500/[0.06]",
  research: "border-emerald-500/25 bg-emerald-500/[0.06]",
  system: "border-[#1a1a1a] bg-black/25",
};

export default function AlertsPage() {
  const cc = useQuery({
    queryKey: ["command-center"],
    queryFn: async () => {
      const res = await fetch("/api/command-center");
      if (!res.ok) throw new Error("cc");
      return res.json();
    },
    staleTime: 60_000,
  });

  const injuries = (cc.data?.injuryAlerts ?? cc.data?.injuries ?? []) as Array<{
    player?: string;
    team?: string;
    status?: string;
    detail?: string;
  }>;

  const alerts: AlertItem[] = [
    ...(cc.data?.featured?.ok
      ? [
          {
            id: "featured",
            title: "Featured prop refreshed",
            detail: cc.data.featured.prop?.player
              ? `${cc.data.featured.prop.player} · ${cc.data.featured.prop.market ?? "lean"}`
              : "Command Center featured prop is live",
            league: "NBA" as const,
            time: "Live",
            tone: "research" as const,
          },
        ]
      : []),
    ...injuries.slice(0, 12).map((inj, i) => ({
      id: `inj-${i}`,
      title: inj.player ? `Injury · ${inj.player}` : "Injury update",
      detail: `${inj.team ?? ""} ${inj.status ?? ""} ${inj.detail ?? ""}`.trim() || "Injury feed",
      league: "NBA" as const,
      time: "Live",
      tone: "injury" as const,
    })),
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Monitoring"
        title="Alerts"
        description="Live injury and featured-prop signals from the Command Center warehouse."
        actions={
          <Link
            href="/research"
            className="rounded-xl border border-[#1a1a1a] bg-[#111] px-3 py-2 text-sm text-neutral-300 transition hover:border-yellow-500/30 hover:text-yellow-400"
          >
            Open Research
          </Link>
        }
      />

      {cc.isLoading && <CardSkeleton rows={3} />}

      {!cc.isLoading && alerts.length === 0 && (
        <EmptyState
          title="No live alerts"
          description="Start the data platform so Command Center injury and featured feeds can populate."
        />
      )}

      <ul className="mt-6 space-y-3">
        {alerts.map((alert) => (
          <li
            key={alert.id}
            className={cn("rounded-2xl border px-4 py-4 transition", toneClass[alert.tone])}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <LeagueBadge league={alert.league} />
                  <p className="font-medium text-neutral-100">{alert.title}</p>
                </div>
                <p className="mt-1 text-sm text-neutral-400">{alert.detail}</p>
              </div>
              <span className="text-xs text-neutral-500">{alert.time}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
