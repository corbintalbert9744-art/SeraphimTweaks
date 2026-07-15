import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import type { LeagueCode } from "@/data/mock";
import { cn } from "@/lib/utils";

const leagueOptions: LeagueCode[] = ["NBA", "NFL", "MLB", "WNBA", "ATP", "WTA"];

export default function SettingsPage() {
  const [leagues, setLeagues] = useState<LeagueCode[]>(["NBA", "NFL", "MLB", "WNBA"]);
  const [oddsFormat, setOddsFormat] = useState<"american" | "decimal">("american");
  const [minResearch, setMinResearch] = useState(70);

  function toggleLeague(code: LeagueCode) {
    setLeagues((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code],
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Preferences are local mock state for now — persistence arrives with auth."
      />

      <div className="grid gap-6 lg:grid-cols-2">
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
            Light mode is deferred.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-yellow-500/25 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
            Dark mode · Active
          </div>
        </section>
      </div>
    </div>
  );
}
