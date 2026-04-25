import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  status: "open" | "escalated" | "resolved";
  classification: string;
  created_at: string;
};

const statusClasses = (s: string) =>
  s === "resolved" ? "bg-success/10 text-success border-success/30"
  : s === "escalated" ? "bg-warning/10 text-warning border-warning/30"
  : "bg-primary/10 text-primary border-primary/30";

export default function StaffTickets() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "auto_resolved" | "escalated">("all");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staff-list?filter=${filter}`;
    const res = await fetch(url, { headers: { "x-staff-key": "demo-staff" } });
    const json = await res.json();
    setTickets(json.tickets ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  // Realtime refresh
  useEffect(() => {
    const ch = supabase
      .channel("staff-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [filter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Tickets</h1>
        <p className="text-muted-foreground mt-1">Support queue across all customers.</p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="auto_resolved">Auto-resolved</TabsTrigger>
          <TabsTrigger value="escalated">Escalated</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket ID</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Classification</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (<TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">Loading…</TableCell></TableRow>)}
            {!loading && tickets.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">No tickets in this view.</TableCell></TableRow>
            )}
            {tickets.map((t) => (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => navigate(`/staff/tickets/${t.id}`)}>
                <TableCell className="font-mono text-xs">#{t.id.slice(0, 8)}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{t.user_id.slice(0, 8)}…</TableCell>
                <TableCell className="font-medium">{t.subject}</TableCell>
                <TableCell><Badge variant="outline" className={cn("capitalize", statusClasses(t.status))}>{t.status}</Badge></TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{t.classification}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(t.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
