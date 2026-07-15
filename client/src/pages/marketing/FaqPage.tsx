import { MarketingShell } from "@/components/marketing/MarketingShell";

const faqs = [
  {
    q: "How is Research Score calculated?",
    a: "Research Score is a 0–100 composite from explainable checks — hit rates, matchup lean, book agreement, line movement, playing-time/PA projections, and injury status. Each check contributes openly so you can see why a prop scored the way it did.",
  },
  {
    q: "Which sportsbooks are supported?",
    a: "Member boards surface consensus-style quotes across major US books (including DraftKings, FanDuel, and BetMGM in research views). Live multi-book sync expands as adapters ship.",
  },
  {
    q: "Which sports are included?",
    a: "Membership includes NBA, NFL, MLB, ATP, WTA, and WNBA — all under one Professional plan.",
  },
  {
    q: "How often is data updated?",
    a: "Slate and injury context refresh throughout the day. NBA game feeds pull from live adapters; other leagues currently use curated research boards that follow the same update cadence as our pipelines expand.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Membership is month-to-month (or yearly if you choose). You can cancel anytime and keep access through the end of your billing period.",
  },
];

export default function FaqPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-500/90">FAQ</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Answers for members
        </h1>
        <p className="mt-5 text-lg text-neutral-400">
          Clear product questions — no fluff.
        </p>

        <div className="mt-14 space-y-0">
          {faqs.map((item) => (
            <details
              key={item.q}
              className="group border-t border-white/10 py-6 open:pb-8"
            >
              <summary className="cursor-pointer list-none text-lg text-white marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-start justify-between gap-4">
                  {item.q}
                  <span className="mt-1 text-yellow-400 transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-4 leading-relaxed text-neutral-400">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </MarketingShell>
  );
}
