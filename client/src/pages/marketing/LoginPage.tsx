import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { useMembership } from "@/context/MembershipContext";

const fieldClass =
  "mt-1.5 h-11 w-full rounded-xl border border-[#1a1a1a] bg-[#111] px-3 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-500 focus:border-yellow-500/40 focus:ring-2 focus:ring-yellow-500/15";

export default function LoginPage() {
  const { signIn, isAuthenticated, membershipActive, loading } = useMembership();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || busy) return;
    if (isAuthenticated) {
      setLocation(membershipActive ? "/app" : "/checkout");
    }
  }, [loading, busy, isAuthenticated, membershipActive, setLocation]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn({ email, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MarketingShell>
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-16 sm:px-6">
        <div className="card-3d rounded-2xl border border-[#1a1a1a] bg-[#0c0c0c]/90 p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-500/90">
            Members
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Welcome back
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">
            Log in to your Seraphim IQ membership.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Email
              </span>
              <input
                required
                type="text"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email or username"
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Password
              </span>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className={fieldClass}
              />
            </label>
            {error ? (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="btn-3d mt-2 w-full rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 px-4 py-3 text-sm font-semibold text-black transition hover:brightness-105 disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Log in"}
            </button>
          </form>

          <p className="mt-6 text-sm text-neutral-500">
            New here?{" "}
            <Link href="/signup" className="font-medium text-yellow-400 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </MarketingShell>
  );
}
