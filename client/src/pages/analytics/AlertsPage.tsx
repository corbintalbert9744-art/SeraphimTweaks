import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { PageHeader } from "@/components/shared/PageHeader";
import { LeagueBadge } from "@/components/shared/LeagueBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { CardSkeleton } from "@/components/shared/Skeleton";
import type { LeagueCode } from "@/data/mock";
import { propResearchPath } from "@/lib/playerLinks";
import {
  markNotificationsSeen,
  notificationsEnabled,
  setNotificationsEnabled,
  type AppNotification,
} from "@/lib/novigAlerts";
import { cn } from "@/lib/utils";

type AlertItem = {
  id: string;
  title: string;
  detail: string;
  league: LeagueCode;
  time: string;
  tone: "line" | "injury" | "research" | "system";
  propId?: string | null;
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
    refetchInterval: 300_000,
    staleTime: 60_000,
  });

  const enabled = notificationsEnabled();

  const alerts: AlertItem[] = useMemo(() => {
    const notes = (cc.data?.notifications ?? []) as AppNotification[];
    if (notes.length) {
      return notes.map((n) => ({
        id: n.id,
        title: n.title,
        detail: n.detail,
        league: (n.league as LeagueCode) || "NBA",
        time: n.createdAt
          ? new Date(n.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
          : "Live",
        tone: (n.tone as AlertItem["tone"]) || "research",
        propId: n.propId,
      }));
    }

    const injuries = (cc.data?.injuryAlerts ?? cc.data?.injuries ?? []) as Array<{
      player?: string;
      team?: string;
      status?: string;
      detail?: string;
    }>;
    const novig = (cc.data?.bestNoVigPicks ?? []) as Array<{
      id: string;
      player: string;
      market: string;
      side: string;
      line: number;
      league?: string;
      noVigEdgePct?: number;
    }>;

    return [
      ...novig.slice(0, 8).map((p) => ({
        id: `novig-${p.id}`,
        title: `No-vig pick · ${p.player}`,
        detail: `${p.side} ${p.line} ${p.market} · +${Number(p.noVigEdgePct ?? 0).toFixed(1)}% edge`,
        league: (p.league as LeagueCode) || "NBA",
        time: "Live",
        tone: "research" as const,
        propId: p.id,
      })),
      ...injuries.slice(0, 8).map((inj, i) => ({
        id: `inj-${i}`,
        title: inj.player ? `Injury · ${inj.player}` : "Injury update",
        detail: `${inj.team ?? ""} ${inj.status ?? ""} ${inj.detail ?? ""}`.trim() || "Injury feed",
        league: "NBA" as const,
        time: "Live",
        tone: "injury" as const,
        propId: null,
      })),
    ];
  }, [cc.data]);

  return (
    <div>
      <PageHeader
        eyebrow="Monitoring"
        title="Alerts"
        description="No-vig great picks refresh every 5 minutes, plus injury signals from Command Center."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setNotificationsEnabled(!enabled);
                window.location.reload();
              }}
              className="rounded-xl border border-[#1a1a1a] bg-[#111] px-3 py-2 text-sm text-neutral-300 transition hover:border-yellow-500/30 hover:text-yellow-400"
            >
              Notifications {enabled ? "On" : "Off"}
            </button>
            <Link
              href="/command-center"
              className="rounded-xl border border-[#1a1a1a] bg-[#111] px-3 py-2 text-sm text-neutral-300 transition hover:border-yellow-500/30 hover:text-yellow-400"
            >
              Command Center
            </Link>
          </div>
        }
      />

      {cc.isLoading ? (
        <div className="mt-6">
          <CardSkeleton rows={4} />
        </div>
      ) : alerts.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No alerts yet"
            description="When no-vig edges clear the bar, they’ll show up here automatically."
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {alerts.map((a) => (
            <li
              key={a.id}
              className={cn("rounded-2xl border px-4 py-4 transition hover:border-yellow-500/25", toneClass[a.tone])}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <LeagueBadge league={a.league} />
                    <p className="font-medium text-white">{a.title}</p>
                  </div>
                  <p className="mt-1 text-sm text-neutral-400">{a.detail}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-[11px] tabular-nums text-neutral-500">{a.time}</span>
                  {a.propId ? (
                    <Link
                      href={propResearchPath(a.propId)}
                      className="text-xs font-medium text-yellow-400 hover:underline"
                      onClick={() =>
                        markNotificationsSeen([
                          {
                            id: a.id,
                            title: a.title,
                            detail: a.detail,
                            propId: a.propId,
                          },
                        ])
                      }
                    >
                      Report
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
