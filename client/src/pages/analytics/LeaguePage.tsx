import { PageHeader } from "@/components/shared/PageHeader";
import { TopPropsTable } from "@/components/dashboard/TopPropsTable";
import { StatCard } from "@/components/dashboard/StatCard";
import { leagueMeta, mockTopProps, type LeagueCode } from "@/data/mock";

export default function LeaguePage({ league }: { league: LeagueCode }) {
  const meta = leagueMeta[league];
  const rows = mockTopProps.filter((p) => p.league === league);
  const fallbackRows = rows.length > 0 ? rows : mockTopProps.slice(0, 3);

  return (
    <div>
      <PageHeader
        eyebrow="League hub"
        title={meta.name}
        description={meta.blurb}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          card={{
            id: "games",
            label: "Games / Matches Today",
            value: String(meta.gamesToday),
            delta: "Mock slate",
            deltaTone: "neutral",
            hint: "Schedule adapter placeholder",
          }}
        />
        <StatCard
          card={{
            id: "props",
            label: "Live Props",
            value: String(meta.propsLive),
            delta: "Tracked",
            deltaTone: "up",
            hint: "Markets awaiting real odds feed",
          }}
        />
        <StatCard
          card={{
            id: "quality",
            label: "Board Health",
            value: "Good",
            delta: "DQS stable",
            deltaTone: "up",
            hint: "Mock freshness indicator",
          }}
        />
      </div>

      <div className="mt-6">
        <TopPropsTable rows={fallbackRows} />
      </div>

      <div className="card-3d mt-6 rounded-2xl border border-dashed border-yellow-500/20 bg-yellow-500/[0.03] p-6">
        <p className="text-sm font-medium text-yellow-400">Coming online with live providers</p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-400">
          Event boards, player pages, and prop detail for {meta.name} will bind to the canonical API.
          This hub is structured so adapters can feed the same components without UI rewrites.
        </p>
      </div>
    </div>
  );
}
