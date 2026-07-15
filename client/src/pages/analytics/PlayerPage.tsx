import { Link, useRoute } from "wouter";
import { ArrowLeft, Plus, Check, Flame, Snowflake, Minus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { LeagueBadge } from "@/components/shared/LeagueBadge";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { getPlayerProfile, type PlayerProfile, type PlayerStreak } from "@/data/playersMock";
import { getPropsForPlayer, formatAmericanOdds } from "@/data/propsCatalog";
import "@/data/registerLeagueProps";
import { propIdToBuilderLeg } from "@/lib/addPropToBuilder";
import { cn } from "@/lib/utils";

function PerformanceChart({
  logs,
  line,
  label,
}: {
  logs: PlayerProfile["recentLogs"];
  line: number;
  label: string;
}) {
  const values = logs.map((l) => l.primary).reverse();
  const labels = logs.map((l) => l.date).reverse();
  const max = Math.max(...values, line) * 1.12;
  const min = Math.min(...values, line) * 0.85;
  const range = max - min || 1;
  const w = 420;
  const h = 160;
  const pad = 16;
  const coords = values.map((v, i) => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return { x, y, v };
  });
  const lineY = h - pad - ((line - min) / range) * (h - pad * 2);
  const poly = coords.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
        <span>
          {label} vs betting line <span className="tabular-nums text-yellow-400">{line}</span>
        </span>
        <span className="text-neutral-600">Recent games →</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full">
        <line x1={pad} y1={lineY} x2={w - pad} y2={lineY} stroke="rgba(250,204,21,0.45)" strokeWidth="1.5" strokeDasharray="6 4" />
        <polyline
          fill="none"
          stroke="rgb(250, 204, 21)"
          strokeWidth="2.5"
          points={poly}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((c, i) => (
          <g key={labels[i]}>
            <circle cx={c.x} cy={c.y} r="4" fill="#0a0a0a" stroke="rgb(250, 204, 21)" strokeWidth="2" />
            <text x={c.x} y={h - 2} textAnchor="middle" className="fill-neutral-600" fontSize="9">
              {labels[i]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function StreakChip({ streak }: { streak: PlayerStreak }) {
  const Icon = streak.tone === "hot" ? Flame : streak.tone === "cold" ? Snowflake : Minus;
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        streak.tone === "hot" && "border-orange-500/25 bg-orange-500/10",
        streak.tone === "cold" && "border-sky-500/25 bg-sky-500/10",
        streak.tone === "neutral" && "border-[#1a1a1a] bg-black/25",
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-100">
        <Icon className="h-3.5 w-3.5 text-yellow-400" />
        {streak.label}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{streak.detail}</p>
    </div>
  );
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
        <Link href="/players" className="mt-6 inline-block text-sm text-yellow-400 hover:underline">
          Back to Player Profiles
        </Link>
      </div>
    );
  }

  const avgKeys = Object.keys(profile.seasonAverages);
  const recommended = profile.recommendedPropIds;
  const allRecommendedAdded = recommended.every((id) => hasLeg(id));

  function addProp(propId: string) {
    const leg = propIdToBuilderLeg(propId);
    if (leg) addLeg(leg);
  }

  function addAllRecommended() {
    for (const id of recommended) {
      if (!hasLeg(id)) addProp(id);
    }
  }

  const boardHref =
    profile.league === "NFL"
      ? "/nfl"
      : profile.league === "WNBA"
        ? "/wnba"
        : profile.league === "ATP"
          ? "/atp"
          : profile.league === "WTA"
            ? "/wta"
            : "/nba";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Link href="/players" className="inline-flex items-center gap-2 text-neutral-400 transition hover:text-yellow-400">
          <ArrowLeft className="h-4 w-4" />
          Player Profiles
        </Link>
        <span className="text-neutral-700">·</span>
        <Link href={boardHref} className="text-neutral-500 hover:text-yellow-400">
          {profile.league} board
        </Link>
      </div>

      <PageHeader
        eyebrow="Player Profile"
        title={profile.name}
        description={profile.bio}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ResearchScoreBadge score={profile.researchScore} />
            <button
              type="button"
              disabled={allRecommendedAdded || recommended.length === 0}
              onClick={addAllRecommended}
              className={cn(
                "btn-3d inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold",
                allRecommendedAdded
                  ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                  : "bg-gradient-to-b from-yellow-400 to-amber-500 text-black",
              )}
            >
              {allRecommendedAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {allRecommendedAdded ? "Recommended in Builder" : "Add all recommended props"}
            </button>
          </div>
        }
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
                  {profile.team} · {profile.position} · vs {profile.opponent}
                </span>
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                {profile.tipTime} · Workload {profile.projectedWorkload} ·{" "}
                <span className={profile.injury === "None" ? "text-emerald-300" : "text-amber-300"}>
                  {profile.injury}
                </span>
              </p>
              <p className="mt-1 text-xs text-neutral-600">{profile.injuryNote}</p>
            </div>
          </div>
          <div className="rounded-xl border border-[#1a1a1a] bg-black/30 px-4 py-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Data Quality</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-yellow-400">{profile.dataQualityScore}</p>
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
            <h2 className="text-base font-semibold text-white">Performance vs line</h2>
            <p className="mt-1 text-xs text-neutral-500">Primary market with betting line overlay</p>
            <div className="mt-4">
              <PerformanceChart logs={profile.recentLogs} line={profile.chartLine} label={profile.chartStatLabel} />
            </div>
          </section>

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
            <h2 className="text-base font-semibold text-white">Active streaks</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {profile.streaks.map((s) => (
                <StreakChip key={s.label} streak={s} />
              ))}
            </div>
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
            <h2 className="text-base font-semibold text-white">Related props</h2>
            <p className="mt-1 text-xs text-neutral-500">Open markets linked to this player</p>
            <ul className="mt-4 space-y-2">
              {linkedProps.map((prop) => {
                const added = hasLeg(prop.id);
                const isRec = recommended.includes(prop.id);
                return (
                  <li
                    key={prop.id}
                    className="flex flex-col gap-3 rounded-xl border border-[#1a1a1a] bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/prop/${prop.id}`} className="font-medium text-neutral-100 hover:text-yellow-400">
                          {prop.market} {prop.side} {prop.line}
                        </Link>
                        {isRec && (
                          <span className="rounded border border-yellow-500/30 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-yellow-400">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        {formatAmericanOdds(prop.americanOdds)} · EV +{prop.evPercent.toFixed(1)}% · Conf{" "}
                        {prop.confidence} · RS {prop.researchScore}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ResearchScoreBadge score={prop.researchScore} size="sm" />
                      <button
                        type="button"
                        disabled={added}
                        onClick={() => addProp(prop.id)}
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

          <section
            className={cn(
              "card-3d rounded-2xl border p-5",
              profile.aiExplain.verdict === "strong" && "border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] to-transparent",
              profile.aiExplain.verdict === "weak" && "border-red-500/25 bg-gradient-to-br from-red-500/[0.08] to-transparent",
              profile.aiExplain.verdict === "neutral" && "border-[#1a1a1a]",
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-500/90">
              AI explainability
            </p>
            <h2 className="mt-2 text-base font-semibold text-white">{profile.aiExplain.headline}</h2>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">{profile.aiExplain.body}</p>
            <p className="mt-3 text-[10px] uppercase tracking-wider text-neutral-600">
              Verdict: {profile.aiExplain.verdict}
            </p>
          </section>

          <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
            <h2 className="text-base font-semibold text-white">{profile.matchup.title}</h2>
            <p className="mt-1 text-xs text-yellow-400/90">{profile.matchup.defenseRank}</p>
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
