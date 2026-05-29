import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Schedule from "./pages/Schedule";
import Medical from "./pages/Medical";
import Sports from "./pages/Sports";
import Camps from "./pages/Camps";
import Payments from "./pages/Payments";
import Categories from "./pages/Categories";
import FamilyCalendar from "./pages/FamilyCalendar";
import SharedCalendar from "./pages/SharedCalendar";
import NotFound from "./pages/not-found";

// Check for share token in query params (public read-only calendar link)
const shareToken = new URLSearchParams(window.location.search).get("share");

function AppRoutes() {
  const { authed } = useAuth();

  if (!authed) return <Login />;

  return (
    <Layout>
      <Router hook={useHashLocation}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/schedule" component={Schedule} />
          <Route path="/medical" component={Medical} />
          <Route path="/sports" component={Sports} />
          <Route path="/camps" component={Camps} />
          <Route path="/payments" component={Payments} />
          <Route path="/categories" component={Categories} />
          <Route path="/family-calendar" component={FamilyCalendar} />
          <Route component={NotFound} />
        </Switch>
      </Router>
    </Layout>
  );
}

export default function App() {
  // If a share token is present in the URL, render the public read-only calendar
  if (shareToken) {
    return (
      <QueryClientProvider client={queryClient}>
        <SharedCalendar token={shareToken} />
        <Toaster />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRoutes />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
