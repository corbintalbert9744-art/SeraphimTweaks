import { Link } from "wouter";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";

export function LeagueComingSoon({
  league,
  title,
  reason,
}: {
  league: string;
  title: string;
  reason: string;
}) {
  return (
    <div>
      <PageHeader
        eyebrow={league}
        title={title}
        description={reason}
        actions={
          <Link
            href="/nba"
            className="btn-3d rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 px-4 py-2 text-sm font-semibold text-black"
          >
            Open live NBA board
          </Link>
        }
      />
      <div className="mt-6">
        <EmptyState
          title="Live data not available yet"
          description={`${league} will appear here once a legitimate provider is connected. Mock slates have been removed.`}
        />
        <p className="mt-4 text-center text-xs text-neutral-600">
          Check provider status at{" "}
          <Link href="/settings" className="text-yellow-500/80 hover:text-yellow-400">
            Settings
          </Link>{" "}
          or <code className="text-neutral-500">GET /api/v1/providers</code>.
        </p>
      </div>
    </div>
  );
}
