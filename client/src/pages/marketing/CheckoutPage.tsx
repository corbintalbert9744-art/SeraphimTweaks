import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import {
  useMembership,
  type BillingInterval,
  type MembershipPlan,
} from "@/context/MembershipContext";
import { cn } from "@/lib/utils";

const PRICES: Record<BillingInterval, Record<MembershipPlan, number>> = {
  weekly: { standard: 7.99, pro: 9.99 },
  monthly: { standard: 19.99, pro: 24.99 },
  annually: { standard: 199.99, pro: 249.99 },
};

const SHORT: Record<BillingInterval, string> = {
  weekly: "/wk",
  monthly: "/mo",
  annually: "/yr",
};

function parseInterval(raw: string | null): BillingInterval {
  if (raw === "weekly" || raw === "annually" || raw === "yearly") {
    return raw === "yearly" ? "annually" : raw;
  }
  return "monthly";
}

function parsePlan(raw: string | null): MembershipPlan {
  if (raw === "standard") return "standard";
  return "pro";
}

export default function CheckoutPage() {
  const { isAuthenticated, membershipActive, activateMembership, user } = useMembership();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = useMemo(
    () => new URLSearchParams(search.startsWith("?") ? search.slice(1) : search),
    [search],
  );

  const [interval, setInterval] = useState<BillingInterval>(() =>
    parseInterval(params.get("interval")),
  );
  const [plan, setPlan] = useState<MembershipPlan>(() => parsePlan(params.get("plan")));

  useEffect(() => {
    if (membershipActive) setLocation("/app");
  }, [membershipActive, setLocation]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isAuthenticated) {
      const q = new URLSearchParams({ plan, interval });
      setLocation(`/signup?${q.toString()}`);
      return;
    }
    activateMembership(plan, interval);
    setLocation("/app");
  }

  const price = PRICES[interval][plan];

  return (
    <MarketingShell>
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-16 sm:px-6">
        <div className="card-3d rounded-2xl border border-[#1a1a1a] bg-[#0c0c0c]/90 p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-500/90">
            Choose a membership
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Become a Seraphim IQ Member
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">
            {user
              ? `Signed in as ${user.email}. Confirm Standard or Pro to open the members dashboard.`
              : "Create an account first, then confirm your membership."}
          </p>

          {!isAuthenticated ? (
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/signup?plan=${plan}&interval=${interval}`}
                className="btn-3d rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-semibold text-black"
              >
                Sign up
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-[#1a1a1a] bg-[#111] px-5 py-2.5 text-sm text-neutral-200 transition hover:border-yellow-500/30 hover:text-yellow-400"
              >
                Log in
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <div className="inline-flex rounded-full border border-[#222] bg-[#0f0f0f] p-1">
                {(["weekly", "monthly", "annually"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setInterval(opt)}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-sm capitalize transition",
                      interval === opt
                        ? "bg-yellow-400 font-semibold text-black"
                        : "text-neutral-400 hover:text-white",
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {(["standard", "pro"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setPlan(opt)}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-left transition",
                      plan === opt
                        ? "border-yellow-400/70 bg-yellow-500/10"
                        : "border-[#222] bg-[#111] hover:border-neutral-600",
                    )}
                  >
                    <p className="text-sm font-semibold capitalize text-white">{opt}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                      ${PRICES[interval][opt].toFixed(2)}
                      <span className="text-sm font-medium text-neutral-500">
                        {" "}
                        {SHORT[interval]}
                      </span>
                    </p>
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">
                <p className="text-sm text-neutral-400">
                  {plan === "pro" ? "Pro" : "Standard"} · {interval}
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-white">
                  ${price.toFixed(2)}
                  <span className="text-base font-medium text-neutral-500"> {SHORT[interval]}</span>
                </p>
                <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                  Mock checkout for this build — no real charge. Activating unlocks the members-only
                  research dashboard.
                </p>
              </div>

              <button
                type="submit"
                className="btn-3d w-full rounded-xl bg-yellow-400 px-4 py-3 text-sm font-semibold text-black"
              >
                Become a {plan === "pro" ? "Pro" : "Standard"} Member —{" "}
                {interval === "annually" ? "Annual" : interval === "weekly" ? "Weekly" : "Monthly"}
              </button>

              <p className="text-center text-xs text-neutral-500">
                Compare memberships on the{" "}
                <Link href="/pricing" className="text-yellow-400 hover:underline">
                  pricing page
                </Link>
                .
              </p>
            </form>
          )}
        </div>
      </div>
    </MarketingShell>
  );
}
