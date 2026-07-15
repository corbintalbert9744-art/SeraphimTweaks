import { useState } from "react";
import { Link } from "wouter";
import { PageHeader } from "@/components/shared/PageHeader";
import type { LeagueCode } from "@/data/mock";
import { cn } from "@/lib/utils";
import { useMembership } from "@/context/MembershipContext";
import { useIsPro } from "@/components/membership/ProOnly";

const leagueOptions: LeagueCode[] = ["NBA", "NFL", "MLB", "WNBA", "ATP", "WTA"];

const STANDARD_INCLUDES = [
  "All active sports boards (NBA, NFL, MLB, ATP, WTA, WNBA)",
  "Hit rates (L5 / L10 / L20 / Season)",
  "EV%, no-vig, confidence, and Research Score checklist",
  "Line movement and sportsbook comparisons",
  "Player reports (stats, splits, streaks, matchup)",
  "Parlay Builder and Prop of the Day core metrics",
];

const PRO_ONLY = [
  "AI explanations on props and player profiles",
  "Premium Prop of the Day insight writeups",
  "Private Discord channel for premium picks",
];

export default function SettingsPage() {
  const { plan, user, billingInterval, currentPeriodEnd } = useMembership();
  const isPro = useIsPro();
  const [leagues, setLeagues] = useState<LeagueCode[]>(["NBA", "NFL", "MLB", "WNBA"]);
  const [oddsFormat, setOddsFormat] = useState<"american" | "decimal">("american");
  const [minResearch, setMinResearch] = useState(70);

  function toggleLeague(code: LeagueCode) {
    setLeagues((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code],
    );
  }

  const discordUrl = (import.meta as { env?: { VITE_DISCORD_INVITE_URL?: string } }).env
    ?.VITE_DISCORD_INVITE_URL;

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Membership access and local display preferences."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card-3d rounded-2xl border border-yellow-500/25 bg-yellow-500/[0.03] p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-400">
                Your membership
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                {isPro ? "Pro" : "Standard"}
                {user?.email ? (
                  <span className="ml-2 text-sm font-normal text-neutral-500">{user.email}</span>
                ) : null}
              </h2>
              <p className="mt-1 text-sm text-neutral-400">
                Billed {billingInterval}
                {currentPeriodEnd
                  ? ` · renews ${new Date(currentPeriodEnd).toLocaleDateString()}`
                  : ""}
              </p>
            </div>
            {!isPro ? (
              <Link
                href="/pricing"
                className="rounded-xl bg-yellow-400 px-4 py-2 text-xs font-semibold text-black hover:bg-yellow-300"
              >
                Upgrade to Pro
              </Link>
            ) : null}
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Included on Standard
              </p>
              <ul className="mt-3 space-y-2">
                {STANDARD_INCLUDES.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-neutral-300">
                    <span className="text-yellow-400">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Pro only
              </p>
              <ul className="mt-3 space-y-2">
                {PRO_ONLY.map((item) => (
                  <li
                    key={item}
                    className={cn(
                      "flex gap-2 text-sm",
                      isPro ? "text-neutral-300" : "text-neutral-500",
                    )}
                  >
                    <span className={isPro ? "text-yellow-400" : "text-neutral-600"}>
                      {isPro ? "✓" : "🔒"}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              {isPro ? (
                <a
                  href={discordUrl || "https://discord.com/"}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-xs font-semibold text-yellow-300 hover:bg-yellow-500/15"
                >
                  Open private Discord picks →
                </a>
              ) : (
                <p className="mt-4 text-xs text-neutral-500">
                  Discord premium picks unlock on Pro.
                </p>
              )}
            </div>
          </div>
          {plan ? null : null}
        </section>

        <section className="card-3d rounded-2xl border border-[#1a1a1a] p-6">
          <h2 className="text-base font-semibold text-white">Default leagues</h2>
          <p className="mt-1 text-xs text-neutral-500">Controls dashboard filter chips later.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {leagueOptions.map((code) => {
              const active = leagues.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => toggleLeague(code)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm transition",
                    active
                      ? "border-yellow-500/40 bg-yellow-500/15 text-yellow-300"
                      : "border-[#1a1a1a] bg-[#111] text-neutral-400 hover:text-neutral-200",
                  )}
                >
                  {code}
                </button>
              );
            })}
          </div>
        </section>

        <section className="card-3d rounded-2xl border border-[#1a1a1a] p-6">
          <h2 className="text-base font-semibold text-white">Odds format</h2>
          <p className="mt-1 text-xs text-neutral-500">Display preference for boards and calculators.</p>
          <div className="mt-4 flex gap-2">
            {(["american", "decimal"] as const).map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => setOddsFormat(format)}
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm capitalize transition",
                  oddsFormat === format
                    ? "border-yellow-500/40 bg-yellow-500/15 text-yellow-300"
                    : "border-[#1a1a1a] bg-[#111] text-neutral-400",
                )}
              >
                {format}
              </button>
            ))}
          </div>
        </section>

        <section className="card-3d rounded-2xl border border-[#1a1a1a] p-6 lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Min Research Score filter</h2>
              <p className="mt-1 text-xs text-neutral-500">
                Hide board rows below this score once live filters ship.
              </p>
            </div>
            <p className="text-2xl font-semibold tabular-nums text-yellow-400">{minResearch}</p>
          </div>
          <input
            type="range"
            min={50}
            max={95}
            value={minResearch}
            onChange={(e) => setMinResearch(Number(e.target.value))}
            className="mt-5 w-full accent-yellow-400"
          />
        </section>

        <section className="card-3d rounded-2xl border border-[#1a1a1a] p-6 lg:col-span-2">
          <h2 className="text-base font-semibold text-white">Appearance</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Seraphim dark theme is the V1 default — near-black surfaces with gold research accents.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-yellow-500/25 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
            Dark mode · Active
          </div>
        </section>
      </div>
    </div>
  );
}
