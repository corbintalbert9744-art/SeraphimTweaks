import { Link } from "wouter";
import { Check } from "lucide-react";
import { MarketingShell } from "@/components/marketing/MarketingShell";

const features = [
  {
    code: "01 — Research",
    title: "Historical performance by prop",
    body: "Every prop surfaces L5, L10, L20, and season hit rates. Color-coded thresholds let you spot high-confidence picks at a glance.",
    bullets: [
      "L5, L10, L20, and season hit rates on every prop",
      "Hit-rate bars on the full research report",
      "Sortable boards across every supported sport",
      "Player reports with performance vs line",
    ],
    image: "/marketing/features/hit-rates.png",
    imageAlt: "Hit-rate visualization",
  },
  {
    code: "02 — Edge",
    title: "No-vig edge from real book lines",
    body: "See true implied probability after juice is removed, next to EV and confidence on every research report.",
    bullets: [
      "No-vig probability on every report",
      "Best line highlighted across compared books",
      "EV% shown beside fair probability",
    ],
    image: "/marketing/features/no-vig.png",
    imageAlt: "No-vig and EV metrics",
  },
  {
    code: "03 — Confidence",
    title: "Research Score you can explain",
    body: "A transparent 0–100 score with the checklist behind it — hit rates, matchup, books, movement, and injuries.",
    bullets: [
      "Checklist-backed Research Score",
      "Pass / warn / fail on every check",
      "Separate Data Quality Score",
    ],
    image: "/marketing/features/research-score.png",
    imageAlt: "Research Score checklist",
  },
  {
    code: "04 — Movement",
    title: "Line movement timeline",
    body: "Open → now tracking so you can see whether the market is confirming or fading the lean.",
    bullets: [
      "Open, AM, noon, and now checkpoints",
      "Visual polyline on every report",
    ],
    image: "/marketing/features/line-movement.png",
    imageAlt: "Line movement chart",
  },
  {
    code: "05 — Analysis",
    title: "AI explanation on every prop",
    body: "Short writeups that call out no-vig, hit rates, and matchup context, not generic blurbs. Pro also unlocks live premium picks in a private Discord.",
    bullets: [
      "Prop-level AI explanation (Pro)",
      "Premium picks in a private Discord (Pro)",
      "Tied to the same numbers on the report",
    ],
    image: "/marketing/features/ai-analysis.png",
    imageAlt: "AI explanation",
  },
  {
    code: "06 — Build",
    title: "Parlay builder alongside your research",
    body: "Add legs while you research. Over/Under toggles and L10 hit/miss charts stay attached to every pick.",
    bullets: [
      "One-tap add from any board or report",
      "Independent Over / Under per leg",
      "L10 hit/miss chart for the focused leg",
    ],
    image: "/marketing/features/parlay-builder.png",
    imageAlt: "Parlay builder L10 chart",
  },
];

export default function FeaturesPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-400">
          Features
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          Everything to find a winning pick.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-neutral-400 sm:text-base">
          Screenshots below are from the live Seraphim IQ app — the same boards members use after
          checkout.
        </p>

        <div className="mt-16 space-y-24">
          {features.map((f, i) => {
            const imageLeft = i % 2 === 1;
            return (
              <article
                key={f.title}
                className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14"
              >
                <div className={imageLeft ? "lg:order-2" : undefined}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                    {f.code}
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">{f.title}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-400">{f.body}</p>
                  <ul className="mt-5 space-y-2.5">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-sm text-neutral-200">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" strokeWidth={2.5} />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={imageLeft ? "lg:order-1" : undefined}>
                  <div className="overflow-hidden rounded-2xl border border-[#222] bg-[#0c0c0c] p-3 shadow-[0_24px_50px_-30px_rgba(0,0,0,0.9)]">
                    <img
                      src={f.image}
                      alt={f.imageAlt}
                      className="w-full rounded-xl object-contain"
                      loading="lazy"
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-20 flex flex-wrap gap-3">
          <Link
            href="/pricing"
            className="rounded-full bg-yellow-400 px-6 py-3 text-sm font-semibold text-black transition hover:bg-yellow-300"
          >
            Become a Member
          </Link>
          <Link
            href="/signup"
            className="rounded-full border border-[#2a2a2a] bg-[#141414] px-6 py-3 text-sm text-white transition hover:border-neutral-500"
          >
            Create account
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
