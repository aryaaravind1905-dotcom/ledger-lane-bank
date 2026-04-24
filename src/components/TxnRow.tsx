import { Transaction } from "@/hooks/useBanking";
import { formatINR, formatDateTime } from "@/lib/format";
import { ArrowDownLeft, ArrowUpRight, Clock, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TxnRow({ txn, accountId }: { txn: Transaction; accountId: string }) {
  const isCredit = txn.to_account_id === accountId;
  const isFailed = txn.status === "failed";
  const isPending = txn.status === "pending";

  const Icon = isFailed ? X : isPending ? Clock : isCredit ? ArrowDownLeft : ArrowUpRight;
  const iconClass = isFailed
    ? "bg-destructive/10 text-destructive"
    : isPending
    ? "bg-warning/10 text-warning"
    : isCredit
    ? "bg-success/10 text-success"
    : "bg-muted text-muted-foreground";

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", iconClass)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">
            {txn.description || (txn.kind === "system" ? "System credit" : isCredit ? "Money received" : "Payment sent")}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatDateTime(txn.created_at)} · <span className="capitalize">{txn.kind}</span>
            {isFailed && txn.failure_reason && <> · <span className="text-destructive">{txn.failure_reason.replace(/_/g, " ")}</span></>}
          </div>
        </div>
      </div>
      <div className={cn(
        "stat-number text-sm font-semibold shrink-0 ml-3",
        isFailed && "line-through text-muted-foreground",
        !isFailed && isCredit && "text-success",
      )}>
        {!isFailed && (isCredit ? "+" : "−")}
        {formatINR(txn.amount_paise)}
      </div>
    </div>
  );
}
