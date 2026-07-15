import { Link } from "wouter";
import { Check, X } from "lucide-react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { WorkflowDemo } from "@/components/marketing/WorkflowDemo";

const sports = ["NBA", "NFL", "MLB", "ATP", "WTA", "WNBA"];

const compareRows = [
  { feature: "Hit rates (L5 / L10 / L20 / Season)", us: "All four windows", them: "1 window or none" },
  { feature: "No-vig edge calculation", us: "Exact % from book odds", them: "Not available" },
  { feature: "Research Score checklist", us: "Transparent 0–100 score", them: "Opaque ratings" },
  { feature: "Line movement timeline", us: "Open → now on every prop", them: "Rarely shown" },
  { feature: "Sports coverage", us: "NBA · NFL · MLB · ATP · WTA · WNBA", them: "1–3 sports" },
  { feature: "Parlay builder", us: "Data-integrated L10 charts", them: "Basic or none" },
  { feature: "AI analysis", us: "Prop-level writeups (Pro)", them: "Generic blurbs" },
  { feature: "Player reports", us: "Full research profiles", them: "Limited bios" },
];

function CheckItem({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-neutral-200">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" strokeWidth={2.5} />
      <span>{children}</span>
    </li>
  );
}

export default function MarketingHomePage() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-yellow-500/10 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-32 h-80 w-80 rounded-full bg-amber-600/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-400">
              Sports prop analytics
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Hit rates.
              <br />
              Book edges.
              <br />
              Every player prop.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-neutral-400 sm:text-base">
              Seraphim IQ surfaces L5–L20 hit rates, no-vig edges, Research Scores, and AI analysis
              so you can research props like a desk — not a tip sheet.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/pricing"
                className="rounded-full bg-yellow-400 px-6 py-3 text-sm font-semibold text-black transition hover:bg-yellow-300"
              >
                Become a Member →
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-[#2a2a2a] bg-[#141414] px-6 py-3 text-sm font-medium text-white transition hover:border-neutral-500"
              >
                Sign in
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-400">
              <span>
                <span className="font-semibold text-white">6</span> sports
              </span>
              <span>
                <span className="font-semibold text-white">Major</span> books compared
              </span>
              <span>
                <span className="font-semibold text-yellow-300">L5–L20</span> hit rate windows
              </span>
              <span>
                <span className="font-semibold text-white">AI</span> research (Pro)
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-3 rounded-3xl bg-yellow-400/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-yellow-500/25 bg-[#0c0c0c] shadow-[0_0_60px_-20px_rgba(234,179,8,0.45)]">
              <img
                src="/marketing/hero-product.png"
                alt="Seraphim IQ NBA prop board"
                className="w-full object-cover object-top"
              />
            </div>
            <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-400/90">
              Actual product — not a mockup
            </p>
          </div>
        </div>
      </section>

      {/* Interactive workflow */}
      <section className="border-t border-[#1a1a1a] bg-black/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Try the workflow before you join.
              </h2>
              <p className="mt-3 max-w-xl text-sm text-neutral-400 sm:text-base">
                Sort props, filter live lines, add picks, and see the research panel update like the
                real app.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#2a2a2a] bg-[#141414] px-3 py-1.5 text-xs text-yellow-300">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
              Sample data · not live
            </span>
          </div>
          <WorkflowDemo />
        </div>
      </section>

      {/* Features */}
      <section id="features-preview" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-400">
          Features
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Everything to find a winning pick.
        </h2>

        {/* 01 Research */}
        <div className="mt-16 grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
              01 — Research
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-white">Historical performance by prop</h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">
              Every prop surfaces L5, L10, L20, and season hit rates. Color-coded thresholds let you
              spot high-confidence picks at a glance.
            </p>
            <ul className="mt-5 space-y-2.5">
              <CheckItem>L5, L10, L20, and season hit rates on every prop</CheckItem>
              <CheckItem>Hit-rate bars on the full research report</CheckItem>
              <CheckItem>Sortable boards across NBA, NFL, MLB, tennis, WNBA</CheckItem>
              <CheckItem>Player reports with performance vs line</CheckItem>
            </ul>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[#222] bg-[#0c0c0c] p-3 shadow-[0_24px_50px_-30px_rgba(0,0,0,0.9)]">
            <img
              src="/marketing/features/hit-rates.png"
              alt="Hit-rate visualization"
              className="w-full rounded-xl object-contain"
            />
          </div>
        </div>

        {/* 02 + 03 side by side */}
        <div className="mt-20 grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-[#222] bg-[#0c0c0c] p-6 sm:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
              02 — Edge
            </p>
            <h3 className="mt-3 text-xl font-semibold text-white">No-vig edge from real book lines</h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">
              See true implied probability after juice is removed, next to EV and confidence.
            </p>
            <ul className="mt-4 space-y-2">
              <CheckItem>No-vig probability on every research report</CheckItem>
              <CheckItem>Best line highlighted across compared books</CheckItem>
            </ul>
            <div className="mt-6 overflow-hidden rounded-xl border border-[#1a1a1a] bg-black/40 p-2">
              <img
                src="/marketing/features/no-vig.png"
                alt="No-vig and EV metrics"
                className="w-full object-contain"
              />
            </div>
          </article>

          <article className="rounded-2xl border border-[#222] bg-[#0c0c0c] p-6 sm:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
              03 — Confidence
            </p>
            <h3 className="mt-3 text-xl font-semibold text-white">
              See the game log behind every number
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">
              Research Score checklists and L10 hit/miss charts make confidence visual — not vibes.
            </p>
            <ul className="mt-4 space-y-2">
              <CheckItem>Checklist-backed Research Score</CheckItem>
              <CheckItem>Hit / miss coloring for instant recognition</CheckItem>
            </ul>
            <div className="mt-6 overflow-hidden rounded-xl border border-[#1a1a1a] bg-black/40 p-2">
              <img
                src="/marketing/features/parlay-builder.png"
                alt="L10 hit miss chart"
                className="w-full object-contain"
              />
            </div>
          </article>
        </div>

        {/* 04 Build */}
        <div className="mt-20 grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
              04 — Build
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-white">
              Parlay builder alongside your research
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">
              Add legs while you research. Over/Under toggles and live L10 context stay attached to
              every pick.
            </p>
            <ul className="mt-5 space-y-2.5">
              <CheckItem>One-tap add from any board or report</CheckItem>
              <CheckItem>Independent Over / Under per leg</CheckItem>
              <CheckItem>Live average L10 across the slip</CheckItem>
            </ul>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[#222] bg-[#0c0c0c] p-3">
            <img
              src="/marketing/features/research-score.png"
              alt="Research Score checklist"
              className="mb-3 w-full rounded-xl object-contain"
            />
            <img
              src="/marketing/features/ai-analysis.png"
              alt="AI explanation"
              className="w-full rounded-xl object-contain"
            />
          </div>
        </div>
      </section>

      {/* Coverage */}
      <section className="border-y border-[#1a1a1a] bg-black/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-400">
            Coverage
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Six leagues. One research desk.
          </h2>
          <p className="mt-3 max-w-xl text-sm text-neutral-400">
            Full hit-rate history and research boards across every supported sport.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {sports.map((sport) => (
              <span
                key={sport}
                className="rounded-full border border-[#2a2a2a] bg-[#141414] px-4 py-2 text-sm text-neutral-200"
              >
                {sport}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Compare */}
      <section id="compare" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-400">
          Compare
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Why Seraphim IQ
        </h2>
        <p className="mt-3 max-w-xl text-sm text-neutral-400">
          More transparent research — built as a premium membership, not another tip feed.
        </p>

        <div className="mt-10 overflow-hidden rounded-2xl border border-[#222]">
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] border-b border-[#222] bg-[#0c0c0c] px-4 py-4 text-[11px] font-semibold uppercase tracking-wider sm:px-6">
            <p className="text-neutral-500">Feature</p>
            <p className="text-center text-yellow-400">Seraphim IQ</p>
            <p className="text-center text-neutral-500">Others</p>
          </div>
          {compareRows.map((row) => (
            <div
              key={row.feature}
              className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] items-center border-b border-[#1a1a1a] px-4 py-4 last:border-b-0 sm:px-6"
            >
              <p className="pr-3 text-sm text-neutral-200">{row.feature}</p>
              <p className="flex items-start justify-center gap-1.5 text-center text-sm text-yellow-300">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                <span>{row.us}</span>
              </p>
              <p className="flex items-start justify-center gap-1.5 text-center text-sm text-neutral-500">
                <X className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                <span>{row.them}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Membership CTA */}
      <section className="border-t border-[#1a1a1a] bg-black/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-400">
            Membership
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Become a Seraphim IQ Member
          </h2>
          <p className="mt-3 max-w-xl text-sm text-neutral-400">
            Join for full research boards. Standard or Pro — both unlock the members-only dashboard.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/pricing"
              className="rounded-full bg-yellow-400 px-6 py-3 text-sm font-semibold text-black transition hover:bg-yellow-300"
            >
              Become a Member
            </Link>
            <Link
              href="/faq"
              className="rounded-full border border-[#2a2a2a] bg-[#141414] px-6 py-3 text-sm text-white transition hover:border-neutral-500"
            >
              Read the FAQ
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
