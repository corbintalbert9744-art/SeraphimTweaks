import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Check, X } from "lucide-react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { DISPLAY_PRICES, type BillingInterval, type MembershipPlan } from "@shared/membership";
import { cn } from "@/lib/utils";

type PlanId = MembershipPlan;

const INTERVAL_LABEL: Record<BillingInterval, string> = {
  monthly: "Monthly",
  yearly: "Yearly",
};

const INTERVAL_SHORT: Record<BillingInterval, string> = {
  monthly: "/mo",
  yearly: "/yr",
};

const INTERVAL_CTA: Record<BillingInterval, string> = {
  monthly: "Monthly",
  yearly: "Yearly",
};

const STANDARD_FEATURES = [
  "All active sports (NBA, NFL, MLB, ATP, WTA, WNBA)",
  "Hit rates (L5 / L10 / L20 / Season & H2H)",
  "EV%, no-vig, confidence & Research Score",
  "Live line movement + sportsbook comparisons",
  "Player reports + Parlay Builder",
];

const STANDARD_EXCLUDED = [
  "AI research analysis on props & players",
  "Premium insight writeups (Prop of the Day)",
  "Private Discord premium picks",
  "Early access to new features",
];

const PRO_FEATURES = [
  "Everything in Standard",
  "Private Discord premium picks (live)",
  "AI research analysis on every prop & player",
  "Premium insight tools & Prop of the Day writeups",
  "Expanded sportsbook depth + early feature access",
];

type CompareValue = { kind: "check" } | { kind: "x" } | { kind: "text"; text: string };

const SHARED_ROWS: Array<{ label: string; standard: CompareValue; pro: CompareValue }> = [
  {
    label: "Sports covered",
    standard: { kind: "text", text: "All active sports" },
    pro: { kind: "text", text: "All sports + early access" },
  },
  { label: "Hit rates (L5 / L10 / L20)", standard: { kind: "check" }, pro: { kind: "check" } },
  { label: "Season & H2H hit rates", standard: { kind: "check" }, pro: { kind: "check" } },
  { label: "Expected Value (EV%)", standard: { kind: "check" }, pro: { kind: "check" } },
  { label: "Live line movement", standard: { kind: "check" }, pro: { kind: "check" } },
  { label: "Parlay builder", standard: { kind: "check" }, pro: { kind: "check" } },
  {
    label: "Player reports (stats & matchup)",
    standard: { kind: "check" },
    pro: { kind: "check" },
  },
  {
    label: "Sportsbook comparisons",
    standard: { kind: "text", text: "Core books" },
    pro: { kind: "text", text: "Expanded depth" },
  },
];

