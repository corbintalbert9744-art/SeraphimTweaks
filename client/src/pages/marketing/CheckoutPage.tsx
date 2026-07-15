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
      <div className="mx-auto max-w-lg px-5 py-20 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--mkt-gold)]/80">
          Membership
        </p>
        <h1 className="mt-4 font-[family-name:var(--font-mkt-display)] text-4xl text-white">
          Become a Seraphim IQ Member
        </h1>
        <p className="mt-3 text-neutral-400">
          {user
            ? `Signed in as ${user.email}. Activate Professional to open the members dashboard.`
            : "Create an account first, then activate membership."}
        </p>

        {!isAuthenticated ? (
          <div className="mt-10 flex gap-3">
            <Link
              href="/signup"
              className="rounded-full bg-[var(--mkt-gold)] px-6 py-3 text-sm font-semibold text-black"
            >
              Sign up
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-white/15 px-6 py-3 text-sm text-white"
            >
              Log in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-10 space-y-6">
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
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
                </button>
              ))}
            </div>

            <div className="border-t border-white/10 pt-6">
              <p className="text-sm text-neutral-400">Professional Plan</p>
              <p className="mt-2 font-[family-name:var(--font-mkt-display)] text-4xl text-white">
                ${price}
                <span className="text-lg text-neutral-500">
                  {interval === "monthly" ? "/month" : "/year"}
                </span>
              </p>
              <p className="mt-4 text-sm text-neutral-500">
                Mock checkout for this build — no real charge. Activating unlocks the members-only
                research dashboard.
              </p>
            </div>

            <button
              type="submit"
              className="w-full rounded-full bg-[var(--mkt-gold)] py-3 text-sm font-semibold text-black transition hover:brightness-110"
            >
              Activate membership
            </button>
          </form>
        )}
      </div>
    </MarketingShell>
  );
}
