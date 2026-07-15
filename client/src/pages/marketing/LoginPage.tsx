import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { useMembership } from "@/context/MembershipContext";

export default function LoginPage() {
  const { signIn, isAuthenticated, membershipActive } = useMembership();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!submitted && isAuthenticated && membershipActive) {
      setLocation("/app");
      return;
    }
    if (submitted && isAuthenticated) {
      setLocation(membershipActive ? "/app" : "/checkout");
    }
  }, [submitted, isAuthenticated, membershipActive, setLocation]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    signIn({ email, password });
    setSubmitted(true);
  }

  return (
    <MarketingShell>
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-16 sm:px-8">
        <h1 className="font-[family-name:var(--font-mkt-display)] text-4xl text-white">Welcome back</h1>
        <p className="mt-3 text-neutral-400">Log in to your Seraphim IQ membership.</p>

        <form onSubmit={onSubmit} className="mt-10 space-y-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-neutral-500">Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-[var(--mkt-gold)]/50"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-neutral-500">Password</span>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-[var(--mkt-gold)]/50"
            />
          </label>
          <button
            type="submit"
            className="mt-2 w-full rounded-full bg-[var(--mkt-gold)] py-3 text-sm font-semibold text-black transition hover:brightness-110"
          >
            Log in
          </button>
        </form>

        <p className="mt-6 text-sm text-neutral-500">
          New here?{" "}
          <Link href="/signup" className="text-[var(--mkt-gold)] hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </MarketingShell>
  );
}
