import { Link, useRoute } from "wouter";
import { ArrowLeft, Plus, Check } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { LeagueBadge } from "@/components/shared/LeagueBadge";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { getPlayerProfile, type PlayerProfile } from "@/data/playersMock";
import { getPropsForPlayer, formatAmericanOdds } from "@/data/propsCatalog";
import "@/data/registerLeagueProps";
import { nbaToBuilderLeg } from "@/lib/builderMappers";
import { nflToBuilderLeg } from "@/lib/builderMappers";
import { mockNbaProps } from "@/data/nbaMock";
import { mockNflProps } from "@/data/nflMock";
import { cn } from "@/lib/utils";

function addPropById(addLeg: (leg: ReturnType<typeof nbaToBuilderLeg>) => void, propId: string) {
  const nba = mockNbaProps.find((p) => p.id === propId);
  if (nba) {
    addLeg(nbaToBuilderLeg(nba));
    return;
  }
  const nfl = mockNflProps.find((p) => p.id === propId);
  if (nfl) addLeg(nflToBuilderLeg(nfl));
}

function ResearchChecklist({ profile }: { profile: PlayerProfile }) {
  return (
    <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Research Score</h2>
          <p className="text-xs text-neutral-500">Checklist-backed — not win probability</p>
        </div>
        <p className="text-3xl font-semibold tabular-nums text-yellow-400">{profile.researchScore}</p>
      </div>
      <ul className="space-y-2">
        {profile.checks.map((check) => (
          <li
            key={check.code}
            className={cn(
              "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
              check.status === "pass" && "border-emerald-500/20 bg-emerald-500/5 text-emerald-200",
              check.status === "warn" && "border-amber-500/20 bg-amber-500/5 text-amber-200",
              check.status === "fail" && "border-red-500/20 bg-red-500/5 text-red-200",
              check.status === "unknown" && "border-neutral-700 bg-white/[0.02] text-neutral-400",
            )}
          >
            <span className="mt-0.5 w-4 shrink-0 text-center">
              {check.status === "pass" ? "✓" : check.status === "fail" ? "✗" : check.status === "warn" ? "~" : "?"}
            </span>
            <span>{check.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function PlayerPage() {
  const [, params] = useRoute("/player/:id");
  const playerId = params?.id ?? "";
  const profile = getPlayerProfile(playerId);
  const { addLeg, hasLeg } = useParlayDraft();
  const linkedProps = getPropsForPlayer(playerId);

  if (!profile) {
    return (
      <div className="card-3d rounded-2xl border border-[#1a1a1a] p-10 text-center">
        <h1 className="text-xl font-semibold text-white">Player not found</h1>
        <p className="mt-2 text-sm text-neutral-400">Mock profile missing for “{playerId}”.</p>
        <Link href="/nba" className="mt-6 inline-block text-sm text-yellow-400 hover:underline">
          Back to NBA board
        </Link>
      </div>
    );
  }

  const avgKeys = Object.keys(profile.seasonAverages);

  return (
    <div>
      <Link
        href={profile.league === "NFL" ? "/nfl" : "/nba"}
        className="mb-4 inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-yellow-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {profile.league} board
      </Link>

      <PageHeader
        eyebrow="Player research"
        title={profile.name}
        description={profile.bio}
        actions={<ResearchScoreBadge score={profile.researchScore} />}
      />

      <div className="card-3d mb-6 rounded-2xl border border-[#1a1a1a] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-400/20 to-amber-700/10 text-lg font-semibold text-yellow-300">
              {profile.initials}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <LeagueBadge league={profile.league} />
                <span className="text-sm text-neutral-300">
                  {profile.team} vs {profile.opponent} · {profile.position}
                </span>
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                {profile.tipTime} · Workload {profile.projectedWorkload} · Injury{" "}
                <span className={profile.injury === "None" ? "text-emerald-300" : "text-amber-300"}>
                  {profile.injury}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {avgKeys.map((key) => (
            <div key={key} className="rounded-xl border border-[#1a1a1a] bg-black/25 px-3 py-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">{key}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                {profile.seasonAverages[key].toFixed(1)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <h2 className="text-base font-semibold text-white">Hit rates by market</h2>
            <p className="mt-1 text-xs text-neutral-500">L5 · L10 · L20 · Season at listed lines</p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-neutral-500">
                  <tr>
                    <th className="pb-3 font-medium">Market</th>
                    <th className="pb-3 font-medium">Line</th>
                    <th className="pb-3 font-medium">L5</th>
                    <th className="pb-3 font-medium">L10</th>
                    <th className="pb-3 font-medium">L20</th>
                    <th className="pb-3 font-medium">Season</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#151515]">
                  {profile.hitRates.map((row) => (
                    <tr key={`${row.market}-${row.line}`}>
                      <td className="py-3 text-neutral-200">{row.market}</td>
                      <td className="py-3 tabular-nums text-neutral-300">
                        {row.side} {row.line}
                      </td>
                      <td className="py-3 tabular-nums text-neutral-300">{row.l5}</td>
                      <td className="py-3 tabular-nums text-neutral-300">{row.l10}</td>
                      <td className="py-3 tabular-nums text-neutral-300">{row.l20}</td>
                      <td className="py-3 tabular-nums text-neutral-300">{row.season}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            {[profile.homeSplit, profile.awaySplit].map((split) => (
              <div key={split.label} className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
                <h3 className="text-sm font-semibold text-white">{split.label} splits</h3>
                <p className="mt-1 text-xs text-neutral-500">{split.samples} samples</p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {Object.entries(split.averages).map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-black/30 px-2 py-2 text-center">
                      <p className="text-[10px] uppercase text-neutral-500">{k}</p>
                      <p className="text-sm font-semibold tabular-nums text-neutral-100">{v.toFixed(1)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <h2 className="text-base font-semibold text-white">Recent game log</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-neutral-500">
                  <tr>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Opp</th>
                    <th className="pb-3 font-medium">H/A</th>
                    <th className="pb-3 font-medium">Result</th>
                    <th className="pb-3 font-medium">Stats</th>
                    <th className="pb-3 font-medium">Min/Snaps</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#151515]">
                  {profile.recentLogs.map((log) => (
                    <tr key={`${log.date}-${log.opponent}`}>
                      <td className="py-3 text-neutral-300">{log.date}</td>
                      <td className="py-3 text-neutral-200">{log.opponent}</td>
                      <td className="py-3 text-neutral-400">{log.home ? "Home" : "Away"}</td>
                      <td className="py-3 text-neutral-300">{log.result}</td>
                      <td className="py-3 text-xs tabular-nums text-neutral-400">
                        {Object.entries(log.stats)
                          .map(([k, v]) => `${v} ${k}`)
                          .join(" · ")}
                      </td>
                      <td className="py-3 tabular-nums text-neutral-300">{log.minutesOrSnaps}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <h2 className="text-base font-semibold text-white">Active props</h2>
            <p className="mt-1 text-xs text-neutral-500">Open markets linked to this player</p>
            <ul className="mt-4 space-y-2">
              {linkedProps.map((prop) => {
                const added = hasLeg(prop.id);
                return (
                  <li
                    key={prop.id}
                    className="flex flex-col gap-3 rounded-xl border border-[#1a1a1a] bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <Link href={`/prop/${prop.id}`} className="font-medium text-neutral-100 hover:text-yellow-400">
                        {prop.market} {prop.side} {prop.line}
                      </Link>
                      <p className="mt-1 text-xs text-neutral-500">
                        {formatAmericanOdds(prop.americanOdds)} · EV +{prop.evPercent.toFixed(1)}% · No-vig{" "}
                        {(prop.noVigProb * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ResearchScoreBadge score={prop.confidence} size="sm" />
                      <button
                        type="button"
                        disabled={added}
                        onClick={() => addPropById(addLeg, prop.id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
                          added
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20",
                        )}
                      >
                        {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        {added ? "Added" : "Add to Builder"}
                      </button>
                    </div>
                  </li>
                );
              })}
              {linkedProps.length === 0 && (
                <p className="text-sm text-neutral-500">No linked props in mock catalog.</p>
              )}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          <ResearchChecklist profile={profile} />

          <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <h2 className="text-base font-semibold text-white">{profile.matchup.title}</h2>
            <ul className="mt-3 space-y-2">
              {profile.matchup.bullets.map((b) => (
                <li key={b} className="text-sm leading-relaxed text-neutral-400">
                  <span className="mr-2 text-yellow-500">•</span>
                  {b}
                </li>
              ))}
            </ul>
          </section>

          <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <h2 className="text-base font-semibold text-white">Head-to-head</h2>
            <p className="mt-1 text-sm text-yellow-400/90">{profile.h2h.record}</p>
            <p className="mt-2 text-xs text-neutral-500">{profile.h2h.note}</p>
            <ul className="mt-4 space-y-2">
              {profile.h2h.meetings.map((m) => (
                <li
                  key={`${m.date}-${m.result}`}
                  className="flex items-center justify-between rounded-lg border border-[#1a1a1a] bg-black/20 px-3 py-2 text-xs"
                >
                  <span className="text-neutral-400">{m.date}</span>
                  <span className="text-neutral-200">{m.result}</span>
                  <span className="tabular-nums text-neutral-500">{m.line}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
