import { useState } from "react";
import { Link } from "wouter";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { cn } from "@/lib/utils";

const included = [
  "NBA",
  "NFL",
  "MLB",
  "ATP",
  "WTA",
  "WNBA",
  "AI Research",
  "Unlimited Props",
  "Parlay Builder",
  "Player Reports",
];

export default function PricingPage() {
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const price = interval === "monthly" ? 19 : 190;
  const suffix = interval === "monthly" ? "/month" : "/year";

  return (
    <MarketingShell>
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--mkt-gold)]/80">Pricing</p>
        <h1 className="mt-4 font-[family-name:var(--font-mkt-display)] text-4xl text-white sm:text-6xl">
          Become a Seraphim IQ Member
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-neutral-400">
          One Professional plan with full access. Cancel anytime.
        </p>

        <div className="mt-10 inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
          {(["monthly", "yearly"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setInterval(opt)}
              className={cn(
                "rounded-full px-5 py-2 text-sm capitalize transition",
                interval === opt
                  ? "bg-[var(--mkt-gold)] font-semibold text-black"
                  : "text-neutral-400 hover:text-white",
              )}
            >
              {opt}
              {opt === "yearly" ? " · save ~17%" : ""}
            </button>
          ))}
        </div>

        <div className="mt-12 max-w-lg border border-[var(--mkt-gold)]/25 bg-gradient-to-b from-[var(--mkt-gold)]/[0.07] to-transparent p-8 sm:p-10">
          <p className="text-sm text-neutral-400">Professional Plan</p>
          <p className="mt-3 font-[family-name:var(--font-mkt-display)] text-5xl text-white">
            ${price}
            <span className="text-xl text-neutral-500">{suffix}</span>
          </p>
          <ul className="mt-8 space-y-3">
            {included.map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-neutral-200">
                <span className="text-[var(--mkt-gold)]">✔</span>
                {item}
              </li>
            ))}
          </ul>
          <Link
            href="/signup"
            className="mt-10 inline-flex w-full items-center justify-center rounded-full bg-[var(--mkt-gold)] px-6 py-3 text-sm font-semibold text-black transition hover:brightness-110 sm:w-auto"
          >
            Start Trial
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
