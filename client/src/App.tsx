import { Switch, Route } from "wouter";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/AppShell";
import { ParlayDraftProvider } from "@/components/parlay/ParlayDraftContext";
import DashboardPage from "@/pages/analytics/DashboardPage";
import NbaPage from "@/pages/analytics/NbaPage";
import LeaguePage from "@/pages/analytics/LeaguePage";
import ParlayBuilderPage from "@/pages/analytics/ParlayBuilderPage";
import SettingsPage from "@/pages/analytics/SettingsPage";
import NotFound from "@/pages/not-found";
import type { LeagueCode } from "@/data/mock";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function LeagueRoute({ league }: { league: LeagueCode }) {
  return <LeaguePage league={league} />;
}

function Router() {
  return (
    <ParlayDraftProvider>
      <AppShell>
        <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/nba" component={NbaPage} />
          <Route path="/nfl">{() => <LeagueRoute league="NFL" />}</Route>
          <Route path="/atp">{() => <LeagueRoute league="ATP" />}</Route>
          <Route path="/wta">{() => <LeagueRoute league="WTA" />}</Route>
          <Route path="/wnba">{() => <LeagueRoute league="WNBA" />}</Route>
          <Route path="/parlay-builder" component={ParlayBuilderPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch>
      </AppShell>
    </ParlayDraftProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ScrollToTop />
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
