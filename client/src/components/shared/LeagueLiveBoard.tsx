/** Lightweight MLB/NHL/Soccer board pages backed by warehouse props. */

import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { CardSkeleton } from "@/components/shared/Skeleton";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";

type LeagueProp = {
  id: string;
  player: string;
  team: string;
  market: string;
  side: string;
  line: number;
  projectedValue?: number;
  edgeVsLine?: number | null;
  researchScore?: number;
  confidence?: number;
  l10?: string;
};

function LeagueLiveBoard({
  league,
  title,
  gamesPath,
  propsPath,
  fallbackReason,
}: {
  league: string;
  title: string;
  gamesPath: string;
  propsPath: string;
  fallbackReason: string;
}) {
  const games = useQuery({
    queryKey: [`${league}-games`],
    queryFn: async () => {
      const res = await fetch(gamesPath);
      if (!res.ok) throw new Error("games");
      return res.json() as Promise<{ games: unknown[]; live?: boolean; requiresApiKey?: boolean; error?: string }>;
    },
    staleTime: 60_000,
    retry: 1,
  });

  const board = useQuery({
    queryKey: [`${league}-board`],
    queryFn: async () => {
      const res = await fetch(propsPath);
      if (!res.ok) throw new Error("board");
      return res.json() as Promise<{
        props: LeagueProp[];
        count: number;
        live?: boolean;
        note?: string | null;
        requiresApiKey?: boolean;
        disclaimer?: string;
      }>;
    },
    staleTime: 60_000,
    retry: 1,
  });

  const props = board.data?.props ?? [];
  const loading = games.isLoading || board.isLoading;
  const blocked =
    games.data?.requiresApiKey ||
    board.data?.requiresApiKey ||
    (games.isError && board.isError);

  return (
    <div>
      <PageHeader
        eyebrow={league}
        title={title}
        description={
          board.data?.disclaimer ||
          `${league} research board from the Seraphim warehouse (Projection Engine V1).`
        }
        actions={
          <Link
            href="/nba"
            className="btn-3d rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 px-4 py-2 text-sm font-semibold text-black"
          >
            Open NBA board
          </Link>
        }
      />

      {loading ? (
        <div className="mt-6 grid gap-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : blocked && props.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Live data not available yet" description={fallbackReason} />
          <p className="mt-4 text-center text-xs text-neutral-600">
            {games.data?.error || board.data?.note || "Check GET /api/v1/providers for configuration."}
          </p>
        </div>
      ) : props.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No props in warehouse yet"
            description={`Run a sync (POST /api/v1/${league.toLowerCase()}/jobs/sync) or wait for the multi-sport scheduler. ${fallbackReason}`}
          />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-neutral-400">
              <tr>
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2">Line</th>
                <th className="px-3 py-2">Proj</th>
                <th className="px-3 py-2">Edge</th>
                <th className="px-3 py-2">L10</th>
                <th className="px-3 py-2">RS</th>
              </tr>
            </thead>
            <tbody>
              {props.slice(0, 80).map((p) => (
                <tr key={p.id} className="border-t border-white/5">
                  <td className="px-3 py-2">
                    <div className="font-medium text-neutral-100">{p.player}</div>
                    <div className="text-xs text-neutral-500">
                      {p.team} · {p.side}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-neutral-300">{p.market}</td>
                  <td className="px-3 py-2">{p.line}</td>
                  <td className="px-3 py-2">{p.projectedValue?.toFixed?.(1) ?? "—"}</td>
                  <td className="px-3 py-2">{p.edgeVsLine?.toFixed?.(2) ?? "—"}</td>
                  <td className="px-3 py-2 text-neutral-400">{p.l10 ?? "—"}</td>
                  <td className="px-3 py-2">
                    <ResearchScoreBadge score={p.researchScore ?? p.confidence ?? 50} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-white/5 px-3 py-2 text-xs text-neutral-500">
            {props.length} props · model estimates from imported logs — not sportsbook copies.
          </p>
        </div>
      )}
    </div>
  );
}

export function MlbLivePage() {
  return (
    <LeagueLiveBoard
      league="MLB"
      title="MLB Research Board"
      gamesPath="/api/mlb/games"
      propsPath="/api/mlb/props"
      fallbackReason="MLB Stats API adapter is wired; start the data platform and run a sync if the board is empty."
    />
  );
}

export function NhlLivePage() {
  return (
    <LeagueLiveBoard
      league="NHL"
      title="NHL Research Board"
      gamesPath="/api/nhl/games"
      propsPath="/api/nhl/props"
      fallbackReason="NHL API adapter is wired; start the data platform and run a sync if the board is empty."
    />
  );
}

export function SoccerLivePage() {
  return (
    <LeagueLiveBoard
      league="Soccer"
      title="Soccer Research Board"
      gamesPath="/api/soccer/games"
      propsPath="/api/soccer/props"
      fallbackReason="REQUIRES FOOTBALL_DATA_API_KEY (free tier). Without it we do not fabricate fixtures or props."
    />
  );
}
