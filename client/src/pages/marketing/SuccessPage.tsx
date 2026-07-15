import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { useMembership } from "@/context/MembershipContext";

export default function SuccessPage() {
  const { membershipActive, isAuthenticated, refresh, loading } = useMembership();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const sessionId = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get(
    "session_id",
  );
  const [tries, setTries] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (membershipActive) {
      const t = window.setTimeout(() => setLocation("/app"), 800);
      return () => window.clearTimeout(t);
    }
  }, [membershipActive, setLocation]);

  useEffect(() => {
    if (membershipActive || loading) return;
    if (tries >= 12) {
      setTimedOut(true);
      return;
    }
    const t = window.setTimeout(() => {
      void refresh().finally(() => setTries((n) => n + 1));
    }, 1500);
    return () => window.clearTimeout(t);
  }, [membershipActive, loading, tries, refresh]);

  return (
    <MarketingShell>
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-[#1a1a1a] bg-[#0c0c0c]/90 p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-500/90">
            Payment received
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {membershipActive ? "Welcome to Seraphim IQ" : "Confirming your membership"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-400">
            {membershipActive
              ? "Stripe confirmed your subscription. Opening the research desk…"
              : "We’re waiting for Stripe’s webhook to mark your membership Active. This usually takes a few seconds."}
          </p>
          {sessionId ? (
            <p className="mt-3 break-all text-[11px] text-neutral-600">Session {sessionId}</p>
          ) : null}

          {timedOut && !membershipActive ? (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-amber-200/90">
                Still waiting on webhook confirmation. Make sure your Stripe webhook endpoint is
                pointed at <code className="text-yellow-300">/api/stripe/webhook</code>.
              </p>
              <button
                type="button"
                onClick={() => {
                  setTimedOut(false);
                  setTries(0);
                  void refresh();
                }}
                className="rounded-xl bg-yellow-400 px-4 py-2.5 text-sm font-semibold text-black"
              >
                Check again
              </button>
            </div>
          ) : (
            <div className="mt-6 flex items-center gap-2 text-sm text-neutral-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
              {membershipActive ? "Redirecting…" : "Verifying payment…"}
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            {isAuthenticated && membershipActive ? (
              <Link href="/app" className="text-yellow-400 hover:underline">
                Open dashboard
              </Link>
            ) : (
              <Link href="/pricing" className="text-neutral-400 hover:text-yellow-400">
                Back to pricing
              </Link>
            )}
          </div>
        </div>
      </div>
    </MarketingShell>
  );
}