const PRO_ONLY_ROWS: Array<{
  label: string;
  standard: CompareValue;
  pro: CompareValue;
}> = [
  {
    label: "Premium insight tools",
    standard: { kind: "x" },
    pro: { kind: "check" },
  },
  {
    label: "AI research analysis",
    standard: { kind: "x" },
    pro: { kind: "check" },
  },
  {
    label: "Premium picks (private Discord)",
    standard: { kind: "x" },
    pro: { kind: "check" },
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

function CheckIcon() {
  return <Check className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" strokeWidth={2.5} />;
}

function XIcon() {
  return <X className="mt-0.5 h-4 w-4 shrink-0 text-neutral-600" strokeWidth={2} />;
}

function CellValue({
  value,
  emphasize,
}: {
  value: CompareValue;
  emphasize?: boolean;
}) {
  if (value.kind === "check") {
    return (
      <Check
        className={cn("mx-auto h-4 w-4", emphasize ? "text-yellow-400" : "text-yellow-400/90")}
        strokeWidth={2.5}
      />
    );
  }
  if (value.kind === "x") {
    return <X className="mx-auto h-4 w-4 text-neutral-600" strokeWidth={2} />;
  }
  const isDenied =
    value.text === "Not included" || value.text === "Standard release" || value.text === "Core books";
  return (
    <span
      className={cn(
        "text-sm",
        emphasize ? "font-medium text-yellow-300" : isDenied ? "text-neutral-500" : "text-neutral-300",
      )}
    >
      {value.text}
    </span>
  );
}

export default function PricingPage() {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [promo, setPromo] = useState("");

  const prices = DISPLAY_PRICES[interval];
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
          Become a Seraphim IQ Member
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-400 sm:text-base">
          Seraphim IQ is members-only. Choose Standard or Pro to unlock the research desk.
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
              {(["monthly", "yearly"] as const).map((opt) => (
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
              <div>
                <h2 className="text-xl font-semibold text-white">Standard</h2>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Research only
                </p>
              </div>
              <p className="text-right text-xl font-semibold tabular-nums text-white">
                ${formatPrice(prices.standard)}
                <span className="text-sm font-medium text-neutral-500"> {suffix}</span>
              </p>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-neutral-400">
              Full research boards for daily prop work. No Discord picks. No AI. No early-access
              sports.
            </p>
            <ul className="mt-6 space-y-3">
              {STANDARD_FEATURES.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-neutral-200">
                  <CheckIcon />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-xl border border-[#2a2a2a] bg-[#080808] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Not included on Standard
              </p>
              <ul className="mt-3 space-y-2.5">
                {STANDARD_EXCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-neutral-500">
                    <XIcon />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href={planHref("standard")}
              className="mt-8 flex w-full items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#141414] px-4 py-3 text-sm font-semibold text-white transition hover:border-neutral-500"
            >
              Become a Member · {ctaPeriod}
            </Link>
          </article>

          {/* Pro */}
          <article className="flex flex-col rounded-2xl border border-yellow-400/70 bg-[#0c0c0c] p-6 shadow-[0_0_40px_-18px_rgba(234,179,8,0.55)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-white">Pro</h2>
                <span className="rounded-md bg-yellow-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                  Includes My Picks
                </span>
              </div>
              <p className="text-right text-xl font-semibold tabular-nums text-yellow-400">
                ${formatPrice(prices.pro)}
                <span className="text-sm font-medium text-yellow-400/60"> {suffix}</span>
              </p>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-neutral-400">
              Everything in Standard, plus the Pro-only layer: private Discord picks, AI research,
              and early access.
            </p>

            <div className="mt-5 flex gap-3 rounded-xl border border-yellow-500/25 bg-yellow-500/[0.06] p-4">
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className="mt-0.5 h-5 w-5 shrink-0 fill-yellow-400"
              >
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              <p className="text-sm leading-relaxed text-neutral-200">
                <span className="font-semibold text-yellow-300">My premium picks</span>, delivered
                live in a private Discord channel — the biggest reason people go Pro.
              </p>
            </div>

            <ul className="mt-6 flex-1 space-y-3">
              {PRO_FEATURES.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-neutral-200">
                  <CheckIcon />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href={planHref("pro")}
              className="btn-3d mt-8 flex w-full items-center justify-center rounded-xl bg-yellow-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-yellow-300"
            >
              Become a Pro Member · {ctaPeriod}
            </Link>
          </article>
        </div>

        {/* Comparison */}
        <section className="mt-20">
          <h2 className="text-2xl font-semibold tracking-tight text-white">Compare memberships</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Shared research tools below. The yellow rows are Pro-only — Standard does not get them.
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

            <div className="border-b border-[#222] bg-[#0a0a0a] px-4 py-2.5 sm:px-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Included in both
              </p>
            </div>
            {SHARED_ROWS.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] items-center border-b border-[#1a1a1a] px-4 py-4 sm:px-6"
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

            <div className="border-b border-yellow-500/20 bg-yellow-500/[0.08] px-4 py-2.5 sm:px-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-yellow-400">
                Pro unlocks — not on Standard
              </p>
            </div>
            {PRO_ONLY_ROWS.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] items-center border-b border-[#1a1a1a] bg-yellow-500/[0.04] px-4 py-4 last:border-b-0 sm:px-6"
              >
                <p className="pr-3 text-sm font-medium text-yellow-100/90">{row.label}</p>
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
            Want Discord picks and AI?{" "}
            <Link href={checkoutHref} className="text-yellow-400 hover:underline">
              Become a Pro Member
            </Link>
            . Research-only? Choose Standard above.
          </p>
        </section>
      </div>
    </MarketingShell>
  );
}
