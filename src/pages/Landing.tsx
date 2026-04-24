import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Repeat2, CreditCard, Wallet } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-gradient-hero flex items-center justify-center font-display text-primary-foreground font-bold">L</div>
            <span className="font-display text-lg">Lovable Bank</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign in</Link>
            <Button asChild size="sm"><Link to="/auth?mode=signup">Open account</Link></Button>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24 grid md:grid-cols-2 gap-16 items-center">
        <div className="space-y-6 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-surface text-xs text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-success" /> RBI-style policy enforcement, simulated end-to-end
          </div>
          <h1 className="text-5xl md:text-6xl leading-[1.05]">
            Banking that<br /><span className="italic text-primary">actually works</span> like a bank.
          </h1>
          <p className="text-lg text-muted-foreground max-w-md">
            Double-entry ledger. Idempotent payments. Real policy limits. AutoPay schedulers. Card PIN security.
            All the things hobby fintechs skip — built in from day one.
          </p>
          <div className="flex gap-3 pt-2">
            <Button asChild size="lg"><Link to="/auth?mode=signup">Open free account <ArrowRight className="ml-1 w-4 h-4" /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/auth">Sign in</Link></Button>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 bg-gradient-hero opacity-20 blur-3xl rounded-full" />
          <div className="relative bg-gradient-card rounded-2xl shadow-card p-8 text-primary-foreground space-y-6 aspect-[1.6/1] flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs uppercase tracking-widest text-primary-foreground/60">Lovable Bank</div>
                <div className="font-display text-xl mt-1">Debit · Visa</div>
              </div>
              <div className="w-12 h-9 bg-gradient-gold rounded-md" />
            </div>
            <div className="font-mono-tabular text-2xl tracking-[0.2em]">**** **** **** 4392</div>
            <div className="flex justify-between text-xs text-primary-foreground/70">
              <div>
                <div className="uppercase tracking-wider">Holder</div>
                <div className="text-primary-foreground text-sm font-medium mt-0.5">Your Name</div>
              </div>
              <div>
                <div className="uppercase tracking-wider">Expires</div>
                <div className="text-primary-foreground text-sm font-medium mt-0.5">12/30</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-surface-muted">
        <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-4 gap-8">
          {[
            { icon: Wallet, t: "Real ledger", d: "Every paise tracked via double-entry. Balances derived, never edited." },
            { icon: Shield, t: "Idempotent", d: "No duplicate debits. Replay-safe transfer engine in Postgres." },
            { icon: Repeat2, t: "AutoPay", d: "Recurring payments with retry logic, auto-disable after 3 fails." },
            { icon: CreditCard, t: "Card security", d: "Hashed PIN, lockout after 3 wrong attempts, OTP unblock." },
          ].map(({ icon: I, t, d }) => (
            <div key={t} className="space-y-2">
              <I className="w-5 h-5 text-primary" />
              <div className="font-display text-lg">{t}</div>
              <div className="text-sm text-muted-foreground">{d}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-muted-foreground flex justify-between">
          <span>© Lovable Bank · Simulated banking for demonstration</span>
          <Link to="/app/policies" className="hover:text-foreground transition-colors">Policies</Link>
        </div>
      </footer>
    </div>
  );
}
