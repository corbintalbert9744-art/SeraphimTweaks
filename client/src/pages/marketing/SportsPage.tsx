import { Link } from "wouter";
import { MarketingShell } from "@/components/marketing/MarketingShell";

const sports = [
  {
    name: "NBA",
    blurb: "Nightly player props with hit rates, no-vig, and Research Score on a live-ready board.",
  },
  {
    name: "NFL",
    blurb: "Weekly passing, rushing, and receiving markets with form and matchup context.",
  },
  {
    name: "MLB",
    blurb: "Daily hits, RBIs, strikeouts, home runs, and total bases with the same research layout.",
  },
  {
    name: "ATP",
    blurb: "Men’s tour match and prop research with form checkpoints and transparent scoring.",
  },
  {
    name: "WTA",
    blurb: "Women’s tour boards using the same Seraphim research language as every other sport.",
  },
  {
    name: "WNBA",
    blurb: "Player props and pace/matchup context for the WNBA slate.",
  },
];

export default function SportsPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--mkt-gold)]/80">
          Supported Sports
        </p>
        <h1 className="mt-4 font-[family-name:var(--font-mkt-display)] text-4xl text-white sm:text-6xl">
          Research across six leagues
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-neutral-400">
          One membership. Consistent boards. Switch sports without learning a new workflow.
        </p>

        <div className="mt-16 grid gap-8 md:grid-cols-2">
          {sports.map((sport) => (
            <article key={sport.name} className="border-t border-white/10 pt-6">
              <h2 className="font-[family-name:var(--font-mkt-display)] text-3xl text-white">{sport.name}</h2>
              <p className="mt-3 text-neutral-400">{sport.blurb}</p>
            </article>
          ))}
        </div>

        <Link
          href="/signup"
          className="mt-14 inline-flex rounded-full bg-[var(--mkt-gold)] px-6 py-3 text-sm font-semibold text-black transition hover:brightness-110"
        >
          Become a Member
        </Link>
      </div>
    </MarketingShell>
  );
}
