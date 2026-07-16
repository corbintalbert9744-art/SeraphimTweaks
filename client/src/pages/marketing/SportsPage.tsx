import { Link } from "wouter";
import { MarketingShell } from "@/components/marketing/MarketingShell";

const sports = [
  {
    name: "NBA",
    blurb: "Nightly player props with hit rates, no-vig, and Research Score on a live board.",
  },
  {
    name: "NFL",
    blurb: "Weekly passing, rushing, and receiving markets with form and matchup context.",
  },
  {
    name: "MLB",
    blurb: "Daily hits, RBIs, strikeouts, home runs, and total bases — provider pending.",
  },
  {
    name: "NHL",
    blurb: "Skater and goalie props with ice-time and matchup research — provider pending.",
  },
  {
    name: "Soccer",
    blurb: "Shots, goals, and assist props across major soccer leagues — provider pending.",
  },
  {
    name: "WNBA",
    blurb: "Player props and pace/matchup context for the WNBA slate — planned next.",
  },
  {
    name: "Tennis (ATP / WTA)",
    blurb: "Tour match and prop research with form checkpoints — requires tennis provider.",
  },
];

export default function SportsPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-500/90">
          Supported Sports
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Research across seven sports
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-neutral-400">
          One membership. Our projection model. Line Comparison across PrizePicks, Underdog,
          FanDuel, DraftKings, BetMGM, Caesars, Fanatics, and ESPN BET — adapters swap without
          UI changes.
        </p>

        <div className="mt-16 grid gap-8 md:grid-cols-2">
          {sports.map((sport) => (
            <article key={sport.name} className="border-t border-white/10 pt-6">
              <h2 className="text-2xl font-semibold tracking-tight text-white">{sport.name}</h2>
              <p className="mt-3 text-neutral-400">{sport.blurb}</p>
            </article>
          ))}
        </div>

        <Link
          href="/signup"
          className="mt-14 inline-flex rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 px-6 py-3 text-sm font-semibold text-black transition hover:brightness-110"
        >
          Become a Member
        </Link>
      </div>
    </MarketingShell>
  );
}
