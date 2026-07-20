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
  const [location, setLocation] = useLocation();
  const { isAuthenticated, membershipActive, signOut } = useMembership();

  async function onSignOut() {
    await signOut();
    setLocation("/");
  }

  return (
    <div className="marketing-site relative min-h-screen bg-black font-sans text-neutral-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-5%,rgba(234,179,8,0.12),transparent_55%)]" />

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
        <div className="relative mx-auto flex h-12 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <img src="/logo.png" alt="" className="h-6 w-6 shrink-0 rounded-md object-contain" />
            <span className="text-[13px] font-semibold tracking-tight text-white">
              Seraphim <span className="text-yellow-400">IQ</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 md:flex">
            {nav.map((item) => {
              const active = !item.href.includes("#") && location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs transition",
                    active ? "text-yellow-400" : "text-neutral-400 hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5">
            {isAuthenticated && membershipActive ? (
              <>
                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  className="hidden rounded-md px-2.5 py-1.5 text-xs text-neutral-300 transition hover:text-white sm:inline"
                >
                  Sign out
                </button>
                <Link
                  href="/app"
                  className="rounded-full bg-yellow-400 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-yellow-300"
                >
                  Open Dashboard
                </Link>
              </>
            ) : isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  className="rounded-md px-2.5 py-1.5 text-xs text-neutral-300 transition hover:text-white"
                >
                  Sign out
                </button>
                <Link
                  href="/checkout"
                  className="rounded-full bg-yellow-400 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-yellow-300"
                >
                  Finish checkout
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden rounded-md px-2.5 py-1.5 text-xs text-neutral-300 transition hover:text-white sm:inline"
                >
                  Sign in
                </Link>
                <Link
                  href="/pricing"
                  className="rounded-full bg-yellow-400 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-yellow-300"
                >
                  Become a Member
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
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[13px] font-semibold text-white">
              Seraphim <span className="text-yellow-400">IQ</span>
            </p>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-neutral-500">
              Professional sports research for members who want clearer props, sharper edges, and
              transparent analytics.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6 text-xs">
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
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
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Members
              </p>
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  className="block text-left text-neutral-400 hover:text-yellow-400"
                >
                  Sign out
                </button>
              ) : (
                <>
                  <Link href="/login" className="block text-neutral-400 hover:text-yellow-400">
                    Sign in
                  </Link>
                  <Link href="/signup" className="block text-neutral-400 hover:text-yellow-400">
                    Sign up
                  </Link>
                </>
              )}
              <Link href="/pricing" className="block text-neutral-400 hover:text-yellow-400">
                Become a Member
              </Link>
            </div>
          </div>
        </div>
        <div className="border-t border-white/[0.04] py-4 text-center text-[11px] text-neutral-600">
          © {new Date().getFullYear()} Seraphim IQ. Research platform — not a sportsbook.
        </div>
      </footer>
    </div>
  );
}
