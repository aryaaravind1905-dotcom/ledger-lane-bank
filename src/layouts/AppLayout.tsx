import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { LayoutDashboard, ArrowLeftRight, Repeat2, CreditCard, ScrollText, LogOut, Users, Banknote, PiggyBank, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/app", end: true, icon: LayoutDashboard, label: "Dashboard" },
  { to: "/app/payments", icon: ArrowLeftRight, label: "Payments" },
  { to: "/app/beneficiaries", icon: Users, label: "Beneficiaries" },
  { to: "/app/autopay", icon: Repeat2, label: "AutoPay" },
  { to: "/app/loans", icon: Banknote, label: "Loans" },
  { to: "/app/fd", icon: PiggyBank, label: "Fixed Deposits" },
  { to: "/app/card", icon: CreditCard, label: "Card" },
  { to: "/app/support", icon: MessageCircle, label: "Support" },
  { to: "/app/policies", icon: ScrollText, label: "Policies" },
];

export default function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground animate-shimmer">Loading your bank…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-sidebar text-sidebar-foreground">
        <div className="px-6 py-7 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-md bg-gradient-gold flex items-center justify-center font-display text-accent-foreground font-bold">L</div>
            <div>
              <div className="font-display text-lg leading-none">Lovable Bank</div>
              <div className="text-xs text-sidebar-foreground/60 mt-1">Trusted since today</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ to, end, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={async () => { await signOut(); navigate("/auth"); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 bg-sidebar text-sidebar-foreground">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-gradient-gold flex items-center justify-center font-display text-accent-foreground font-bold">L</div>
            <span className="font-display">Lovable Bank</span>
          </div>
          <button onClick={async () => { await signOut(); navigate("/auth"); }} className="text-sm">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <div className="flex overflow-x-auto px-2 pb-2 gap-1">
          {nav.map(({ to, end, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap",
                  isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70"
                )
              }
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </NavLink>
          ))}
        </div>
      </div>

      <main className="flex-1 md:ml-0 pt-28 md:pt-0 overflow-x-hidden">
        <div className="max-w-6xl mx-auto px-4 md:px-10 py-8 md:py-12 animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
