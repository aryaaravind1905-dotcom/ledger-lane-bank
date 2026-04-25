import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Ticket = {
  id: string;
  subject: string;
  status: "open" | "escalated" | "resolved";
  classification: string;
  created_at: string;
};

const statusClasses = (s: string) =>
  s === "resolved" ? "bg-success/10 text-success border-success/30"
  : s === "escalated" ? "bg-warning/10 text-warning border-warning/30"
  : "bg-primary/10 text-primary border-primary/30";

export default function SupportList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [firstMsg, setFirstMsg] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      setTickets((data ?? []) as Ticket[]);
    })();
    const ch = supabase
      .channel(`tickets-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets", filter: `user_id=eq.${user.id}` }, async () => {
        const { data } = await supabase.from("support_tickets").select("*").order("created_at", { ascending: false });
        setTickets((data ?? []) as Ticket[]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const create = async () => {
    if (!subject.trim() || !firstMsg.trim() || !user) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .insert({ user_id: user.id, subject: subject.trim() })
        .select()
        .single();
      if (error) throw error;
      // Kick off the agent with the first message
      await supabase.functions.invoke("support-agent", {
        body: { ticket_id: data.id, user_message: firstMsg.trim() },
      });
      setOpen(false);
      setSubject(""); setFirstMsg("");
      navigate(`/app/support/${data.id}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not create ticket");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl md:text-4xl">Support</h1>
          <p className="text-muted-foreground mt-1">Chat with our AI agent — escalate to a human if needed.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4" /> Create New Ticket</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New support ticket</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Subject</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. My card got blocked" />
              </div>
              <div>
                <label className="text-sm font-medium">Describe your issue</label>
                <Textarea value={firstMsg} onChange={(e) => setFirstMsg(e.target.value)} rows={4} placeholder="What's going on?" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={create} disabled={creating || !subject.trim() || !firstMsg.trim()}>
                {creating ? "Creating…" : "Open ticket"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-hidden">
        {tickets.length === 0 ? (
          <div className="p-12 text-center">
            <MessageCircle className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No tickets yet. Open one to get help.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket ID</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((t) => (
                <TableRow key={t.id} className="cursor-pointer" onClick={() => navigate(`/app/support/${t.id}`)}>
                  <TableCell className="font-mono text-xs">#{t.id.slice(0, 8)}</TableCell>
                  <TableCell className="font-medium">{t.subject}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("capitalize", statusClasses(t.status))}>{t.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell><Link className="text-primary text-sm" to={`/app/support/${t.id}`}>Open</Link></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
