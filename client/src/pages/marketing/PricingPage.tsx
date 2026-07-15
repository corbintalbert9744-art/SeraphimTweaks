import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Check, X } from "lucide-react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { cn } from "@/lib/utils";

type BillingInterval = "weekly" | "monthly" | "annually";
type PlanId = "standard" | "pro";

const PRICES: Record<BillingInterval, Record<PlanId, number>> = {
  weekly: { standard: 7.99, pro: 9.99 },
  monthly: { standard: 19.99, pro: 24.99 },
  annually: { standard: 199.99, pro: 249.99 },
};

const INTERVAL_LABEL: Record<BillingInterval, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  annually: "Annually",
};

const INTERVAL_SHORT: Record<BillingInterval, string> = {
  weekly: "/wk",
  monthly: "/mo",
  annually: "/yr",
};

const INTERVAL_CTA: Record<BillingInterval, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  annually: "Annual",
};

const STANDARD_FEATURES = [
  "All active sports (NBA, NFL, MLB, ATP, WTA, WNBA)",
  "Hit rates, EV%, Research Score & line movement",
  "Parlay builder + player reports",
  "Sportsbook comparisons",
];

const PRO_FEATURES = [
  "AI research & premium insight tools",
  "Everything in Standard",
];

type CompareValue = { kind: "check" } | { kind: "x" } | { kind: "text"; text: string };

const COMPARISON: Array<{
  label: string;
  standard: CompareValue;
  pro: CompareValue;
  highlight?: boolean;
}> = [
  {
    label: "Sports covered",
    standard: { kind: "text", text: "All active sports" },
    pro: { kind: "text", text: "All active sports + early access" },
  },
  {
    label: "Hit rates (L5 / L10 / L20)",
    standard: { kind: "check" },
    pro: { kind: "check" },
  },
  {
    label: "Season & H2H hit rates",
    standard: { kind: "check" },
    pro: { kind: "check" },
  },
  {
    label: "Expected Value (EV%)",
    standard: { kind: "check" },
    pro: { kind: "check" },
  },
  {
    label: "Live line movement",
    standard: { kind: "check" },
    pro: { kind: "check" },
  },
  {
    label: "Sportsbook comparisons",
    standard: { kind: "check" },
    pro: { kind: "text", text: "Expanded depth" },
  },
  {
    label: "Parlay builder",
    standard: { kind: "check" },
    pro: { kind: "check" },
  },
  {
    label: "Player reports",
    standard: { kind: "check" },
    pro: { kind: "check" },
  },
  {
    label: "Premium insight tools",
    standard: { kind: "x" },
    pro: { kind: "check" },
  },
  {
    label: "AI research analysis",
    standard: { kind: "x" },
    pro: { kind: "check" },
    highlight: true,
  },
  {
    label: "New feature access",
    standard: { kind: "text", text: "Standard release" },
    pro: { kind: "text", text: "Early access" },
  },
];

function formatPrice(n: number) {
  return n.toFixed(2).replace(/\.00$/, "");
}

function CellValue({ value, emphasize }: { value: CompareValue; emphasize?: boolean }) {
  if (value.kind === "check") {
    return <Check className={cn("mx-auto h-4 w-4", emphasize ? "text-yellow-400" : "text-yellow-400/90")} strokeWidth={2.5} />;
  }
  if (value.kind === "x") {
    return <X className="mx-auto h-4 w-4 text-neutral-600" strokeWidth={2} />;
  }
  return (
    <span className={cn("text-sm", emphasize ? "text-yellow-300" : "text-neutral-300")}>
      {value.text}
    </span>
  );
}

