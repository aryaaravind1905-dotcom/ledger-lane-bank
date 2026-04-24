import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { z } from "zod";
import { toast } from "sonner";
import { Trash2, UserPlus } from "lucide-react";

type Beneficiary = { id: string; nickname: string; account_number: string; ifsc: string; holder_name: string };

const schema = z.object({
  nickname: z.string().trim().min(1).max(40),
  holder_name: z.string().trim().min(2).max(80),
  account_number: z.string().regex(/^\d{8,18}$/, "8–18 digits"),
  ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC"),
});

export default function Beneficiaries() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ nickname: "", holder_name: "", account_number: "", ifsc: "LOVB0000001" });

  const { data, isLoading } = useQuery({
    queryKey: ["beneficiaries", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("beneficiaries").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Beneficiary[];
    },
  });

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ ...form, ifsc: form.ifsc.toUpperCase() });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    const { error } = await supabase.from("beneficiaries").insert([{
      user_id: user!.id,
      nickname: parsed.data.nickname,
      holder_name: parsed.data.holder_name,
      account_number: parsed.data.account_number,
      ifsc: parsed.data.ifsc,
    }]);
    if (error) { toast.error(error.message); return; }
    toast.success("Beneficiary added");
    setForm({ nickname: "", holder_name: "", account_number: "", ifsc: "LOVB0000001" });
    qc.invalidateQueries({ queryKey: ["beneficiaries"] });
  };

  const onDelete = async (id: string) => {
    const { error } = await supabase.from("beneficiaries").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removed");
    qc.invalidateQueries({ queryKey: ["beneficiaries"] });
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl">Beneficiaries</h1>
        <p className="text-sm text-muted-foreground mt-1">Saved payees for faster transfers.</p>
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="font-display text-lg mb-4 flex items-center gap-2"><UserPlus className="w-4 h-4" /> Add beneficiary</h2>
          <form onSubmit={onAdd} className="space-y-4">
            <div className="space-y-1.5"><Label>Nickname</Label><Input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="Mom · Landlord" /></div>
            <div className="space-y-1.5"><Label>Account holder name</Label><Input value={form.holder_name} onChange={(e) => setForm({ ...form, holder_name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Account number</Label><Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value.replace(/\D/g, "") })} /></div>
            <div className="space-y-1.5"><Label>IFSC</Label><Input value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value.toUpperCase() })} /></div>
            <Button type="submit" className="w-full">Add beneficiary</Button>
          </form>
        </Card>

        <div>
          <h2 className="font-display text-lg mb-4">Saved ({data?.length ?? 0})</h2>
          <div className="space-y-3">
            {isLoading && <Card className="p-4 text-sm text-muted-foreground animate-shimmer">Loading…</Card>}
            {data?.length === 0 && <Card className="p-8 text-sm text-muted-foreground text-center">No beneficiaries yet</Card>}
            {data?.map((b) => (
              <Card key={b.id} className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium">{b.nickname}</div>
                  <div className="text-xs text-muted-foreground">{b.holder_name} · {b.account_number} · {b.ifsc}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onDelete(b.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
