import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { useMembership } from "@/context/MembershipContext";

const fieldClass =
  "mt-1.5 h-11 w-full rounded-xl border border-[#1a1a1a] bg-[#111] px-3 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-500 focus:border-yellow-500/40 focus:ring-2 focus:ring-yellow-500/15";

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
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-16 sm:px-6">
        <div className="card-3d rounded-2xl border border-[#1a1a1a] bg-[#0c0c0c]/90 p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-500/90">
            Membership
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Create your account
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">
            Sign up, then activate Professional membership to open the research dashboard.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Name
              </span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Email
              </span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
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
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className={fieldClass}
              />
            </label>
            <button
              type="submit"
              className="btn-3d mt-2 w-full rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 px-4 py-3 text-sm font-semibold text-black transition hover:brightness-105"
            >
              Continue to checkout
            </button>
          </form>

          <p className="mt-6 text-sm text-neutral-500">
            Already a member?{" "}
            <Link href="/login" className="font-medium text-yellow-400 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </MarketingShell>
  );
}
