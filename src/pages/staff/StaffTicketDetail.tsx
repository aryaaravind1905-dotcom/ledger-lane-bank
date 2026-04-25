import { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Bot, User as UserIcon, Headset, CheckCircle2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Sender = "user" | "ai" | "staff";
type Message = { id: string; sender: Sender; content: string; created_at: string };
type Ticket = {
  id: string; user_id: string; subject: string;
  status: "open" | "escalated" | "resolved"; classification: string;
  created_at: string;
};

const statusClasses = (s: string) =>
  s === "resolved" ? "bg-success/10 text-success border-success/30"
  : s === "escalated" ? "bg-warning/10 text-warning border-warning/30"
  : "bg-primary/10 text-primary border-primary/30";

export default function StaffTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staff-list?id=${id}`;
    const res = await fetch(url, { headers: { "x-staff-key": "demo-staff" } });
    const json = await res.json();
    setTicket(json.ticket);
    setMessages(json.messages ?? []);
    setProfile(json.profile);
  };

  useEffect(() => { if (id) load(); }, [id]);

  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`staff-ticket-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets", filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendReply = async () => {
    if (!reply.trim() || !id) return;
    setBusy(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staff-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-staff-key": "demo-staff" },
        body: JSON.stringify({ action: "reply", ticket_id: id, content: reply.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      setReply("");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send");
    } finally { setBusy(false); }
  };

  const resolve = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staff-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-staff-key": "demo-staff" },
        body: JSON.stringify({ action: "resolve", ticket_id: id }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Ticket resolved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <Link to="/staff/tickets" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-fit">
        <ArrowLeft className="w-4 h-4" /> Back to queue
      </Link>

      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        <Card className="flex flex-col h-[calc(100vh-12rem)] overflow-hidden">
          <div className="border-b p-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl">{ticket?.subject}</h2>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">#{id?.slice(0, 8)}</p>
            </div>
            <div className="flex gap-2">
              {ticket && <Badge variant="outline" className={cn("capitalize", statusClasses(ticket.status))}>{ticket.status}</Badge>}
              {ticket && <Badge variant="outline" className="capitalize">{ticket.classification}</Badge>}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div ref={scrollRef as any} className="p-4 space-y-4">
              {messages.map((m) => <StaffBubble key={m.id} m={m} />)}
            </div>
          </ScrollArea>

          {ticket?.status !== "resolved" && (
            <div className="border-t p-3 space-y-2">
              <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type a reply to the customer…" rows={3} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resolve} disabled={busy}>
                  <CheckCircle2 className="w-4 h-4" /> Mark as Resolved
                </Button>
                <Button onClick={sendReply} disabled={busy || !reply.trim()}>
                  <Send className="w-4 h-4" /> Send Reply
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5 space-y-4 h-fit">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Customer</div>
            <div className="font-medium mt-1">{profile?.full_name ?? "—"}</div>
            <div className="font-mono text-xs text-muted-foreground mt-0.5">{ticket?.user_id.slice(0, 16)}…</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Created</div>
            <div className="text-sm mt-1">{ticket && new Date(ticket.created_at).toLocaleString("en-IN")}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Messages</div>
            <div className="text-sm mt-1">{messages.length}</div>
          </div>
          <div className="pt-3 border-t">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Legend</div>
            <div className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded bg-muted border"/> User</div>
            <div className="flex items-center gap-2 text-xs mt-1"><span className="w-3 h-3 rounded bg-primary/15 border border-primary/30"/> AI</div>
            <div className="flex items-center gap-2 text-xs mt-1"><span className="w-3 h-3 rounded bg-accent/20 border border-accent/40"/> Staff</div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StaffBubble({ m }: { m: Message }) {
  const time = new Date(m.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" });
  const meta = {
    user: { Icon: UserIcon, label: "Customer", cls: "bg-muted border-border" },
    ai: { Icon: Bot, label: "AI Agent", cls: "bg-primary/10 border-primary/30" },
    staff: { Icon: Headset, label: "Staff", cls: "bg-accent/15 border-accent/40" },
  }[m.sender];

  return (
    <div className="flex gap-3">
      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 border", meta.cls)}>
        <meta.Icon className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide">{meta.label}</span>
          <span className="text-[10px] text-muted-foreground">{time}</span>
        </div>
        <div className={cn("mt-1 rounded-lg border p-3 text-sm whitespace-pre-wrap break-words", meta.cls)}>
          {m.content}
        </div>
      </div>
    </div>
  );
}
