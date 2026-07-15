import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { useMembership } from "@/context/MembershipContext";

export default function SignupPage() {
  const { signUp, isAuthenticated, membershipActive } = useMembership();
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (isAuthenticated && membershipActive) setLocation("/app");
  }, [isAuthenticated, membershipActive, setLocation]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    signUp({ name, email, password });
    setLocation("/checkout");
  }

  return (
    <MarketingShell>
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-16 sm:px-8">
        <h1 className="font-[family-name:var(--font-mkt-display)] text-4xl text-white">
          Start your membership
        </h1>
        <p className="mt-3 text-neutral-400">
          Create an account, then activate Professional access to enter the research dashboard.
        </p>

        <form onSubmit={onSubmit} className="mt-10 space-y-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-neutral-500">Name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-[var(--mkt-gold)]/50"
            />
          </label>
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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-[var(--mkt-gold)]/50"
            />
          </label>
          <button
            type="submit"
            className="mt-2 w-full rounded-full bg-[var(--mkt-gold)] py-3 text-sm font-semibold text-black transition hover:brightness-110"
          >
            Continue to checkout
          </button>
        </form>

        <p className="mt-6 text-sm text-neutral-500">
          Already a member?{" "}
          <Link href="/login" className="text-[var(--mkt-gold)] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </MarketingShell>
  );
}
