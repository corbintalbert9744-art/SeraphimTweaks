import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { TopPropsTable } from "@/components/dashboard/TopPropsTable";
import { HighestEvSection } from "@/components/dashboard/HighestEvSection";
import { LineMovementSection } from "@/components/dashboard/LineMovementSection";
import { RecentUpdatesFeed } from "@/components/dashboard/RecentUpdatesFeed";
import { PlaceholderChart } from "@/components/dashboard/PlaceholderChart";
import {
  mockChartEvTrend,
  mockChartVolume,
  mockEvLeaders,
  mockFeed,
  mockLineMovements,
  mockStatCards,
  mockTopProps,
} from "@/data/mock";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Seraphim Analytics"
        title="Research Dashboard"
        description="Edge, Research Score, and Data Quality in one place. Mock data only — ready to connect providers later."
        actions={
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[#1a1a1a] bg-[#111] px-3 py-1.5 text-xs text-neutral-400">
              Data as of · mock 2m ago
            </span>
            <button
              type="button"
              className="btn-3d rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 px-4 py-2 text-sm font-semibold text-black"
            >
              Refresh board
            </button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {mockStatCards.map((card) => (
          <StatCard key={card.id} card={card} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TopPropsTable rows={mockTopProps} />
        </div>
        <div className="space-y-6">
          <HighestEvSection leaders={mockEvLeaders} />
          <RecentUpdatesFeed items={mockFeed} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <LineMovementSection items={mockLineMovements} />
        <div className="grid gap-6">
          <PlaceholderChart
            title="Avg Top-Board EV (7d)"
            subtitle="Placeholder trend — swap for Recharts later"
            data={mockChartEvTrend}
            variant="area"
          />
          <PlaceholderChart
            title="Props by League"
            subtitle="Volume snapshot (mock)"
            data={mockChartVolume}
            variant="bars"
          />
        </div>
      </div>
    </div>
  );
}
