import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Bell, LogOut, Menu, Search, Settings, User } from "lucide-react";
import { mockPlayers, type PlayerSearchResult } from "@/data/mock";
import { getPlayerProfile, listPlayerProfiles } from "@/data/playersMock";
import { useToast } from "@/hooks/use-toast";
import { useMembership } from "@/context/MembershipContext";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";

function buildSearchIndex(): PlayerSearchResult[] {
  const byId = new Map<string, PlayerSearchResult>();

  for (const p of mockPlayers) {
    byId.set(p.id, p);
  }

  for (const profile of listPlayerProfiles()) {
    byId.set(profile.id, {
      id: profile.id,
      name: profile.name,
      league: profile.league,
      team: profile.team,
      position: profile.position,
    });
  }

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

const SEARCH_INDEX = buildSearchIndex();

function hrefForPlayer(player: PlayerSearchResult): string {
  if (getPlayerProfile(player.id)) return `/player/${player.id}`;
  if (player.league === "NBA") return "/nba";
  if (player.league === "NFL") return "/nfl";
  if (player.league === "MLB") return "/mlb";
  if (player.league === "WNBA") return "/wnba";
  if (player.league === "ATP") return "/atp";
  if (player.league === "WTA") return "/wta";
  return "/players";
}

export function TopNav() {
  const { collapsed, setMobileOpen } = useSidebar();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, membershipActive, plan, signOut } = useMembership();
  const signedIn = Boolean(user);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as PlayerSearchResult[];
    return SEARCH_INDEX.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.team.toLowerCase().includes(q) ||
        p.league.toLowerCase().includes(q) ||
        p.position.toLowerCase().includes(q),
    ).slice(0, 8);
  }, [query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (!wrapRef.current?.contains(target)) setOpen(false);
      if (!notifRef.current?.contains(target)) setNotifOpen(false);
      if (!profileRef.current?.contains(target)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function goToPlayer(player: PlayerSearchResult) {
    setQuery("");
    setOpen(false);
    setLocation(hrefForPlayer(player));
  }

  function handleSignOut() {
    setProfileOpen(false);
    void signOut().then(() => {
      toast({
        title: "Signed out",
        description: "You’ve left the members dashboard.",
      });
      setLocation("~/");
    });
  }

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
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#1a1a1a] bg-[#111] text-neutral-300 hover:text-yellow-400 lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open sidebar"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="relative max-w-xl flex-1" ref={wrapRef}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) {
                e.preventDefault();
                goToPlayer(results[0]);
              }
              if (e.key === "Escape") {
                setOpen(false);
                setQuery("");
              }
            }}
            placeholder="Search players…"
            className="h-11 w-full rounded-xl border border-[#1a1a1a] bg-[#111]/90 pl-10 pr-4 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-500 focus:border-yellow-500/40 focus:ring-2 focus:ring-yellow-500/15"
            aria-autocomplete="list"
            aria-expanded={open && query.trim().length > 0}
          />
        </div>
        {open && query.trim() && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] shadow-2xl animate-in fade-in slide-in-from-top-1 duration-200">
            {results.length === 0 ? (
              <p className="px-4 py-6 text-sm text-neutral-500">No players match “{query}”.</p>
            ) : (
              <ul className="max-h-72 overflow-y-auto py-1" role="listbox">
                {results.map((player) => {
                  const hasProfile = Boolean(getPlayerProfile(player.id));
                  return (
                    <li key={player.id} role="option">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04]"
                        onClick={() => goToPlayer(player)}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-neutral-100">{player.name}</p>
                          <p className="truncate text-xs text-neutral-500">
                            {player.team} · {player.position}
                            {hasProfile ? " · Open profile" : " · Board"}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-md border border-yellow-500/20 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-yellow-400">
                          {player.league}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-[#1a1a1a] bg-[#111] text-neutral-300 transition hover:border-yellow-500/30 hover:text-yellow-400"
            onClick={() => {
              setNotifOpen((v) => !v);
              setProfileOpen(false);
            }}
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

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            onClick={() => {
              setProfileOpen((v) => !v);
              setNotifOpen(false);
            }}
            className={cn(
              "flex items-center gap-2 rounded-xl border bg-[#111] py-1.5 pl-1.5 pr-3 text-sm text-neutral-200 transition",
              profileOpen ? "border-yellow-500/40" : "border-[#1a1a1a] hover:border-yellow-500/30",
            )}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-400/25 to-amber-700/20 text-yellow-400">
              <User className="h-4 w-4" />
            </span>
              <span className="hidden text-left sm:block">
              <span className="block text-xs font-medium text-white">
                {signedIn ? user?.name || "Member" : "Guest"}
              </span>
              <span className="block text-[10px] text-neutral-500">
                {signedIn && membershipActive
                  ? plan === "pro"
                    ? "Pro Member"
                    : "Standard Member"
                  : signedIn
                    ? "No membership"
                    : "Signed out"}
              </span>
            </span>
          </button>

          {profileOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+8px)] w-72 overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] shadow-2xl animate-in fade-in slide-in-from-top-1 duration-200"
            >
              {signedIn ? (
                <>
                  <div className="border-b border-[#1a1a1a] px-4 py-3">
                    <p className="text-sm font-medium text-white">{user?.name || "Member"}</p>
                    <p className="text-xs text-neutral-500">{user?.email}</p>
                  </div>

                  <div className="border-b border-[#1a1a1a] px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                        Membership
                      </p>
                      <span className="rounded border border-yellow-500/30 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-400">
                        {plan === "pro" ? "Pro" : "Standard"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-neutral-200">
                      Seraphim IQ {plan === "pro" ? "Pro" : "Standard"}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                      Members-only research boards, Prop of the Day, Parlay Builder, and alerts.
                    </p>
                    <ul className="mt-2 space-y-1 text-[11px] text-neutral-400">
                      <li>· NBA · NFL · MLB · ATP · WTA · WNBA</li>
                      <li>· Research Score + DQS on props</li>
                      {plan === "pro" ? (
                        <li>· Private Discord picks + AI analysis</li>
                      ) : (
                        <>
                          <li>· Full research boards & unlimited props</li>
                          <li className="text-neutral-600">· No AI writeups or Discord picks</li>
                        </>
                      )}
                    </ul>
                  </div>

                  <div className="p-1.5">
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-neutral-300 transition hover:bg-white/[0.04] hover:text-white"
                      onClick={() => {
                        setProfileOpen(false);
                        setLocation("/settings");
                      }}
                    >
                      <Settings className="h-4 w-4 text-neutral-500" />
                      Settings
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-red-300 transition hover:bg-red-500/10"
                      onClick={handleSignOut}
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-4">
                  <p className="text-sm font-medium text-white">You’re signed out</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Return to the marketing site to log in or activate membership.
                  </p>
                  <button
                    type="button"
                    className="mt-3 w-full rounded-lg bg-yellow-500 px-3 py-2 text-sm font-semibold text-black transition hover:bg-yellow-400"
                    onClick={() => {
                      setProfileOpen(false);
                      setLocation("~/login");
                    }}
                  >
                    Log in
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
