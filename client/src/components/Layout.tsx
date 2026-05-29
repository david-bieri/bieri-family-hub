import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard, Calendar, Stethoscope, Trophy,
  Tent, CreditCard, LogOut, Menu, X, Moon, Sun, Tag, CalendarDays, Inbox, PawPrint
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/",               label: "Dashboard",      icon: LayoutDashboard },
  { href: "/family-calendar",label: "Family Calendar", icon: CalendarDays },
  { href: "/schedule",       label: "Schedule",       icon: Calendar },
  { href: "/medical",        label: "Medical",        icon: Stethoscope },
  { href: "/sports",         label: "Sports",         icon: Trophy },
  { href: "/camps",          label: "Camps & Reg.",   icon: Tent },
  { href: "/payments",       label: "Payments",       icon: CreditCard },
  { href: "/categories",     label: "Categories",     icon: Tag },
  { href: "/pets",           label: "Pets",            icon: PawPrint },
  { href: "/inbox",          label: "Inbox",           icon: Inbox, badge: true },
];

function useDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  function toggle() {
    setDark(d => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  }
  return { dark, toggle };
}

function useInboxCount() {
  const { data } = useQuery({
    queryKey: ["/api/inbox/count"],
    queryFn: async () => (await apiRequest("GET", "/api/inbox/count")).json(),
    refetchInterval: 60_000,
  });
  return (data as any)?.count || 0;
}

export default function Layout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const { dark, toggle } = useDark();
  const inboxCount = useInboxCount();

  const sidebar = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-border">
        <svg aria-label="Bieri Family Hub" viewBox="0 0 32 32" width="28" height="28" fill="none">
          <rect width="32" height="32" rx="7" fill="hsl(152 35% 30%)" />
          <path d="M16 8 L8 15 h2.8 v9 h10.4v-9 h2.8 Z" fill="white" />
        </svg>
        <div>
          <div className="text-sm font-bold leading-tight">Bieri Family</div>
          <div className="text-[11px] text-muted-foreground leading-tight">Family Hub</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon, badge }) => {
          const active = href === "/" ? location === "/" : location.startsWith(href);
          const showBadge = badge && inboxCount > 0;
          return (
            <Link key={href} href={href}>
              <a
                data-testid={`nav-${label.toLowerCase().replace(/[^a-z]/g, "")}`}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <Icon size={16} />
                <span className="flex-1">{label}</span>
                {showBadge && (
                  <span className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none",
                    active ? "bg-white/30 text-white" : "bg-primary text-primary-foreground"
                  )}>
                    {inboxCount}
                  </span>
                )}
              </a>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-border flex items-center gap-1">
        <Button
          variant="ghost" size="icon"
          onClick={toggle}
          aria-label="Toggle theme"
          className="h-8 w-8"
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </Button>
        <Button
          variant="ghost" size="sm"
          onClick={logout}
          className="flex-1 justify-start gap-2 h-8 text-muted-foreground hover:text-foreground text-xs"
          data-testid="button-logout"
        >
          <LogOut size={14} />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-52 shrink-0 border-r border-border bg-card flex-col">
        {sidebar}
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-52 bg-card border-r border-border z-50">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(true)}>
            <Menu size={18} />
          </Button>
          <span className="text-sm font-semibold">Bieri Family Hub</span>
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
