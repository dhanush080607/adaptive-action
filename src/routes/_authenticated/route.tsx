import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { BarChart3, CalendarClock, LayoutDashboard, LogOut, PenLine, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppShell,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/capture", label: "Capture", icon: PenLine },
  { to: "/context", label: "Context", icon: Sparkles },
  { to: "/plan", label: "Plan", icon: CalendarClock },
  { to: "/insights", label: "Insights", icon: BarChart3 },
] as const;

function AppShell() {
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  };

  return (
    <div className="relative min-h-screen">
      {/* Glass Floating/Sticky Navbar */}
      <header className="sticky top-0 z-40 border-b border-primary/10 bg-background/60 backdrop-blur-md transition-all duration-200 shadow-sm shadow-primary/5">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
          {/* LifeOS Intelligent Brand Mark */}
          <Link
            to="/dashboard"
            className="group flex items-center gap-2 rounded-lg py-1 pr-2 text-base font-medium tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary border border-primary/20 shadow-[0_0_12px_rgba(6,182,212,0.15)] transition-all duration-300 group-hover:border-primary/40 group-hover:bg-primary/20 group-hover:shadow-[0_0_16px_rgba(6,182,212,0.3)]">
              <Sparkles className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
            </div>
            <span className="font-semibold text-foreground tracking-tight">
              Life<span className="text-primary font-bold">OS</span>
            </span>
          </Link>

          {/* Navigation Bar */}
          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="group flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                activeProps={{
                  className:
                    "!text-primary !bg-primary/15 !border-primary/20 border shadow-[0_0_10px_rgba(6,182,212,0.12)] font-semibold",
                }}
              >
                <item.icon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-105" />
                <span className="hidden sm:inline-block">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Sign Out Action */}
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="h-8 gap-1.5 px-2.5 text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive focus-visible:ring-1 focus-visible:ring-destructive/50"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Primary Application Workspace */}
      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}