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
 * Renders children for Pro members; otherwise a locked upsell panel.
 */
export function ProOnly({
  children,
  title = "Pro feature",
  description = "Upgrade to Pro for AI research tools and private Discord premium picks.",
  className,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
}) {
  const isPro = useIsPro();
  if (isPro) return <>{children}</>;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.04] p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-yellow-500/30 bg-black/40 text-yellow-400">
          <Lock className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-400">
            Pro only
          </p>
          <h3 className="mt-1 text-base font-semibold text-white">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">{description}</p>
          <Link
            href="/pricing"
            className="mt-4 inline-flex rounded-xl bg-yellow-400 px-4 py-2 text-xs font-semibold text-black transition hover:bg-yellow-300"
          >
            Become a Pro Member
          </Link>
        </div>
      </div>
    </div>
  );
}
