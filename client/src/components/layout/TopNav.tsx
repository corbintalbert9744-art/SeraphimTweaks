import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Menu, Search, User } from "lucide-react";
import { mockPlayers, type PlayerSearchResult } from "@/data/mock";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";

export function TopNav() {
  const { collapsed, setMobileOpen } = useSidebar();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as PlayerSearchResult[];
    return mockPlayers.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.team.toLowerCase().includes(q) ||
        p.league.toLowerCase().includes(q),
    );
  }, [query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[#1a1a1a] bg-[#0a0a0a]/85 px-4 backdrop-blur-xl sm:px-6",
        "lg:transition-[margin] lg:duration-300",
        collapsed ? "lg:ml-[76px]" : "lg:ml-[248px]",
      )}
    >
      <button
        type="button"
        className="lg:hidden flex h-10 w-10 items-center justify-center rounded-lg border border-[#1a1a1a] bg-[#111] text-neutral-300 hover:text-yellow-400"
        onClick={() => setMobileOpen(true)}
        aria-label="Open sidebar"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="relative flex-1 max-w-xl" ref={wrapRef}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search players across NBA, NFL, WNBA, ATP, WTA…"
            className="h-11 w-full rounded-xl border border-[#1a1a1a] bg-[#111]/90 pl-10 pr-4 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none transition focus:border-yellow-500/40 focus:ring-2 focus:ring-yellow-500/15"
          />
        </div>
        {open && query.trim() && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] shadow-2xl animate-in fade-in slide-in-from-top-1 duration-200">
            {results.length === 0 ? (
              <p className="px-4 py-6 text-sm text-neutral-500">No players match “{query}”.</p>
            ) : (
              <ul className="max-h-72 overflow-y-auto py-1">
                {results.map((player) => (
                  <li key={player.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03]"
                      onClick={() => {
                        setQuery(player.name);
                        setOpen(false);
                      }}
                    >
                      <div>
                        <p className="text-sm font-medium text-neutral-100">{player.name}</p>
                        <p className="text-xs text-neutral-500">
                          {player.team} · {player.position}
                        </p>
                      </div>
                      <span className="rounded-md border border-yellow-500/20 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-yellow-400">
                        {player.league}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative">
          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-[#1a1a1a] bg-[#111] text-neutral-300 transition hover:border-yellow-500/30 hover:text-yellow-400"
            onClick={() => setNotifOpen((v) => !v)}
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-yellow-400" />
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-80 overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] shadow-2xl animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="border-b border-[#1a1a1a] px-4 py-3">
                <p className="text-sm font-medium text-white">Notifications</p>
                <p className="text-xs text-neutral-500">Mock feed — wire to jobs later</p>
              </div>
              <ul className="divide-y divide-[#1a1a1a]">
                <li className="px-4 py-3 text-sm text-neutral-300">Research scores refreshed for NBA slate.</li>
                <li className="px-4 py-3 text-sm text-neutral-300">Injury uncertainty flagged on KC props.</li>
                <li className="px-4 py-3 text-sm text-neutral-300">ATP odds adapter heartbeat OK.</li>
              </ul>
            </div>
          )}
        </div>

        <button
          type="button"
          className="flex items-center gap-2 rounded-xl border border-[#1a1a1a] bg-[#111] py-1.5 pl-1.5 pr-3 text-sm text-neutral-200 transition hover:border-yellow-500/30"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-400/25 to-amber-700/20 text-yellow-400">
            <User className="h-4 w-4" />
          </span>
          <span className="hidden sm:block">
            <span className="block text-xs font-medium text-white">Analyst</span>
            <span className="block text-[10px] text-neutral-500">Pro · Mock</span>
          </span>
        </button>
      </div>
    </header>
  );
}
