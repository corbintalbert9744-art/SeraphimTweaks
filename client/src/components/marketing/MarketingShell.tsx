import { Link, useLocation } from "wouter";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useMembership } from "@/context/MembershipContext";

const nav = [
  { href: "/features", label: "Features" },
  { href: "/sports", label: "Sports" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
];

export function MarketingShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { isAuthenticated, membershipActive } = useMembership();

  return (
    <div className="marketing-site min-h-screen text-[var(--mkt-fg)]">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[var(--mkt-bg)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-10%,rgba(212,175,55,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(255,255,255,0.04),transparent_40%)]" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[rgba(8,8,8,0.72)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg object-contain" />
            <span className="font-[family-name:var(--font-mkt-display)] text-lg tracking-tight text-white">
              Seraphim <span className="text-[var(--mkt-gold)]">IQ</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm transition",
                  location === item.href
                    ? "text-[var(--mkt-gold)]"
                    : "text-neutral-400 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {isAuthenticated && membershipActive ? (
              <Link
                href="/app"
                className="rounded-full bg-[var(--mkt-gold)] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
              >
                Open Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden rounded-lg px-3 py-2 text-sm text-neutral-300 transition hover:text-white sm:inline"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full bg-[var(--mkt-gold)] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
                >
                  Start Free Trial
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main key={location} className="animate-in fade-in duration-500">
        {children}
      </main>

      <footer className="mt-24 border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-[family-name:var(--font-mkt-display)] text-xl text-white">
              Seraphim <span className="text-[var(--mkt-gold)]">IQ</span>
            </p>
            <p className="mt-2 max-w-sm text-sm text-neutral-500">
              Professional sports research for members who want clearer props, sharper edges, and
              transparent analytics.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Product</p>
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className="block text-neutral-400 hover:text-white">
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Members</p>
              <Link href="/login" className="block text-neutral-400 hover:text-white">
                Log in
              </Link>
              <Link href="/signup" className="block text-neutral-400 hover:text-white">
                Sign up
              </Link>
              <Link href="/checkout" className="block text-neutral-400 hover:text-white">
                Membership
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
