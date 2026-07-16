import type { FeedItem } from "@/data/mock";
import { cn } from "@/lib/utils";

export function RecentUpdatesFeed({ items }: { items: FeedItem[] }) {
  return (
    <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-white">Recent Updates</h2>
        <p className="text-xs text-neutral-500">Pipeline activity · mock</p>
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3">
            <span
              className={cn(
                "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                item.tone === "success" && "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]",
                item.tone === "warn" && "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]",
                item.tone === "info" && "bg-yellow-400/80",
              )}
            />
            <div className="min-w-0 flex-1 border-b border-[#151515] pb-3 last:border-0">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-neutral-100">{item.title}</p>
                <span className="shrink-0 text-[11px] text-neutral-500">{item.time}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