export default function PricingPage() {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [promo, setPromo] = useState("");

  const prices = PRICES[interval];
  const suffix = INTERVAL_SHORT[interval];
  const ctaPeriod = INTERVAL_CTA[interval];

  const checkoutHref = useMemo(() => {
    const q = new URLSearchParams({ interval, plan: "pro" });
    if (promo.trim()) q.set("promo", promo.trim());
    return `/signup?${q.toString()}`;
  }, [interval, promo]);

  function planHref(plan: PlanId) {
    const q = new URLSearchParams({ interval, plan });
    if (promo.trim()) q.set("promo", promo.trim());
    return `/signup?${q.toString()}`;
  }

  return (
    <MarketingShell>
      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-400">
          Choose a membership
        </p>
        <h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          You’re in. Now pick your plan.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-400 sm:text-base">
          Seraphim IQ does not offer free accounts. Choose Standard or Pro to unlock the research
          app.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-neutral-300">Membership</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
              placeholder="Promo code (optional)"
              className="h-10 w-full rounded-xl border border-[#222] bg-[#0f0f0f] px-3 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-yellow-500/40 sm:w-48"
            />
            <div className="inline-flex rounded-full border border-[#222] bg-[#0f0f0f] p-1">
              {(["weekly", "monthly", "annually"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setInterval(opt)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-sm transition sm:px-4",
                    interval === opt
                      ? "bg-yellow-400 font-semibold text-black"
                      : "text-neutral-400 hover:text-white",
                  )}
                >
                  {INTERVAL_LABEL[opt]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {/* Standard */}
          <article className="flex flex-col rounded-2xl border border-[#222] bg-[#0c0c0c] p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl font-semibold text-white">Standard</h2>
              <p className="text-right text-xl font-semibold tabular-nums text-white">
                ${formatPrice(prices.standard)}
                <span className="text-sm font-medium text-neutral-500"> {suffix}</span>
              </p>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-neutral-400">
              Full research boards for serious daily prop work — hit rates, EV, and transparent
              scores across every supported sport.
            </p>
            <ul className="mt-6 flex-1 space-y-3">
              {STANDARD_FEATURES.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-neutral-200">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-400" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href={planHref("standard")}
              className="mt-8 flex w-full items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#141414] px-4 py-3 text-sm font-semibold text-white transition hover:border-neutral-500"
            >
              Start Standard — {ctaPeriod}
            </Link>
          </article>

          {/* Pro */}
          <article className="flex flex-col rounded-2xl border border-yellow-400/70 bg-[#0c0c0c] p-6 shadow-[0_0_40px_-18px_rgba(234,179,8,0.55)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-white">Pro</h2>
                <span className="rounded-md bg-yellow-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                  Includes AI research
                </span>
              </div>
              <p className="text-right text-xl font-semibold tabular-nums text-white">
                ${formatPrice(prices.pro)}
                <span className="text-sm font-medium text-neutral-500"> {suffix}</span>
              </p>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-neutral-400">
              Everything in Standard, plus AI analysis and premium insight tools for deeper edge
              work.
            </p>

            <div className="mt-5 rounded-xl border border-yellow-500/25 bg-yellow-500/[0.06] p-4">
              <p className="text-sm leading-relaxed text-neutral-200">
                <span className="font-semibold text-yellow-300">AI research writeups</span> that
                surface what actually drives a prop — the biggest reason members go Pro.
              </p>
            </div>

            <ul className="mt-6 flex-1 space-y-3">
              {PRO_FEATURES.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-neutral-200">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-400" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href={planHref("pro")}
              className="btn-3d mt-8 flex w-full items-center justify-center rounded-xl bg-yellow-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-yellow-300"
            >
              Start Pro — {ctaPeriod}
            </Link>
          </article>
        </div>

        {/* Comparison */}
        <section className="mt-20">
          <h2 className="text-2xl font-semibold tracking-tight text-white">Plan comparison</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Standard is the default paid product. Pro is the higher tier for deeper tools.
          </p>

          <div className="mt-8 overflow-hidden rounded-2xl border border-[#222]">
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] border-b border-[#222] bg-[#0c0c0c] px-4 py-5 sm:px-6">
              <div />
              <div className="text-center">
                <p className="text-sm font-semibold text-white">Standard</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-white sm:text-3xl">
                  ${formatPrice(prices.standard)}
                  <span className="text-sm font-medium text-neutral-500">{suffix}</span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-yellow-400">Pro</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-yellow-400 sm:text-3xl">
                  ${formatPrice(prices.pro)}
                  <span className="text-sm font-medium text-yellow-400/60">{suffix}</span>
                </p>
              </div>
            </div>

            {COMPARISON.map((row) => (
              <div
                key={row.label}
                className={cn(
                  "grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] items-center border-b border-[#1a1a1a] px-4 py-4 last:border-b-0 sm:px-6",
                  row.highlight && "bg-yellow-500/[0.05]",
                )}
              >
                <p className="pr-3 text-sm text-neutral-300">{row.label}</p>
                <div className="text-center">
                  <CellValue value={row.standard} />
                </div>
                <div className="text-center">
                  <CellValue value={row.pro} emphasize />
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-sm text-neutral-500">
            Ready?{" "}
            <Link href={checkoutHref} className="text-yellow-400 hover:underline">
              Start with Pro
            </Link>{" "}
            or pick Standard above.
          </p>
        </section>
      </div>
    </MarketingShell>
  );
}
