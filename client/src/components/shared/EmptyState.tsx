import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#2a2a2a] bg-black/20 px-6 py-14 text-center",
        className,
      )}
    >
      <p className="text-base font-semibold text-neutral-200">{title}</p>
      {description && <p className="mt-2 max-w-md text-sm leading-relaxed text-neutral-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
