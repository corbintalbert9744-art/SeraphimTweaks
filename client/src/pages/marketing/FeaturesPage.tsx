import { Link } from "wouter";
import { MarketingShell } from "@/components/marketing/MarketingShell";

const features = [
  {
    title: "Historical Hit Rates",
    body: "L5, L10, L20, and season clear rates at the current line — shown as hit-rate bars on every research report.",
    image: "/marketing/features/hit-rates.png",
    imageAlt: "Hit-rate visualization with L5 L10 L20 and season bars",
  },
  {
    title: "No-Vig Edge",
    body: "Fair no-vig probability next to EV and confidence, so you can see the edge after juice is removed.",
    image: "/marketing/features/no-vig.png",
    imageAlt: "No-Vig probability EV confidence and Research Score metrics",
  },
  {
    title: "Research Score",
    body: "A transparent 0–100 score with the checklist behind it — hit rates, matchup, books, movement, and injuries.",
    image: "/marketing/features/research-score.png",
    imageAlt: "Research Score checklist explaining why a prop is rated highly",
  },
  {
    title: "AI Analysis",
    body: "Short AI explanation bullets that call out no-vig, hit rates, and matchup context for the prop.",
    image: "/marketing/features/ai-analysis.png",
    imageAlt: "AI explanation writeup on a research report",
  },
  {
    title: "Line Movement",
    body: "Open → now line timeline so you can see whether the market is confirming or fading the lean.",
    image: "/marketing/features/line-movement.png",
    imageAlt: "Line movement timeline chart from open to now",
  },
  {
    title: "Player Reports",
    body: "Full player profiles with season averages, workload, data quality, and performance vs the betting line.",
    image: "/marketing/features/player-reports.png",
    imageAlt: "Player profile report with averages and performance chart",
  },
  {
    title: "Parlay Builder",
    body: "Build slips with Over/Under toggles and an L10 hit/miss chart for the focused leg.",
    image: "/marketing/features/parlay-builder.png",
    imageAlt: "Parlay builder L10 hit miss chart for a focused leg",
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
                  <div className="overflow-hidden rounded-2xl border border-[#222] bg-[#0a0a0a] p-2 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.9)] sm:p-3">
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
