import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Dense research panel shell — used across Command Center, boards, and reports. */
export function ResearchPanel({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
  featured,
  "data-feature": dataFeature,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  featured?: boolean;
  "data-feature"?: string;
}) {
  return (
    <section
      data-feature={dataFeature}
      className={cn(
        "overflow-hidden rounded-xl border bg-[#0d0d0d]",
        featured ? "border-yellow-500/25" : "border-[#1a1a1a]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1a1a1a] px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white sm:text-base">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function MetricStrip({
  items,
  className,
}: {
  items: Array<{ label: string; value: string; sub?: string; tone?: "gold" | "hit" | "miss" | "muted" }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#1a1a1a] sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
      data-feature="metric-strip"
    >
      {items.map((item) => (
        <div key={item.label} className="bg-[#0d0d0d] px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">{item.label}</p>
          <p
            className={cn(
              "mt-1 text-xl font-semibold tabular-nums",
              item.tone === "gold" && "text-yellow-400",
              item.tone === "hit" && "text-emerald-300",
              item.tone === "miss" && "text-red-300",
              (!item.tone || item.tone === "muted") && "text-white",
            )}
          >
            {item.value}
          </p>
          {item.sub ? <p className="mt-0.5 truncate text-[11px] text-neutral-500">{item.sub}</p> : null}
        </div>
      ))}
    </div>
  );
}
