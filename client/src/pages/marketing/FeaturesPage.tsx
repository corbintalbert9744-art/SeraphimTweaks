import { Link } from "wouter";
import { MarketingShell } from "@/components/marketing/MarketingShell";

const features = [
  {
    title: "Historical Hit Rates",
    body: "See L5, L10, L20, and season hit rates beside every market so recent form is never a guessing game.",
    image: "/marketing/features/hit-rates.png",
    imageAlt: "NBA research board showing historical hit rates",
  },
  {
    title: "No-Vig Edge",
    body: "We remove sportsbook juice to show fair probability — then compare that to the price you’re offered.",
    image: "/marketing/features/no-vig.png",
    imageAlt: "Prop detail showing no-vig probability and EV",
  },
  {
    title: "Research Score",
    body: "A transparent 0–100 composite built from hit rates, matchup, books, movement, and injury checks.",
    image: "/marketing/features/research-score.png",
    imageAlt: "Command Center with Research Score and Prop of the Day",
  },
  {
    title: "AI Analysis",
    body: "Short, readable analysis that highlights the drivers behind a prop — not generic copy.",
    image: "/marketing/features/ai-analysis.png",
    imageAlt: "Prop research detail with analysis sections",
  },
  {
    title: "Line Movement",
    body: "Track open → now so you can see whether the market is confirming or fading the lean.",
    image: "/marketing/features/line-movement.png",
    imageAlt: "Prop detail line movement and books view",
  },
  {
    title: "Player Reports",
    body: "Member player pages with recent props, form context, and links into full research detail.",
    image: "/marketing/features/player-reports.png",
    imageAlt: "Player report page with research score and props",
  },
  {
    title: "Parlay Builder",
    body: "Assemble legs with shared L10 hit context and keep a live draft as you research the slate.",
    image: "/marketing/features/parlay-builder.png",
    imageAlt: "Parlay builder slip summary and legs",
  },
];

export default function FeaturesPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-500/90">
          Features
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Built for serious prop research
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-neutral-400 sm:text-base">
          Every tool is designed to answer one question clearly: is this prop worth your attention?
          Screenshots below are from the live Seraphim IQ app.
        </p>

        <div className="mt-14 space-y-16">
          {features.map((f, i) => {
            const imageLeft = i % 2 === 1;
            return (
              <article
                key={f.title}
                className="grid items-center gap-8 border-t border-[#1a1a1a] pt-12 lg:grid-cols-2 lg:gap-12"
              >
                <div className={imageLeft ? "lg:order-2" : undefined}>
                  <p className="text-sm tabular-nums text-neutral-600">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{f.title}</h2>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-400">{f.body}</p>
                </div>
                <div className={imageLeft ? "lg:order-1" : undefined}>
                  <div className="overflow-hidden rounded-2xl border border-[#222] bg-[#0c0c0c] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.9)]">
                    <img
                      src={f.image}
                      alt={f.imageAlt}
                      className="max-h-[420px] w-full object-cover object-top"
                      loading="lazy"
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-14 flex flex-wrap gap-3">
          <Link
            href="/pricing"
            className="btn-3d rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 px-6 py-3 text-sm font-semibold text-black"
          >
            Purchase Now
          </Link>
          <Link
            href="/pricing"
            className="rounded-xl border border-[#1a1a1a] bg-[#111] px-6 py-3 text-sm text-neutral-200 transition hover:border-yellow-500/30 hover:text-yellow-400"
          >
            View Pricing
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
