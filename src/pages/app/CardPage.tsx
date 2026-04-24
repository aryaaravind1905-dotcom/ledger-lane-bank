import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Lock, ShieldCheck, ShieldAlert, KeyRound, Eye, EyeOff } from "lucide-react";

type Card = {
  id: string;
  card_number_last4: string;
  card_number_masked: string;
  cardholder_name: string;
  expiry_month: number;
  expiry_year: number;
  pin_hash: string | null;
  status: "active" | "blocked";
  failed_pin_attempts: number;
};

export default function CardPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [pinSet, setPinSet] = useState("");
  const [pinTry, setPinTry] = useState("");
  const [otp, setOtp] = useState("");
  const [newPin, setNewPin] = useState("");
  const [reveal, setReveal] = useState(false);

  const { data: card } = useQuery({
    queryKey: ["card", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("cards").select("*").maybeSingle();
      if (error) throw error;
      return data as Card | null;
    },
  });

  const setPin = async (e: FormEvent) => {
    e.preventDefault();
    if (!card) return;
    if (!/^\d{4}$/.test(pinSet)) { toast.error("PIN must be 4 digits"); return; }
    const { error } = await supabase.rpc("set_card_pin", { p_card: card.id, p_pin: pinSet });
    if (error) { toast.error(error.message); return; }
    toast.success("PIN set successfully");
    setPinSet("");
    qc.invalidateQueries({ queryKey: ["card"] });
  };

  const verifyPin = async (e: FormEvent) => {
    e.preventDefault();
    if (!card) return;
    if (!/^\d{4}$/.test(pinTry)) { toast.error("PIN must be 4 digits"); return; }
    const { data, error } = await supabase.rpc("verify_card_pin", { p_card: card.id, p_pin: pinTry });
    if (error) { toast.error(error.message); return; }
    const r = data as { ok: boolean; blocked?: boolean; attempts?: number };
    if (r.ok) toast.success("PIN verified ✓");
    else if (r.blocked) toast.error("Card has been blocked after 3 wrong attempts");
    else toast.error(`Wrong PIN · ${3 - (r.attempts ?? 0)} attempt(s) remaining`);
    setPinTry("");
    qc.invalidateQueries({ queryKey: ["card"] });
  };

  const unblock = async (e: FormEvent) => {
    e.preventDefault();
    if (!card) return;
    if (!/^\d{6}$/.test(otp)) { toast.error("OTP must be 6 digits"); return; }
    if (!/^\d{4}$/.test(newPin)) { toast.error("New PIN must be 4 digits"); return; }
    const { error } = await supabase.rpc("unblock_card", { p_card: card.id, p_otp: otp, p_new_pin: newPin });
    if (error) { toast.error(error.message); return; }
    toast.success("Card unblocked. New PIN set.");
    setOtp(""); setNewPin("");
    qc.invalidateQueries({ queryKey: ["card"] });
  };

  if (!card) {
    return <div className="text-muted-foreground animate-shimmer">Loading card…</div>;
  }

  const isBlocked = card.status === "blocked";
  const hasPin = !!card.pin_hash;

  return (
    <div className="space-y-8 max-w-3xl">
      <header>
        <h1 className="font-display text-3xl">Debit card</h1>
        <p className="text-sm text-muted-foreground mt-1">Virtual card · 3 wrong PIN attempts auto-blocks the card.</p>
      </header>

      {/* Card visual */}
      <Card className="p-8 bg-gradient-card text-primary-foreground shadow-card border-0 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-primary-foreground/5 blur-2xl" />
        <div className="relative space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs uppercase tracking-widest text-primary-foreground/60">Lovable Bank</div>
              <div className="font-display text-xl mt-1">Debit · Visa</div>
            </div>
            <div className="flex items-center gap-2">
              {isBlocked
                ? <Badge variant="destructive" className="gap-1"><ShieldAlert className="w-3 h-3" /> Blocked</Badge>
                : <Badge className="gap-1 bg-success text-success-foreground hover:bg-success"><ShieldCheck className="w-3 h-3" /> Active</Badge>}
              <button onClick={() => setReveal(!reveal)} className="text-primary-foreground/70 hover:text-primary-foreground">
                {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="font-mono-tabular text-2xl tracking-[0.2em]">
            {reveal ? `4392 1782 6553 ${card.card_number_last4}` : card.card_number_masked}
          </div>
          <div className="flex justify-between text-xs text-primary-foreground/70">
            <div>
              <div className="uppercase tracking-wider">Holder</div>
              <div className="text-primary-foreground text-sm font-medium mt-0.5">{card.cardholder_name}</div>
            </div>
            <div>
              <div className="uppercase tracking-wider">Expires</div>
              <div className="text-primary-foreground text-sm font-medium mt-0.5">{String(card.expiry_month).padStart(2, "0")}/{String(card.expiry_year).slice(-2)}</div>
            </div>
            <div>
              <div className="uppercase tracking-wider">CVV</div>
              <div className="text-primary-foreground text-sm font-medium mt-0.5">{reveal ? "428" : "•••"}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Status info */}
      {isBlocked && (
        <Card className="p-5 border-destructive/50 bg-destructive/5">
          <div className="flex gap-3">
            <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-destructive">Card blocked</div>
              <div className="text-muted-foreground mt-1">3 incorrect PIN attempts detected. Use the OTP unblock flow below to restore your card.</div>
            </div>
          </div>
        </Card>
      )}

      {/* PIN management */}
      <div className="grid md:grid-cols-2 gap-6">
        {!isBlocked && (
          <>
            <Card className="p-6">
              <h2 className="font-display text-lg mb-1 flex items-center gap-2"><KeyRound className="w-4 h-4" /> {hasPin ? "Change PIN" : "Set PIN"}</h2>
              <p className="text-xs text-muted-foreground mb-4">4-digit numeric PIN, hashed before storage.</p>
              <form onSubmit={setPin} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>New PIN</Label>
                  <Input type="password" inputMode="numeric" maxLength={4} value={pinSet} onChange={(e) => setPinSet(e.target.value.replace(/\D/g, ""))} placeholder="••••" />
                </div>
                <Button type="submit" className="w-full">{hasPin ? "Change PIN" : "Set PIN"}</Button>
              </form>
            </Card>

            {hasPin && (
              <Card className="p-6">
                <h2 className="font-display text-lg mb-1 flex items-center gap-2"><Lock className="w-4 h-4" /> Verify PIN</h2>
                <p className="text-xs text-muted-foreground mb-4">
                  Try entering your PIN. Wrong attempts: <span className="font-semibold text-foreground">{card.failed_pin_attempts}/3</span>
                </p>
                <form onSubmit={verifyPin} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Enter PIN</Label>
                    <Input type="password" inputMode="numeric" maxLength={4} value={pinTry} onChange={(e) => setPinTry(e.target.value.replace(/\D/g, ""))} placeholder="••••" />
                  </div>
                  <Button type="submit" variant="outline" className="w-full">Verify</Button>
                </form>
              </Card>
            )}
          </>
        )}

        {isBlocked && (
          <Card className="p-6 md:col-span-2">
            <h2 className="font-display text-lg mb-1">Unblock with OTP</h2>
            <p className="text-xs text-muted-foreground mb-4">In a real bank, an OTP is sent via SMS. Enter any 6-digit code to simulate.</p>
            <form onSubmit={unblock} className="space-y-3 grid md:grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>OTP (6 digits)</Label><Input inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="123456" /></div>
              <div className="space-y-1.5"><Label>New PIN</Label><Input type="password" inputMode="numeric" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" /></div>
              <div className="flex items-end"><Button type="submit" className="w-full">Unblock card</Button></div>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
