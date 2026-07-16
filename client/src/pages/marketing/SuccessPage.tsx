import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { useMembership } from "@/context/MembershipContext";

export default function SuccessPage() {
  const { membershipActive, refresh, loading } = useMembership();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const sessionId = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get(
    "session_id",
  );
  const [tries, setTries] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const confirmedRef = useRef(false);

  useEffect(() => {
    if (membershipActive) {
      const t = window.setTimeout(() => setLocation("/app"), 800);
      return () => window.clearTimeout(t);
    }
  }, [membershipActive, setLocation]);

  useEffect(() => {
    if (!sessionId || membershipActive || loading || confirmedRef.current) return;
    confirmedRef.current = true;
    let cancelled = false;
    setConfirming(true);
    (async () => {
      try {
        const res = await fetch("/api/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sessionId }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          if (!cancelled) {
            setConfirmError(data.error || res.statusText);
            confirmedRef.current = false;
          }
        } else if (!cancelled) {
          setConfirmError(null);
        }
        if (!cancelled) await refresh();
      } catch (err) {
        if (!cancelled) {
          setConfirmError(err instanceof Error ? err.message : "Could not confirm checkout");
          confirmedRef.current = false;
        }
      } finally {
        if (!cancelled) setConfirming(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, membershipActive, loading, refresh]);

  useEffect(() => {
    if (membershipActive || loading || confirming) return;
    if (tries >= 8) {
      setTimedOut(true);
      return;
    }
    const t = window.setTimeout(() => {
      void refresh().finally(() => setTries((n) => n + 1));
    }, 1500);
    return () => window.clearTimeout(t);
  }, [membershipActive, loading, confirming, tries, refresh]);

  async function retryConfirm() {
    setTimedOut(false);
    setTries(0);
    setConfirmError(null);
    confirmedRef.current = false;
    if (!sessionId) {
      await refresh();
      return;
    }
    confirmedRef.current = true;
    setConfirming(true);
    try {
      const res = await fetch("/api/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setConfirmError(data.error || res.statusText);
        confirmedRef.current = false;
      }
      await refresh();
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Could not confirm checkout");
      confirmedRef.current = false;
    } finally {
      setConfirming(false);
    }
  }

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
              : "Verifying your Stripe Checkout Session and activating membership…"}
          </p>
          {sessionId ? (
            <p className="mt-3 break-all text-[11px] text-neutral-600">Session {sessionId}</p>
          ) : (
            <p className="mt-3 text-sm text-amber-200/90">
              Missing Checkout session id. If you already paid, log in and open the dashboard.
            </p>
          )}
          {confirmError ? (
            <p className="mt-3 text-sm text-amber-200/90">{confirmError}</p>
          ) : null}

          {timedOut && !membershipActive ? (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-amber-200/90">
                Still waiting on confirmation. Retry below — this re-checks Stripe directly.
              </p>
              <button
                type="button"
                onClick={() => void retryConfirm()}
                className="rounded-xl bg-yellow-400 px-4 py-2.5 text-sm font-semibold text-black"
              >
                Check again
              </button>
            </div>
          ) : (
            <div className="mt-6 flex items-center gap-2 text-sm text-neutral-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
              {membershipActive
                ? "Redirecting…"
                : confirming
                  ? "Confirming with Stripe…"
                  : "Verifying payment…"}
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            {membershipActive ? (
              <Link href="/app" className="text-yellow-400 hover:underline">
                Open dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-yellow-400 hover:underline">
                  Log in
                </Link>
                <Link href="/pricing" className="text-neutral-400 hover:text-yellow-400">
                  Back to pricing
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </MarketingShell>
  );
}
