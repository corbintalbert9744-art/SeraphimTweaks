import { Link } from "wouter";
import { MarketingShell } from "@/components/marketing/MarketingShell";

const features = [
  {
    title: "Historical Hit Rates",
    body: "See L5, L10, L20, and season hit rates beside every market so recent form is never a guessing game.",
  },
  {
    title: "No-Vig Edge",
    body: "We remove sportsbook juice to show fair probability — then compare that to the price you’re offered.",
  },
  {
    title: "Research Score",
    body: "A transparent 0–100 composite built from hit rates, matchup, books, movement, and injury checks.",
  },
  {
    title: "AI Analysis",
    body: "Short, readable analysis that highlights the drivers behind a prop — not generic copy.",
  },
  {
    title: "Line Movement",
    body: "Track open → now so you can see whether the market is confirming or fading the lean.",
  },
  {
    title: "Player Reports",
    body: "Member player pages with recent props, form context, and links into full research detail.",
  },
  {
    title: "Parlay Builder",
    body: "Assemble legs with shared L10 hit context and keep a live draft as you research the slate.",
  },
];

export default function FeaturesPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--mkt-gold)]/80">Features</p>
        <h1 className="mt-4 font-[family-name:var(--font-mkt-display)] text-4xl text-white sm:text-6xl">
          Built for serious prop research
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-neutral-400">
          Every tool is designed to answer one question clearly: is this prop worth your attention?
        </p>

        <div className="mt-16 space-y-0">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="grid gap-4 border-t border-white/10 py-10 md:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)]"
            >
              <p className="text-sm text-neutral-600">{String(i + 1).padStart(2, "0")}</p>
              <div>
                <h2 className="text-2xl text-white">{f.title}</h2>
                <p className="mt-3 max-w-xl text-neutral-400">{f.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="rounded-full bg-[var(--mkt-gold)] px-6 py-3 text-sm font-semibold text-black transition hover:brightness-110"
          >
            Start Free Trial
          </Link>
          <Link
            href="/pricing"
            className="rounded-full border border-white/15 px-6 py-3 text-sm text-white transition hover:border-[var(--mkt-gold)]/40"
          >
            View Pricing
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
