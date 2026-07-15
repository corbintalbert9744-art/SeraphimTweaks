import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { SPORT_TABS, sportTabFromPath } from "@/lib/sports";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";

export function SportTabs() {
  const [location] = useLocation();
  const { collapsed } = useSidebar();
  const activeId = sportTabFromPath(location);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });

  useEffect(() => {
    if (!activeId) {
      setIndicator((prev) => ({ ...prev, opacity: 0 }));
      return;
    }
    const el = tabRefs.current[activeId];
    const scroller = scrollerRef.current;
    if (!el || !scroller) return;

    const update = () => {
      const sRect = scroller.getBoundingClientRect();
      const tRect = el.getBoundingClientRect();
      setIndicator({
        left: tRect.left - sRect.left + scroller.scrollLeft,
        width: tRect.width,
        opacity: 1,
      });
    };

    update();
    el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });

    const ro = new ResizeObserver(update);
    ro.observe(scroller);
    ro.observe(el);
    scroller.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      scroller.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [activeId, location, collapsed]);

  return (
    <div
      className={cn(
        "sticky top-16 z-20 border-b border-[#1a1a1a] bg-[#0a0a0a]/90 backdrop-blur-xl",
        "lg:transition-[margin] lg:duration-300",
        collapsed ? "lg:ml-[76px]" : "lg:ml-[248px]",
      )}
    >
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          ref={scrollerRef}
          className="relative flex gap-1 overflow-x-auto py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Sports"
        >
          {/* Sliding active pill */}
          <div
            aria-hidden
            className="pointer-events-none absolute top-2.5 bottom-2.5 rounded-xl border border-yellow-500/35 bg-gradient-to-b from-yellow-500/20 to-amber-600/10 shadow-[0_0_28px_-10px_rgba(234,179,8,0.55)] transition-all duration-300 ease-out"
            style={{
              left: indicator.left,
              width: indicator.width,
              opacity: indicator.opacity,
            }}
          />

          {SPORT_TABS.map((tab) => {
            const active = activeId === tab.id;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                role="tab"
                aria-selected={active}
                ref={(node) => {
                  tabRefs.current[tab.id] = node;
                }}
                className={cn(
                  "relative z-10 flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-300",
                  active ? "text-yellow-300" : "text-neutral-400 hover:text-neutral-100",
                )}
              >
                <span className="text-base leading-none" aria-hidden>
                  {tab.emoji}
                </span>
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Gold underline accent */}
        <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-yellow-500/25 to-transparent sm:inset-x-6 lg:inset-x-8" />
      </div>
    </div>
  );
}
