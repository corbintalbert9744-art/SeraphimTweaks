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
        <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-yellow-500/10 blur-3xl animate-[mkt-float_8s_ease-in-out_infinite]" />
        <div className="pointer-events-none absolute -right-16 top-40 h-80 w-80 rounded-full bg-amber-700/10 blur-3xl animate-[mkt-float_10s_ease-in-out_infinite_reverse]" />

        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center px-4 py-20 sm:px-6">
          <p className="mkt-reveal text-5xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl">
            Seraphim <span className="text-yellow-400">IQ</span>
          </p>
          <p className="mkt-reveal mkt-delay-1 mt-5 text-lg font-medium text-neutral-300 sm:text-xl">
            Professional Sports Research Platform
          </p>
          <p className="mkt-reveal mkt-delay-2 mt-4 max-w-xl text-sm leading-relaxed text-neutral-400 sm:text-base">
            Find better props with advanced analytics, historical trends, and AI-powered research.
          </p>
          <div className="mkt-reveal mkt-delay-3 mt-10 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="btn-3d rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 px-5 py-3 text-sm font-semibold text-black"
            >
              Start Free Trial
            </Link>
            <Link
              href="/features"
              className="rounded-xl border border-[#1a1a1a] bg-[#111] px-5 py-3 text-sm font-medium text-neutral-200 transition hover:border-yellow-500/30 hover:text-yellow-400"
            >
              View Features
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-500/90">
          Supported Sports
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Six leagues. One research desk.
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-neutral-400">
          Boards built the same way across every sport — so your process stays consistent.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sports.map((sport) => (
            <div key={sport.name} className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
              <p className="text-lg font-semibold text-white">{sport.name}</p>
              <p className="mt-1.5 text-sm text-neutral-500">{sport.note}</p>
            </div>
          ))}
        </div>
        <Link href="/sports" className="mt-8 inline-block text-sm text-yellow-400 hover:underline">
          Explore supported sports →
        </Link>
      </section>

      <section className="border-y border-[#1a1a1a] bg-[#0c0c0c]/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-500/90">
            Features
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Research tools that stay out of the way.
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-neutral-400">
            Clear signals. Transparent math. Built for serious prop research.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-[#1a1a1a] bg-[#111]/40 p-5">
                <h3 className="text-base font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">{f.body}</p>
              </div>
            ))}
          </div>
          <Link href="/features" className="mt-10 inline-block text-sm text-yellow-400 hover:underline">
            See all features →
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-500/90">
          Membership
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Become a Seraphim IQ Member
        </h2>
        <p className="mt-2 max-w-xl text-sm text-neutral-400">
          One Professional plan. Full access to every supported sport and research tool.
        </p>
        <div className="card-3d mt-10 max-w-md rounded-2xl border border-yellow-500/25 bg-gradient-to-b from-yellow-500/10 to-transparent p-6 sm:p-8">
          <p className="text-sm text-neutral-400">Professional Plan</p>
          <p className="mt-2 text-4xl font-semibold tabular-nums text-white">
            $19<span className="text-lg font-medium text-neutral-500">/month</span>
          </p>
          <ul className="mt-6 space-y-2 text-sm text-neutral-300">
            {["NBA", "NFL", "MLB", "ATP", "WTA", "WNBA", "AI Research", "Unlimited Props"].map(
              (item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="text-yellow-400">✔</span> {item}
                </li>
              ),
            )}
          </ul>
          <Link
            href="/signup"
            className="btn-3d mt-8 inline-flex rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 px-5 py-3 text-sm font-semibold text-black"
          >
            Start Trial
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 border-t border-[#1a1a1a] pt-14 md:flex-row md:items-end">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">Questions?</h2>
            <p className="mt-2 text-sm text-neutral-400">
              How scores work, which books we cover, and more.
            </p>
          </div>
          <Link href="/faq" className="text-sm text-yellow-400 hover:underline">
            Read the FAQ →
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
