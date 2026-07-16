import { Switch, Route, Redirect, useLocation } from "wouter";
import { useEffect, type ReactNode } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/AppShell";
import { ParlayDraftProvider } from "@/components/parlay/ParlayDraftContext";
import { MembershipProvider, useMembership } from "@/context/MembershipContext";
import DashboardPage from "@/pages/analytics/DashboardPage";
import CommandCenterPage from "@/pages/analytics/CommandCenterPage";
import NbaPage from "@/pages/analytics/NbaPage";
import NflPage from "@/pages/analytics/NflPage";
import MlbPage from "@/pages/analytics/MlbPage";
import TennisPage from "@/pages/analytics/TennisPage";
import WnbaPage from "@/pages/analytics/WnbaPage";
import PlayersHubPage from "@/pages/analytics/PlayersHubPage";
import ResearchHubPage from "@/pages/analytics/ResearchHubPage";
import PlayerPage from "@/pages/analytics/PlayerPage";
import PropDetailPage from "@/pages/analytics/PropDetailPage";
import ParlayBuilderPage from "@/pages/analytics/ParlayBuilderPage";
import AlertsPage from "@/pages/analytics/AlertsPage";
import SettingsPage from "@/pages/analytics/SettingsPage";
import MarketingHomePage from "@/pages/marketing/HomePage";
import FeaturesPage from "@/pages/marketing/FeaturesPage";
import SportsPage from "@/pages/marketing/SportsPage";
import PricingPage from "@/pages/marketing/PricingPage";
import FaqPage from "@/pages/marketing/FaqPage";
import LoginPage from "@/pages/marketing/LoginPage";
import SignupPage from "@/pages/marketing/SignupPage";
import CheckoutPage from "@/pages/marketing/CheckoutPage";
import SuccessPage from "@/pages/marketing/SuccessPage";
import NotFound from "@/pages/not-found";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function RequireMember({ children }: { children: ReactNode }) {
  const { isAuthenticated, membershipActive, loading } = useMembership();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-sm text-neutral-400">
        Checking membership…
      </div>
    );
  }
  if (!isAuthenticated) return <Redirect to="~/login" />;
  if (!membershipActive) return <Redirect to="~/checkout" />;
  return <>{children}</>;
}

function MembersApp() {
  return (
    <RequireMember>
      <ParlayDraftProvider>
        <AppShell>
          <Switch>
            <Route path="/dashboard" component={DashboardPage} />
            <Route path="/nba" component={NbaPage} />
            <Route path="/nfl" component={NflPage} />
            <Route path="/mlb" component={MlbPage} />
            <Route path="/players" component={PlayersHubPage} />
            <Route path="/research" component={ResearchHubPage} />
            <Route path="/atp">{() => <TennisPage tour="ATP" />}</Route>
            <Route path="/wta">{() => <TennisPage tour="WTA" />}</Route>
            <Route path="/wnba" component={WnbaPage} />
            <Route path="/player/:id" component={PlayerPage} />
            <Route path="/prop/:id" component={PropDetailPage} />
            <Route path="/parlay-builder" component={ParlayBuilderPage} />
            <Route path="/alerts" component={AlertsPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/" component={CommandCenterPage} />
            <Route component={NotFound} />
          </Switch>
        </AppShell>
      </ParlayDraftProvider>
    </RequireMember>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={MarketingHomePage} />
      <Route path="/features" component={FeaturesPage} />
      <Route path="/sports" component={SportsPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/faq" component={FaqPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/checkout" component={CheckoutPage} />
      <Route path="/success" component={SuccessPage} />

      <Route path="/app" nest>
        <MembersApp />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MembershipProvider>
          <ScrollToTop />
          <Toaster />
          <AppRouter />
        </MembershipProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
