import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Banknote, AlertTriangle, CheckCircle2, Calendar, TrendingUp } from "lucide-react";
import { usePrimaryAccount } from "@/hooks/useBanking";
import { useApplyLoan, useEmis, useLoans, useRepayEmi, type Loan } from "@/hooks/useLoansFd";
import { formatINR, rupeesToPaise } from "@/lib/format";
import { cn } from "@/lib/utils";

const riskColor: Record<string, string> = {
  low: "bg-success/10 text-success border-success/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  high: "bg-destructive/10 text-destructive border-destructive/20",
};

const statusColor: Record<string, string> = {
  active: "bg-primary/10 text-primary border-primary/20",
  closed: "bg-muted text-muted-foreground border-border",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  defaulted: "bg-destructive/10 text-destructive border-destructive/20",
  applied: "bg-warning/10 text-warning border-warning/20",
};

export default function Loans() {
  const { account } = usePrimaryAccount();
  const { data: loans, isLoading } = useLoans();
  const apply = useApplyLoan();
  const [openApply, setOpenApply] = useState(false);
  const [selected, setSelected] = useState<Loan | null>(null);

  const [amount, setAmount] = useState("100000");
  const [tenure, setTenure] = useState("12");
  const [income, setIncome] = useState("60000");
  const [score, setScore] = useState("720");

  const handleApply = async () => {
    if (!account) return;
    try {
      const res = await apply.mutateAsync({
        accountId: account.id,
        principalPaise: rupeesToPaise(parseFloat(amount)),
        tenureMonths: parseInt(tenure),
        monthlyIncomePaise: rupeesToPaise(parseFloat(income)),
        creditScore: parseInt(score),
      });
      setOpenApply(false);
      if (res.status === "rejected") {
        toast({
          title: "Application rejected",
          description:
            res.reason === "credit_score_below_threshold"
              ? "Credit score must be above 600."
              : "Debt-to-income ratio is too high (≥ 40%).",
          variant: "destructive",
        });
      } else {
        toast({ title: "Loan approved & disbursed", description: "Funds credited to your account." });
      }
    } catch (e: any) {
      toast({ title: "Could not apply", description: e.message, variant: "destructive" });
    }
  };

  const active = loans?.filter((l) => l.status === "active") ?? [];
  const totalOutstanding = active.reduce((sum, l) => sum + (l.principal_paise ?? 0), 0);
  const totalEmi = active.reduce((sum, l) => sum + (l.emi_paise ?? 0), 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl">Loans</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Apply, track your EMI schedule, and repay early. Disbursement happens instantly to your savings account.
          </p>
        </div>
        <Button onClick={() => setOpenApply(true)}>
          <Banknote className="w-4 h-4 mr-2" /> Apply for loan
        </Button>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Active loans</div>
          <div className="stat-number text-3xl mt-2">{active.length}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Outstanding principal</div>
          <div className="stat-number text-3xl mt-2">{formatINR(totalOutstanding)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Monthly EMI burden</div>
          <div className="stat-number text-3xl mt-2">{formatINR(totalEmi)}</div>
        </Card>
      </div>

      {/* Loan list */}
      <section>
        <h2 className="font-display text-xl mb-4">Your loans</h2>
        <div className="space-y-3">
          {isLoading && <Card className="p-6 text-sm text-muted-foreground animate-shimmer">Loading…</Card>}
          {!isLoading && (loans?.length ?? 0) === 0 && (
            <Card className="p-12 text-center text-sm text-muted-foreground">
              No loans yet. Apply above to get instant disbursement.
            </Card>
          )}
          {loans?.map((l) => (
            <Card
              key={l.id}
              className="p-5 hover:shadow-card transition-shadow cursor-pointer"
              onClick={() => l.status !== "rejected" && setSelected(l)}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg">{formatINR(l.principal_paise)}</span>
                    <Badge variant="outline" className={cn("capitalize", statusColor[l.status])}>
                      {l.status}
                    </Badge>
                    {l.risk && (
                      <Badge variant="outline" className={cn("capitalize", riskColor[l.risk])}>
                        {l.risk} risk
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {l.tenure_months} months
                    {l.interest_rate_bps != null && ` · ${(l.interest_rate_bps / 100).toFixed(2)}% p.a.`}
                    {l.emi_paise != null && ` · EMI ${formatINR(l.emi_paise)}`}
                  </div>
                  {l.status === "rejected" && (
                    <div className="text-xs text-destructive mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {l.rejection_reason === "credit_score_below_threshold"
                        ? "Credit score below 600"
                        : "Debt-to-income ratio too high"}
                    </div>
                  )}
                  {l.status === "defaulted" && (
                    <div className="text-xs text-destructive mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Defaulted — {l.missed_emi_count} missed EMIs
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Applied</div>
                  <div className="text-sm">{new Date(l.applied_at).toLocaleDateString("en-IN")}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Apply dialog */}
      <Dialog open={openApply} onOpenChange={setOpenApply}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for loan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Loan amount (₹)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min="1000" />
            </div>
            <div>
              <Label>Tenure (months)</Label>
              <Select value={tenure} onValueChange={setTenure}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[3, 6, 12, 24, 36, 48, 60].map((m) => (
                    <SelectItem key={m} value={String(m)}>{m} months</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Monthly income (₹)</Label>
              <Input type="number" value={income} onChange={(e) => setIncome(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Used to compute debt-to-income ratio.</p>
            </div>
            <div>
              <Label>Credit score (300–900)</Label>
              <Input type="number" value={score} onChange={(e) => setScore(e.target.value)} min="300" max="900" />
              <p className="text-xs text-muted-foreground mt-1">
                Above 750 → low risk (8%) · 680–749 → medium (12%) · below 680 → high (18%). Below 600 auto-rejected.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenApply(false)}>Cancel</Button>
            <Button onClick={handleApply} disabled={apply.isPending}>
              {apply.isPending ? "Evaluating…" : "Submit application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog with EMI schedule */}
      <LoanDetailDialog loan={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function LoanDetailDialog({ loan, onClose }: { loan: Loan | null; onClose: () => void }) {
  const { data: emis, isLoading } = useEmis(loan?.id);
  const repay = useRepayEmi();

  const handleRepay = async (id: string) => {
    try {
      const res = await repay.mutateAsync(id);
      if (!res.ok) {
        toast({ title: "Repayment failed", description: "Insufficient balance.", variant: "destructive" });
      } else {
        toast({ title: "EMI paid", description: "Marked paid in your schedule." });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={!!loan} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Loan details</DialogTitle>
        </DialogHeader>
        {loan && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Stat label="Principal" value={formatINR(loan.principal_paise)} />
              <Stat label="Tenure" value={`${loan.tenure_months} mo`} />
              <Stat label="Rate" value={loan.interest_rate_bps ? `${(loan.interest_rate_bps / 100).toFixed(2)}%` : "—"} />
              <Stat label="EMI" value={loan.emi_paise ? formatINR(loan.emi_paise) : "—"} />
            </div>
            <div>
              <h3 className="font-display text-base mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" /> EMI schedule
              </h3>
              <div className="border border-border rounded-md max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2">#</th>
                      <th className="text-left px-3 py-2">Due</th>
                      <th className="text-right px-3 py-2">Amount</th>
                      <th className="text-right px-3 py-2">Late fee</th>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading && (
                      <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground animate-shimmer">Loading…</td></tr>
                    )}
                    {emis?.map((e) => (
                      <tr key={e.id} className="border-t border-border">
                        <td className="px-3 py-2">{e.installment_no}</td>
                        <td className="px-3 py-2">{new Date(e.due_date).toLocaleDateString("en-IN")}</td>
                        <td className="px-3 py-2 text-right font-mono-tabular">{formatINR(e.amount_paise)}</td>
                        <td className="px-3 py-2 text-right font-mono-tabular text-destructive">
                          {e.late_fee_paise > 0 ? formatINR(e.late_fee_paise) : "—"}
                        </td>
                        <td className="px-3 py-2 capitalize">
                          {e.status === "paid" && (
                            <span className="inline-flex items-center gap-1 text-success">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                            </span>
                          )}
                          {e.status === "scheduled" && <span className="text-muted-foreground">Scheduled</span>}
                          {e.status === "late" && <span className="text-warning">Late</span>}
                          {e.status === "missed" && <span className="text-destructive">Missed</span>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {e.status !== "paid" && loan.status !== "closed" && (
                            <Button size="sm" variant="outline" onClick={() => handleRepay(e.id)} disabled={repay.isPending}>
                              Pay now
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Auto-debit runs daily at 01:15 from your account.
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-md p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono-tabular text-base mt-1">{value}</div>
    </div>
  );
}
