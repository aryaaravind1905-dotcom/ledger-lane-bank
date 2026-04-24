import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePrimaryAccount } from "@/hooks/useBanking";
import { z } from "zod";
import { toast } from "sonner";
import { formatINR, rupeesToPaise, formatDateTime } from "@/lib/format";
import { Repeat2, Pause, Play, Trash2 } from "lucide-react";

type AutoPay = {
  id: string;
  nickname: string;
  to_account_number: string;
  to_ifsc: string;
  amount_paise: number;
  frequency: "daily" | "weekly" | "monthly";
  status: "active" | "paused" | "disabled";
  next_run_at: string;
  last_run_at: string | null;
  last_status: string | null;
  consecutive_failures: number;
};

const schema = z.object({
  nickname: z.string().trim().min(1).max(40),
  to_account_number: z.string().regex(/^\d{8,18}$/, "8–18 digits"),
  to_ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC"),
  amount: z.number().positive().max(100000, "Per-transaction limit is ₹1,00,000"),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  start_date: z.string().min(10),
});

export default function AutoPay() {
  const { user } = useAuth();
  const { account } = usePrimaryAccount();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nickname: "", to_account_number: "", to_ifsc: "LOVB0000001",
    amount: "", frequency: "monthly" as const, start_date: new Date().toISOString().slice(0, 10),
  });

  const { data: items } = useQuery({
    queryKey: ["autopay", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("autopay_configs").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as AutoPay[];
    },
  });

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!account) return;
    const parsed = schema.safeParse({
      ...form, to_ifsc: form.to_ifsc.toUpperCase(), amount: parseFloat(form.amount),
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    const { error } = await supabase.from("autopay_configs").insert([{
      user_id: user!.id,
      from_account_id: account.id,
      nickname: parsed.data.nickname,
      to_account_number: parsed.data.to_account_number,
      to_ifsc: parsed.data.to_ifsc,
      amount_paise: rupeesToPaise(parsed.data.amount),
      frequency: parsed.data.frequency,
      next_run_at: new Date(parsed.data.start_date).toISOString(),
    }]);
    if (error) { toast.error(error.message); return; }
    toast.success("AutoPay scheduled");
    setForm({ ...form, nickname: "", to_account_number: "", amount: "" });
    qc.invalidateQueries({ queryKey: ["autopay"] });
  };

  const toggle = async (a: AutoPay) => {
    const next = a.status === "active" ? "paused" : "active";
    const { error } = await supabase.from("autopay_configs").update({ status: next }).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["autopay"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("autopay_configs").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["autopay"] });
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl flex items-center gap-2"><Repeat2 className="w-7 h-7" /> AutoPay</h1>
        <p className="text-sm text-muted-foreground mt-1">Recurring payments. Auto-disables after 3 consecutive failures (24h retry gap).</p>
      </header>

      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="p-6 lg:col-span-2">
          <h2 className="font-display text-lg mb-4">Create new</h2>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-1.5"><Label>Nickname</Label><Input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="Netflix · Rent" /></div>
            <div className="space-y-1.5"><Label>Recipient account</Label><Input value={form.to_account_number} onChange={(e) => setForm({ ...form, to_account_number: e.target.value.replace(/\D/g, "") })} /></div>
            <div className="space-y-1.5"><Label>IFSC</Label><Input value={form.to_ifsc} onChange={(e) => setForm({ ...form, to_ifsc: e.target.value.toUpperCase() })} /></div>
            <div className="space-y-1.5"><Label>Amount (₹)</Label><Input type="number" step="0.01" min="1" max="100000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={(v: any) => setForm({ ...form, frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Starts</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            </div>
            <Button type="submit" className="w-full">Schedule AutoPay</Button>
          </form>
        </Card>

        <div className="lg:col-span-3 space-y-3">
          <h2 className="font-display text-lg">Scheduled ({items?.length ?? 0})</h2>
          {items?.length === 0 && <Card className="p-8 text-sm text-muted-foreground text-center">No AutoPays yet</Card>}
          {items?.map((a) => (
            <Card key={a.id} className="p-5">
              <div className="flex justify-between items-start gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{a.nickname}</span>
                    <Badge variant={a.status === "active" ? "default" : a.status === "disabled" ? "destructive" : "secondary"} className="capitalize">{a.status}</Badge>
                    <span className="text-xs text-muted-foreground capitalize">{a.frequency}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    To {a.to_account_number} · {a.to_ifsc}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Next run: {formatDateTime(a.next_run_at)}
                    {a.last_run_at && <> · last: {a.last_status} ({formatDateTime(a.last_run_at)})</>}
                    {a.consecutive_failures > 0 && <> · <span className="text-destructive">{a.consecutive_failures} fail(s)</span></>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="stat-number font-semibold">{formatINR(a.amount_paise)}</div>
                  <div className="flex gap-1 mt-2">
                    {a.status !== "disabled" && (
                      <Button size="icon" variant="ghost" onClick={() => toggle(a)}>
                        {a.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => remove(a.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
