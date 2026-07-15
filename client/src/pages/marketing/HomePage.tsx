import { Link } from "wouter";
import { MarketingShell } from "@/components/marketing/MarketingShell";

const sports = [
  { name: "NBA", note: "Player props & slate research" },
  { name: "NFL", note: "Weekly markets & form" },
  { name: "MLB", note: "Daily counting props" },
  { name: "ATP", note: "Men’s tour match context" },
  { name: "WTA", note: "Women’s tour research" },
  { name: "WNBA", note: "Pace & matchup boards" },
];

const features = [
  { title: "Historical Hit Rates", body: "L5, L10, and season hit rates on every prop." },
  { title: "No-Vig Edge", body: "Fair probability stripped of book juice." },
  { title: "Research Score", body: "A single 0–100 score grounded in explainable checks." },
  { title: "AI Analysis", body: "Concise writeups that surface what actually matters." },
  { title: "Line Movement", body: "Open-to-now tracking so you see where the market moved." },
  { title: "Player Reports", body: "Profiles built for research — not highlight reels." },
  { title: "Parlay Builder", body: "Combine legs with shared hit-rate context." },
];

export default function MarketingHomePage() {
  return (
    <MarketingShell>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(8,8,8,0.85)_100%)]" />
        <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-[var(--mkt-gold)]/10 blur-3xl animate-[mkt-float_8s_ease-in-out_infinite]" />
        <div className="pointer-events-none absolute -right-16 top-40 h-80 w-80 rounded-full bg-amber-700/10 blur-3xl animate-[mkt-float_10s_ease-in-out_infinite_reverse]" />

        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center px-5 py-20 sm:px-8">
          <p className="mkt-reveal font-[family-name:var(--font-mkt-display)] text-5xl leading-[0.95] tracking-tight text-white sm:text-7xl md:text-8xl">
            Seraphim <span className="text-[var(--mkt-gold)]">IQ</span>
          </p>
          <p className="mkt-reveal mkt-delay-1 mt-5 text-lg text-neutral-300 sm:text-xl">
            Professional Sports Research Platform
          </p>
          <p className="mkt-reveal mkt-delay-2 mt-5 max-w-xl text-base leading-relaxed text-neutral-400 sm:text-lg">
            Find better props with advanced analytics, historical trends, and AI-powered research.
          </p>
          <div className="mkt-reveal mkt-delay-3 mt-10 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-full bg-[var(--mkt-gold)] px-6 py-3 text-sm font-semibold text-black transition hover:brightness-110"
            >
              Start Free Trial
            </Link>
            <Link
              href="/features"
              className="rounded-full border border-white/15 bg-white/[0.03] px-6 py-3 text-sm font-medium text-white transition hover:border-[var(--mkt-gold)]/40 hover:bg-white/[0.06]"
            >
              View Features
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--mkt-gold)]/80">
          Supported Sports
        </p>
        <h2 className="mt-3 font-[family-name:var(--font-mkt-display)] text-3xl text-white sm:text-4xl">
          Six leagues. One research desk.
        </h2>
        <p className="mt-3 max-w-2xl text-neutral-400">
          Boards built the same way across every sport — so your process stays consistent.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sports.map((sport) => (
            <div key={sport.name} className="border-t border-white/10 pt-5">
              <p className="font-[family-name:var(--font-mkt-display)] text-2xl text-white">{sport.name}</p>
              <p className="mt-2 text-sm text-neutral-500">{sport.note}</p>
            </div>
          ))}
        </div>
        <Link href="/sports" className="mt-10 inline-block text-sm text-[var(--mkt-gold)] hover:underline">
          Explore supported sports →
        </Link>
      </section>

      <section className="border-y border-white/[0.06] bg-white/[0.015]">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--mkt-gold)]/80">Features</p>
          <h2 className="mt-3 font-[family-name:var(--font-mkt-display)] text-3xl text-white sm:text-4xl">
            Research tools that stay out of the way.
          </h2>
          <p className="mt-3 max-w-2xl text-neutral-400">
            Clear signals. Transparent math. Built for serious prop research.
          </p>
          <div className="mt-14 grid gap-x-10 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title}>
                <h3 className="text-lg font-medium text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">{f.body}</p>
              </div>
            ))}
          </div>
          <Link href="/features" className="mt-12 inline-block text-sm text-[var(--mkt-gold)] hover:underline">
            See all features →
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--mkt-gold)]/80">Membership</p>
        <h2 className="mt-3 font-[family-name:var(--font-mkt-display)] text-3xl text-white sm:text-4xl">
          Become a Seraphim IQ Member
        </h2>
        <p className="mt-3 max-w-xl text-neutral-400">
          One Professional plan. Full access to every supported sport and research tool.
        </p>
        <div className="mt-12 max-w-md border-t border-[var(--mkt-gold)]/30 pt-8">
          <p className="text-sm text-neutral-400">Professional Plan</p>
          <p className="mt-2 font-[family-name:var(--font-mkt-display)] text-5xl text-white">
            $19<span className="text-2xl text-neutral-500">/month</span>
          </p>
          <ul className="mt-6 space-y-2 text-sm text-neutral-300">
            {["NBA", "NFL", "MLB", "ATP", "WTA", "WNBA", "AI Research", "Unlimited Props"].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="text-[var(--mkt-gold)]">✔</span> {item}
              </li>
            ))}
          </ul>
          <Link
            href="/signup"
            className="mt-8 inline-flex rounded-full bg-[var(--mkt-gold)] px-6 py-3 text-sm font-semibold text-black transition hover:brightness-110"
          >
            Start Trial
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-8 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-6 border-t border-white/10 pt-16 md:flex-row md:items-end">
          <div>
            <h2 className="font-[family-name:var(--font-mkt-display)] text-3xl text-white">Questions?</h2>
            <p className="mt-2 text-neutral-400">How scores work, which books we cover, and more.</p>
          </div>
          <Link href="/faq" className="text-sm text-[var(--mkt-gold)] hover:underline">
            Read the FAQ →
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
