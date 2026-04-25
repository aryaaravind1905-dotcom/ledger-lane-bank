import { useEffect, useState } from "react";
import { Link, useNavigate, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Headset, LogOut, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StaffLayout() {
  const navigate = useNavigate();
  const loc = useLocation();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const ok = sessionStorage.getItem("staff_key") === "demo-staff";
    setAuthed(ok);
    if (!ok) navigate("/staff", { replace: true });
  }, [navigate, loc.pathname]);

  if (!authed) return null;

  const logout = () => { sessionStorage.removeItem("staff_key"); navigate("/staff"); };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
              <Headset className="w-4 h-4" />
            </div>
            <div className="font-display text-lg">Staff Console</div>
            <nav className="ml-6 flex items-center gap-1">
              <Link to="/staff/tickets" className={cn(
                "px-3 py-1.5 rounded-md text-sm",
                loc.pathname.startsWith("/staff/tickets") ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}>
                <Inbox className="w-4 h-4 inline mr-1.5" /> Tickets
              </Link>
            </nav>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}><LogOut className="w-4 h-4" /> Sign out</Button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
