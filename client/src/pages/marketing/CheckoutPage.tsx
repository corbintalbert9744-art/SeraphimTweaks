import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { useMembership } from "@/context/MembershipContext";
import { cn } from "@/lib/utils";
import type { BillingInterval } from "@/context/MembershipContext";

export default function CheckoutPage() {
  const { isAuthenticated, membershipActive, activateMembership, user } = useMembership();
  const [, setLocation] = useLocation();
  const [interval, setInterval] = useState<BillingInterval>("monthly");

  useEffect(() => {
    if (membershipActive) setLocation("/app");
  }, [membershipActive, setLocation]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isAuthenticated) {
      setLocation("/signup");
      return;
    }
    activateMembership(interval);
    setLocation("/app");
  }

  const price = interval === "monthly" ? 19 : 190;

  return (
    <MarketingShell>
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-16 sm:px-6">
        <div className="card-3d rounded-2xl border border-[#1a1a1a] bg-[#0c0c0c]/90 p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-500/90">
            Membership
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Become a Seraphim IQ Member
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">
            {user
              ? `Signed in as ${user.email}. Activate Professional to open the members dashboard.`
              : "Create an account first, then activate membership."}
          </p>

          {!isAuthenticated ? (
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="btn-3d rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 px-5 py-2.5 text-sm font-semibold text-black"
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
            <form onSubmit={onSubmit} className="mt-8 space-y-6">
              <div className="inline-flex rounded-xl border border-[#1a1a1a] bg-[#111] p-1">
                {(["monthly", "yearly"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setInterval(opt)}
                    className={cn(
                      "rounded-lg px-4 py-2 text-sm capitalize transition",
                      interval === opt
                        ? "bg-yellow-500/15 font-semibold text-yellow-300 border border-yellow-500/40"
                        : "border border-transparent text-neutral-400 hover:text-white",
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">
                <p className="text-sm text-neutral-400">Professional Plan</p>
                <p className="mt-2 text-4xl font-semibold tabular-nums text-white">
                  ${price}
                  <span className="text-lg font-medium text-neutral-500">
                    {interval === "monthly" ? "/month" : "/year"}
                  </span>
                </p>
                <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                  Mock checkout for this build — no real charge. Activating unlocks the members-only
                  research dashboard.
                </p>
              </div>

              <button
                type="submit"
                className="btn-3d w-full rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 px-4 py-3 text-sm font-semibold text-black"
              >
                Activate membership
              </button>
            </form>
          )}
        </div>
      </div>
    </MarketingShell>
  );
}
