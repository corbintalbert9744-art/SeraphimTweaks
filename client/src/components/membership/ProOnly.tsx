import { Link } from "wouter";
import { Lock } from "lucide-react";
import { useMembership } from "@/context/MembershipContext";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** True when the signed-in member is on the Pro plan. */
export function useIsPro() {
  const { plan, membershipActive } = useMembership();
  return membershipActive && plan === "pro";
}

/**
 * Keeps the same Pro UI visible for Standard members, but blurs/blocks it
 * with an Upgrade to Pro overlay so the difference is obvious.
 */
export function ProOnly({
  children,
  title = "Pro feature",
  description = "Upgrade to Pro to unlock this.",
  className,
  ctaLabel = "Upgrade to Pro",
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
  ctaLabel?: string;
}) {
  const isPro = useIsPro();
  if (isPro) return <>{children}</>;

  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      <div
        className="pointer-events-none select-none blur-[6px] opacity-40"
        aria-hidden
      >
        {children}
      </div>
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
        <div className="w-full max-w-sm rounded-2xl border border-yellow-500/30 bg-[#0c0c0c]/95 p-5 text-center shadow-[0_0_40px_-12px_rgba(234,179,8,0.35)]">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-yellow-500/35 bg-yellow-500/10 text-yellow-400">
            <Lock className="h-4 w-4" />
          </span>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-400">
            Pro only
          </p>
          <h3 className="mt-1 text-base font-semibold text-white">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">{description}</p>
          <Link
            href="/pricing"
            className="mt-4 inline-flex rounded-xl bg-yellow-400 px-4 py-2.5 text-xs font-semibold text-black transition hover:bg-yellow-300"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
