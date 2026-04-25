import { Card } from "@/components/ui/card";
import { Wallet, ArrowLeftRight, Repeat2, CreditCard, ShieldCheck, Banknote, PiggyBank } from "lucide-react";

const sections = [
  {
    icon: Wallet,
    title: "Account policies",
    rules: [
      { k: "Savings minimum balance", v: "₹1,000" },
      { k: "Current account interest", v: "None" },
      { k: "Welcome opening credit", v: "₹10,000 (savings)" },
      { k: "Inactive / frozen accounts", v: "Cannot transact" },
    ],
  },
  {
    icon: ArrowLeftRight,
    title: "Payment limits",
    rules: [
      { k: "Per-transaction maximum", v: "₹1,00,000" },
      { k: "Daily aggregate maximum", v: "₹5,00,000" },
      { k: "Insufficient balance", v: "Transaction marked failed (rolled back via ledger)" },
      { k: "Idempotency", v: "Same idempotency key cannot post twice" },
      { k: "Accounting", v: "Strict double-entry; balances derived from ledger" },
    ],
  },
  {
    icon: Repeat2,
    title: "AutoPay rules",
    rules: [
      { k: "Frequencies", v: "Daily, Weekly, Monthly" },
      { k: "Failure retry gap", v: "24 hours" },
      { k: "Disable threshold", v: "3 consecutive failures → auto-disabled" },
      { k: "Subject to all payment limits", v: "Yes" },
    ],
  },
  {
    icon: CreditCard,
    title: "Debit card security",
    rules: [
      { k: "PIN format", v: "4 numeric digits" },
      { k: "Storage", v: "Bcrypt hash; plaintext never stored" },
      { k: "Lockout", v: "3 wrong PIN attempts → card blocked" },
      { k: "Unblock", v: "6-digit OTP + new PIN (simulated SMS flow)" },
    ],
  },
  {
    icon: Banknote,
    title: "Loan rules",
    rules: [
      { k: "Eligibility", v: "Credit score > 600 and debt-to-income ratio < 40%" },
      { k: "Tenure range", v: "3 to 60 months" },
      { k: "Interest by risk", v: "Low (≥750) 8% · Medium (680–749) 12% · High (<680) 18%" },
      { k: "EMI formula", v: "Standard amortization (P · r · (1+r)ⁿ / ((1+r)ⁿ − 1))" },
      { k: "Disbursement", v: "Instant credit to your savings account on approval" },
      { k: "Late fee", v: "₹500 or 2% of EMI — whichever is higher" },
      { k: "Default", v: "3 missed EMIs → loan marked defaulted" },
      { k: "Auto-debit", v: "Daily background job retries due EMIs" },
    ],
  },
  {
    icon: PiggyBank,
    title: "Fixed Deposit rules",
    rules: [
      { k: "Minimum amount", v: "₹5,000" },
      { k: "Interest rates", v: "6 mo → 5.00% · 12 mo → 6.50% · 24+ mo → 7.00%" },
      { k: "Maturity payout", v: "Auto-credited on the maturity date" },
      { k: "Premature withdrawal", v: "Interest reduced by 1%; no interest if held < 3 months" },
      { k: "Funds lock-in", v: "Locked in bank FD pool via double-entry ledger" },
    ],
  },
  {
    icon: ShieldCheck,
    title: "Security",
    rules: [
      { k: "Authentication", v: "Email + password (Lovable Cloud Auth, JWT)" },
      { k: "Row-level security", v: "Enforced — users only see their own data" },
      { k: "Money mutations", v: "Only via SECURITY DEFINER functions; no direct table writes" },
      { k: "Limits enforcement", v: "In Postgres function — cannot be bypassed by client" },
    ],
  },
];

export default function Policies() {
  return (
    <div className="space-y-10 max-w-4xl">
      <header>
        <h1 className="font-display text-3xl md:text-4xl">Policies</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          The rules below are not just documentation — they are enforced inside the database. Every transfer, AutoPay run, and PIN attempt is checked against these limits before any change is committed.
        </p>
      </header>

      {sections.map(({ icon: I, title, rules }) => (
        <section key={title} className="space-y-3">
          <h2 className="font-display text-2xl flex items-center gap-2"><I className="w-5 h-5 text-primary" /> {title}</h2>
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {rules.map((r, i) => (
                  <tr key={r.k} className={i !== rules.length - 1 ? "border-b border-border" : ""}>
                    <td className="px-5 py-3 text-muted-foreground w-1/2">{r.k}</td>
                    <td className="px-5 py-3 font-medium">{r.v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      ))}

      <p className="text-xs text-muted-foreground border-t border-border pt-6">
        All policies above are enforced server-side in Postgres functions and cron jobs — they cannot be bypassed from the client.
      </p>
    </div>
  );
}
