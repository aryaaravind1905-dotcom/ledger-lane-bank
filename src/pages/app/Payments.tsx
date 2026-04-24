import { useState, FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { usePrimaryAccount, useBalance, useTransactions } from "@/hooks/useBanking";
import { formatINR, rupeesToPaise } from "@/lib/format";
import { toast } from "sonner";
import TxnRow from "@/components/TxnRow";
import { QrCode, Camera } from "lucide-react";

const sendSchema = z.object({
  to_account_number: z.string().regex(/^\d{8,18}$/, "Account number must be 8–18 digits"),
  to_ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC (e.g. LOVB0000001)"),
  amount: z.number().positive("Amount must be positive").max(100000, "Per-transaction limit is ₹1,00,000"),
  description: z.string().trim().max(120).optional(),
});

export default function Payments() {
  const qc = useQueryClient();
  const { account } = usePrimaryAccount();
  const { data: balance } = useBalance(account?.id);
  const { data: txns } = useTransactions(account?.id, 30);

  const [form, setForm] = useState({
    to_account_number: "",
    to_ifsc: "LOVB0000001",
    amount: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"transfer" | "qr">("transfer");

  const onSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!account) return;
    const parsed = sendSchema.safeParse({
      to_account_number: form.to_account_number,
      to_ifsc: form.to_ifsc.toUpperCase(),
      amount: parseFloat(form.amount),
      description: form.description,
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }

    setSubmitting(true);
    try {
      const idem = `web:${account.id}:${Date.now()}:${Math.random().toString(36).slice(2,8)}`;
      const { data, error } = await supabase.rpc("execute_transfer", {
        p_from_account: account.id,
        p_to_account_number: parsed.data.to_account_number,
        p_to_ifsc: parsed.data.to_ifsc,
        p_amount_paise: rupeesToPaise(parsed.data.amount),
        p_description: parsed.data.description || null,
        p_idempotency_key: idem,
        p_kind: "transfer",
      });
      if (error) throw error;
      const result = data as { status: string; reason?: string };
      if (result.status === "success") {
        toast.success(`Sent ${formatINR(rupeesToPaise(parsed.data.amount))}`);
        setForm({ ...form, to_account_number: "", amount: "", description: "" });
      } else {
        toast.error(`Payment failed: ${result.reason ?? "unknown"}`);
      }
      qc.invalidateQueries({ queryKey: ["balance"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    } catch (err: any) {
      toast.error(err.message?.replace(/_/g, " ") ?? "Transfer failed");
    } finally {
      setSubmitting(false);
    }
  };

  // QR is just a payload preview: account|ifsc|amount
  const qrPayload = account ? `upi://pay?pa=${account.account_number}@lovablebank&pn=Me&am=` : "";

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl">Payments</h1>
        <p className="text-sm text-muted-foreground mt-1">Available balance: <span className="stat-number font-semibold text-foreground">{formatINR(balance ?? 0)}</span></p>
      </header>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <Card className="p-6">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList className="mb-6">
                <TabsTrigger value="transfer">Bank transfer</TabsTrigger>
                <TabsTrigger value="qr">QR code</TabsTrigger>
              </TabsList>
              <TabsContent value="transfer">
                <form onSubmit={onSend} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Recipient account number</Label>
                    <Input value={form.to_account_number} onChange={(e) => setForm({ ...form, to_account_number: e.target.value.replace(/\D/g, "") })} placeholder="123456789012" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>IFSC</Label>
                    <Input value={form.to_ifsc} onChange={(e) => setForm({ ...form, to_ifsc: e.target.value.toUpperCase() })} />
                    <p className="text-xs text-muted-foreground">Default <code className="font-mono">LOVB0000001</code> stays inside Lovable Bank.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Amount (₹)</Label>
                    <Input type="number" step="0.01" min="1" max="100000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
                    <p className="text-xs text-muted-foreground">Max ₹1,00,000 per transaction · ₹5,00,000 daily.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Note (optional)</Label>
                    <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Rent · groceries · etc" maxLength={120} />
                  </div>
                  <Button type="submit" size="lg" disabled={submitting} className="w-full">
                    {submitting ? "Processing…" : "Send money"}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="qr">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Your QR (receive)</Label>
                    <div className="aspect-square bg-surface-muted rounded-lg border border-border flex items-center justify-center p-6">
                      <div className="text-center space-y-3">
                        <QrCode className="w-32 h-32 mx-auto text-primary" />
                        <code className="text-xs text-muted-foreground break-all">{qrPayload || "—"}</code>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Scan to pay (simulated)</Label>
                    <div className="aspect-square bg-surface-muted rounded-lg border border-dashed border-border flex flex-col items-center justify-center p-6 text-center">
                      <Camera className="w-10 h-10 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">In a real app, the camera scans a payee QR.<br/>Use the Bank Transfer tab to simulate.</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <h2 className="font-display text-lg mb-3">History</h2>
          <Card className="px-5 py-2 max-h-[600px] overflow-y-auto">
            {txns && txns.length > 0 ? (
              txns.map((t) => <TxnRow key={t.id} txn={t} accountId={account!.id} />)
            ) : (
              <div className="py-12 text-center text-sm text-muted-foreground">No transactions yet</div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
