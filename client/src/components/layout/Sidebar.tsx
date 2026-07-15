import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Layers,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  FileSearch,
  BellRing,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";

const navItems = [
  { href: "/", label: "Command Center", icon: LayoutDashboard },
  { href: "/research", label: "Research", icon: FileSearch },
  { href: "/parlay-builder", label: "Parlay Builder", icon: Layers },
  { href: "/alerts", label: "Alerts", icon: BellRing },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar();

  const content = (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-[#1a1a1a] bg-[#0c0c0c]/95 backdrop-blur-md transition-all duration-300",
        collapsed ? "w-[76px]" : "w-[248px]",
      )}
    >
      <div className={cn("flex h-16 items-center border-b border-[#1a1a1a] px-4", collapsed ? "justify-center" : "justify-between")}>
        <Link href="/" onClick={() => setMobileOpen(false)} className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-yellow-500/30 bg-gradient-to-br from-yellow-400/20 to-amber-600/10">
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.8)]" />
          </span>
          {!collapsed && (
            <div className="min-w-0 animate-in fade-in duration-300">
              <p className="truncate text-sm font-semibold tracking-tight text-white">Seraphim</p>
              <p className="truncate text-[10px] uppercase tracking-[0.18em] text-yellow-500/80">Analytics</p>
            </div>
          )}
        </Link>
        <button
          type="button"
          className="hidden h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-white/5 hover:text-yellow-400 lg:flex"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-white/5 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const active = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-all duration-200",
                active
                  ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-400 shadow-[0_0_24px_-8px_rgba(234,179,8,0.45)]"
                  : "border-transparent text-neutral-400 hover:bg-white/[0.03] hover:text-neutral-100",
                collapsed && "justify-center px-0",
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-yellow-400" : "text-neutral-500 group-hover:text-neutral-300",
                )}
              />
              {!collapsed && <span className="truncate font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[#1a1a1a] p-3">
        <div
          className={cn(
            "rounded-lg border border-yellow-500/15 bg-gradient-to-br from-yellow-500/10 to-transparent p-3",
            collapsed && "px-2",
          )}
        >
          {!collapsed ? (
            <>
              <p className="text-[11px] font-medium uppercase tracking-wider text-yellow-500/90">Sports bar</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                Switch NBA · NFL · ATP · WTA · WNBA from the tabs above the board.
              </p>
            </>
          ) : (
            <div className="mx-auto h-2 w-2 rounded-full bg-yellow-400" />
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex">{content}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[248px] shadow-2xl">{content}</div>
        </div>
      )}
    </>
  );
}
