import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Mic, MicOff, ArrowLeft, Bot, User as UserIcon, Headset, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type Sender = "user" | "ai" | "staff";
type Message = {
  id: string;
  ticket_id: string;
  sender: Sender;
  content: string;
  created_at: string;
};
type Ticket = {
  id: string;
  subject: string;
  status: "open" | "escalated" | "resolved";
  classification: string;
  created_at: string;
};

const statusVariant = (s: string) =>
  s === "resolved" ? "bg-success/10 text-success border-success/30"
  : s === "escalated" ? "bg-warning/10 text-warning border-warning/30"
  : "bg-primary/10 text-primary border-primary/30";

export default function SupportTicket() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recogRef = useRef<any>(null);

  // Load ticket + messages
  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: t }, { data: msgs }] = await Promise.all([
        supabase.from("support_tickets").select("*").eq("id", id).single(),
        supabase.from("ticket_messages").select("*").eq("ticket_id", id).order("created_at", { ascending: true }),
      ]);
      if (t) setTicket(t as Ticket);
      if (msgs) setMessages(msgs as Message[]);
    })();
  }, [id]);

  // Realtime subscriptions
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`ticket-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${id}` }, (payload) => {
        setMessages((prev) => {
          if (prev.find((m) => m.id === (payload.new as any).id)) return prev;
          return [...prev, payload.new as Message];
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "support_tickets", filter: `id=eq.${id}` }, (payload) => {
        setTicket(payload.new as Ticket);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  // Autoscroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = async () => {
    if (!input.trim() || !id || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    // optimistic user bubble
    const optimistic: Message = {
      id: `tmp-${Date.now()}`, ticket_id: id, sender: "user", content: text, created_at: new Date().toISOString(),
    };
    setMessages((p) => [...p, optimistic]);
    try {
      const { data, error } = await supabase.functions.invoke("support-agent", {
        body: { ticket_id: id, user_message: text },
      });
      if (error) throw error;
      if (data?.escalated) toast.info("Escalated to a human agent");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send");
      setMessages((p) => p.filter((m) => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  const toggleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Voice input not supported in this browser"); return; }
    if (listening) { recogRef.current?.stop(); setListening(false); return; }
    const r = new SR();
    r.lang = "en-IN";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join(" ");
      setInput(t);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recogRef.current = r;
    r.start();
    setListening(true);
  };

  if (!session) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <Link to="/app/support" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> All tickets
        </Link>
        {ticket && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">{ticket.classification}</Badge>
            <Badge variant="outline" className={cn("capitalize border", statusVariant(ticket.status))}>{ticket.status}</Badge>
          </div>
        )}
      </div>
      <div className="mb-3">
        <h1 className="font-display text-2xl">{ticket?.subject ?? "Loading…"}</h1>
        <p className="text-xs text-muted-foreground font-mono">#{id?.slice(0, 8)}</p>
      </div>

      {/* Chat area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1">
          <div ref={scrollRef as any} className="p-4 md:p-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-12">
                Start the conversation — I'll fetch your account data and help.
              </div>
            )}
            {messages.map((m) => <Bubble key={m.id} m={m} />)}
            {sending && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm pl-12">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Assistant is thinking…
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t bg-card p-3 md:p-4">
          {ticket?.status === "resolved" ? (
            <div className="text-center text-sm text-muted-foreground py-2">
              This ticket is resolved. <Link className="text-primary underline" to="/app/support">Open a new one</Link>.
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button type="button" size="icon" variant={listening ? "default" : "outline"} onClick={toggleMic} title="Voice input">
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Type your message…"
                disabled={sending}
                className="flex-1"
              />
              <Button onClick={send} disabled={sending || !input.trim()} size="icon">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function Bubble({ m }: { m: Message }) {
  const isUser = m.sender === "user";
  const isAI = m.sender === "ai";
  const isStaff = m.sender === "staff";
  const time = new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          isAI ? "bg-primary/10 text-primary" : "bg-accent/20 text-accent-foreground"
        )}>
          {isAI ? <Bot className="w-4 h-4" /> : <Headset className="w-4 h-4" />}
        </div>
      )}
      <div className={cn("max-w-[75%] flex flex-col", isUser ? "items-end" : "items-start")}>
        <div className={cn(
          "rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words",
          isUser && "bg-primary text-primary-foreground rounded-br-sm",
          isAI && "bg-muted text-foreground rounded-bl-sm",
          isStaff && "bg-accent/15 text-foreground border border-accent/40 rounded-bl-sm",
        )}>
          {isStaff && <div className="text-[10px] uppercase tracking-wide font-semibold mb-1 text-accent-foreground/70">Staff</div>}
          {m.content}
        </div>
        <span className="text-[10px] text-muted-foreground mt-1 px-1">{time}</span>
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <UserIcon className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}
