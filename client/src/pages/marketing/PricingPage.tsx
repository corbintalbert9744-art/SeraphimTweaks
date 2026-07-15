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
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-500/90">Pricing</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Become a Seraphim IQ Member
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-neutral-400">
          One Professional plan with full access. Cancel anytime.
        </p>

        <div className="mt-10 inline-flex rounded-xl border border-[#1a1a1a] bg-[#111] p-1">
          {(["monthly", "yearly"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setInterval(opt)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm capitalize transition",
                interval === opt
                  ? "border border-yellow-500/40 bg-yellow-500/15 font-semibold text-yellow-300"
                  : "border border-transparent text-neutral-400 hover:text-white",
              )}
            >
              {opt}
              {opt === "yearly" ? " · save ~17%" : ""}
            </button>
          ))}
        </div>

        <div className="card-3d mt-12 max-w-lg rounded-2xl border border-yellow-500/25 bg-gradient-to-b from-yellow-500/10 to-transparent p-8 sm:p-10">
          <p className="text-sm text-neutral-400">Professional Plan</p>
          <p className="mt-3 text-4xl font-semibold tabular-nums text-white">
            ${price}
            <span className="text-xl font-medium text-neutral-500">{suffix}</span>
          </p>
          <ul className="mt-8 space-y-3">
            {included.map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-neutral-200">
                <span className="text-yellow-400">✔</span>
                {item}
              </li>
            ))}
          </ul>
          <Link
            href="/signup"
            className="btn-3d mt-10 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 px-6 py-3 text-sm font-semibold text-black sm:w-auto"
          >
            Start Trial
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
