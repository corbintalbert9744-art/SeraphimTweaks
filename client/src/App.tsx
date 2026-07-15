import { Switch, Route } from "wouter";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/AppShell";
import { ParlayDraftProvider } from "@/components/parlay/ParlayDraftContext";
import "@/data/registerLeagueProps";
import DashboardPage from "@/pages/analytics/DashboardPage";
import NbaPage from "@/pages/analytics/NbaPage";
import NflPage from "@/pages/analytics/NflPage";
import TennisPage from "@/pages/analytics/TennisPage";
import WnbaPage from "@/pages/analytics/WnbaPage";
import PlayerPage from "@/pages/analytics/PlayerPage";
import PropDetailPage from "@/pages/analytics/PropDetailPage";
import ParlayBuilderPage from "@/pages/analytics/ParlayBuilderPage";
import SettingsPage from "@/pages/analytics/SettingsPage";
import NotFound from "@/pages/not-found";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function Router() {
  return (
    <ParlayDraftProvider>
      <AppShell>
        <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/nba" component={NbaPage} />
          <Route path="/nfl" component={NflPage} />
          <Route path="/atp">{() => <TennisPage tour="ATP" />}</Route>
          <Route path="/wta">{() => <TennisPage tour="WTA" />}</Route>
          <Route path="/wnba" component={WnbaPage} />
          <Route path="/player/:id" component={PlayerPage} />
          <Route path="/prop/:id" component={PropDetailPage} />
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
