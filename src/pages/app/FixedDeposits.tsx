import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { PiggyBank, Lock, Unlock, AlertTriangle } from "lucide-react";
import { usePrimaryAccount, useBalance } from "@/hooks/useBanking";
import { useCreateFd, useFixedDeposits, useWithdrawFd, type FixedDeposit } from "@/hooks/useLoansFd";
import { formatINR, rupeesToPaise } from "@/lib/format";
import { cn } from "@/lib/utils";

const TENURE_OPTIONS = [
  { months: 6, label: "6 months · 5.00%" },
  { months: 12, label: "1 year · 6.50%" },
  { months: 24, label: "2 years · 7.00%" },
  { months: 36, label: "3 years · 7.00%" },
  { months: 60, label: "5 years · 7.00%" },
];

const statusColor: Record<string, string> = {
  active: "bg-primary/10 text-primary border-primary/20",
  matured: "bg-success/10 text-success border-success/20",
  withdrawn: "bg-muted text-muted-foreground border-border",
};

function projectedPayout(principal: number, tenureM: number) {
  const rate = tenureM >= 24 ? 0.07 : tenureM >= 12 ? 0.065 : 0.05;
  return Math.round(principal + principal * rate * (tenureM / 12));
}

export default function FixedDeposits() {
  const { account } = usePrimaryAccount();
  const { data: balance } = useBalance(account?.id);
  const { data: fds, isLoading } = useFixedDeposits();
  const create = useCreateFd();
  const withdraw = useWithdrawFd();

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("10000");
  const [tenure, setTenure] = useState("12");

  const handleCreate = async () => {
    if (!account) return;
    try {
      await create.mutateAsync({
        accountId: account.id,
        principalPaise: rupeesToPaise(parseFloat(amount)),
        tenureMonths: parseInt(tenure),
      });
      setOpen(false);
      toast({ title: "FD booked", description: "Funds locked successfully." });
    } catch (e: any) {
      const msg =
        e.message?.includes("fd_minimum_5000")
          ? "Minimum FD is ₹5,000"
          : e.message?.includes("insufficient_balance")
          ? "Insufficient balance (savings min ₹1,000 must remain)"
          : e.message;
      toast({ title: "Could not create FD", description: msg, variant: "destructive" });
    }
  };

  const handleWithdraw = async (fd: FixedDeposit) => {
    if (!confirm(`Premature withdrawal will reduce your interest by 1% (no interest if held < 3 months). Continue?`))
      return;
    try {
      const res = await withdraw.mutateAsync(fd.id);
      toast({
        title: "Withdrawn",
        description: `Payout ${formatINR(res.payout_paise)} (interest ${formatINR(res.interest_paise)}).`,
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const active = fds?.filter((f) => f.status === "active") ?? [];
  const totalLocked = active.reduce((s, f) => s + f.principal_paise, 0);
  const projected = active.reduce((s, f) => s + projectedPayout(f.principal_paise, f.tenure_months), 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl">Fixed Deposits</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Lock funds at guaranteed rates. Maturity payouts are credited automatically the day they mature.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <PiggyBank className="w-4 h-4 mr-2" /> Create FD
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Active deposits</div>
          <div className="stat-number text-3xl mt-2">{active.length}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Total locked</div>
          <div className="stat-number text-3xl mt-2">{formatINR(totalLocked)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Projected at maturity</div>
          <div className="stat-number text-3xl mt-2 text-success">{formatINR(projected)}</div>
        </Card>
      </div>

      <section>
        <h2 className="font-display text-xl mb-4">Your deposits</h2>
        <div className="space-y-3">
          {isLoading && <Card className="p-6 text-sm text-muted-foreground animate-shimmer">Loading…</Card>}
          {!isLoading && (fds?.length ?? 0) === 0 && (
            <Card className="p-12 text-center text-sm text-muted-foreground">
              No deposits yet. Create one to start earning guaranteed returns.
            </Card>
          )}
          {fds?.map((f) => {
            const isActive = f.status === "active";
            const expectedPayout = isActive ? projectedPayout(f.principal_paise, f.tenure_months) : f.payout_paise;
            return (
              <Card key={f.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-lg">{formatINR(f.principal_paise)}</span>
                      <Badge variant="outline" className={cn("capitalize", statusColor[f.status])}>
                        {f.status === "active" ? <Lock className="w-3 h-3 mr-1" /> : <Unlock className="w-3 h-3 mr-1" />}
                        {f.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {f.tenure_months} months · {(f.interest_rate_bps / 100).toFixed(2)}% p.a. · matures{" "}
                      {new Date(f.maturity_date).toLocaleDateString("en-IN")}
                    </div>
                    {expectedPayout != null && (
                      <div className="text-xs mt-2">
                        <span className="text-muted-foreground">{isActive ? "At maturity:" : "Paid out:"} </span>
                        <span className="font-medium text-success">{formatINR(expectedPayout)}</span>
                      </div>
                    )}
                  </div>
                  {isActive && (
                    <Button variant="outline" size="sm" onClick={() => handleWithdraw(f)} disabled={withdraw.isPending}>
                      Withdraw early
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Fixed Deposit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Amount (₹)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min="5000" />
              <p className="text-xs text-muted-foreground mt-1">
                Minimum ₹5,000. Available balance: {balance != null ? formatINR(balance) : "—"}
              </p>
            </div>
            <div>
              <Label>Tenure</Label>
              <Select value={tenure} onValueChange={setTenure}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TENURE_OPTIONS.map((o) => (
                    <SelectItem key={o.months} value={String(o.months)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-muted/40 rounded-md p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated payout at maturity</span>
                <span className="font-medium text-success">
                  {formatINR(projectedPayout(rupeesToPaise(parseFloat(amount || "0")), parseInt(tenure)))}
                </span>
              </div>
              <div className="flex items-start gap-1.5 text-muted-foreground pt-2">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                Premature withdrawal reduces interest by 1%. No interest is paid if withdrawn within 3 months.
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={create.isPending}>
              {create.isPending ? "Locking funds…" : "Create FD"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
