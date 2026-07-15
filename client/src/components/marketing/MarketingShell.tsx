import { Link, useLocation } from "wouter";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useMembership } from "@/context/MembershipContext";

const nav = [
  { href: "/features", label: "Features" },
  { href: "/sports", label: "Sports" },
  { href: "/#compare", label: "Compare" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
];

export function MarketingShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { isAuthenticated, membershipActive } = useMembership();

  return (
    <div className="marketing-site relative min-h-screen bg-black font-sans text-neutral-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-5%,rgba(234,179,8,0.12),transparent_55%)]" />

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
        <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <img src="/logo.png" alt="" className="h-8 w-8 shrink-0 rounded-lg object-contain" />
            <span className="text-sm font-semibold tracking-tight text-white">
              Seraphim <span className="text-yellow-400">IQ</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => {
              const active = !item.href.includes("#") && location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm transition",
                    active ? "text-yellow-400" : "text-neutral-400 hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {isAuthenticated && membershipActive ? (
              <Link
                href="/app"
                className="rounded-full bg-yellow-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-yellow-300"
              >
                Open Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden rounded-lg px-3 py-2 text-sm text-neutral-300 transition hover:text-white sm:inline"
                >
                  Sign in
                </Link>
                <Link
                  href="/pricing"
                  className="rounded-full bg-yellow-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-yellow-300"
                >
                  View plans
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main key={location} className="relative z-10 animate-in fade-in duration-300">
        {children}
      </main>

      <footer className="relative z-10 mt-8 border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">
              Seraphim <span className="text-yellow-400">IQ</span>
            </p>
            <p className="mt-3 max-w-sm text-sm text-neutral-500">
              Professional sports research for members who want clearer props, sharper edges, and
              transparent analytics.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Product
              </p>
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block text-neutral-400 hover:text-yellow-400"
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Members
              </p>
              <Link href="/login" className="block text-neutral-400 hover:text-yellow-400">
                Sign in
              </Link>
              <Link href="/signup" className="block text-neutral-400 hover:text-yellow-400">
                Sign up
              </Link>
              <Link href="/pricing" className="block text-neutral-400 hover:text-yellow-400">
                View plans
              </Link>
            </div>
          </div>
        </div>
        <div className="border-t border-white/[0.04] py-6 text-center text-xs text-neutral-600">
          © {new Date().getFullYear()} Seraphim IQ. Research platform — not a sportsbook.
        </div>
      </footer>
    </div>
  );
}
