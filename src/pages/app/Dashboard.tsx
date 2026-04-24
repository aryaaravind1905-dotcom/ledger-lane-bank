import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Send, Repeat2, CreditCard, QrCode } from "lucide-react";
import { useAccounts, useBalance, useTransactions, usePrimaryAccount } from "@/hooks/useBanking";
import { formatINR, formatAccountNumber } from "@/lib/format";
import TxnRow from "@/components/TxnRow";
import { useAuth } from "@/hooks/useAuth";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: accounts } = useAccounts();
  const { account } = usePrimaryAccount();
  const { data: balance, isLoading: balanceLoading } = useBalance(account?.id);
  const { data: txns, isLoading: txnsLoading } = useTransactions(account?.id, 8);

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  })();

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">{greeting},</p>
          <h1 className="font-display text-3xl md:text-4xl">{user?.user_metadata?.full_name ?? "Welcome"}</h1>
        </div>
        <Button asChild><Link to="/app/payments">Send money <ArrowRight className="ml-1 w-4 h-4" /></Link></Button>
      </header>

      {/* Hero balance card */}
      <Card className="p-8 bg-gradient-card text-primary-foreground shadow-card border-0 overflow-hidden relative">
        <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-primary-foreground/5 blur-3xl" />
        <div className="relative space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs uppercase tracking-widest text-primary-foreground/60">Available balance</div>
              <div className="stat-number text-5xl md:text-6xl mt-2">
                {balanceLoading ? "—" : formatINR(balance ?? 0)}
              </div>
            </div>
            <div className="text-right text-xs text-primary-foreground/70">
              <div className="uppercase tracking-wider">{account?.account_type} acct</div>
              <div className="font-mono-tabular mt-1">{account ? formatAccountNumber(account.account_number) : ""}</div>
              <div className="font-mono-tabular">IFSC {account?.ifsc}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-4">
            {[
              { to: "/app/payments", icon: Send, label: "Send" },
              { to: "/app/payments?tab=qr", icon: QrCode, label: "Scan QR" },
              { to: "/app/autopay", icon: Repeat2, label: "AutoPay" },
              { to: "/app/card", icon: CreditCard, label: "Card" },
            ].map(({ to, icon: I, label }) => (
              <Link key={label} to={to} className="bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors rounded-md py-3 flex flex-col items-center gap-1.5 text-sm">
                <I className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </Card>

      {/* Recent activity */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl">Recent activity</h2>
          <Link to="/app/payments" className="text-sm text-muted-foreground hover:text-foreground transition-colors">View all</Link>
        </div>
        <Card className="p-2 px-5">
          {txnsLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground animate-shimmer">Loading…</div>
          ) : txns && txns.length > 0 ? (
            txns.map((t) => <TxnRow key={t.id} txn={t} accountId={account!.id} />)
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">No transactions yet</div>
          )}
        </Card>
      </section>
    </div>
  );
}
