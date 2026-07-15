import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { SidebarContext } from "./sidebar-context";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, mobileOpen, setMobileOpen }}>
      <div className="analytics-shell relative min-h-screen bg-[#0a0a0a] text-neutral-100">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_15%_-10%,rgba(212,175,55,0.12),transparent_55%)]" />
        <Sidebar />
        <TopNav />
        <main
          className={cn(
            "relative z-10 px-4 py-6 sm:px-6 lg:px-8 lg:transition-[margin] lg:duration-300",
            collapsed ? "lg:ml-[76px]" : "lg:ml-[248px]",
          )}
        >
          <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            {children}
          </div>
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
