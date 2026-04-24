import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Account = {
  id: string;
  account_number: string;
  ifsc: string;
  account_type: "savings" | "current";
  status: "active" | "frozen" | "closed";
};

export const useAccounts = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["accounts", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Account[]> => {
      const { data, error } = await supabase.from("accounts").select("*").order("created_at");
      if (error) throw error;
      return data as Account[];
    },
  });
};

export const usePrimaryAccount = () => {
  const { data: accounts, ...rest } = useAccounts();
  return { account: accounts?.[0] ?? null, ...rest };
};

export const useBalance = (accountId?: string) => {
  return useQuery({
    queryKey: ["balance", accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("account_balance_paise", { p_account: accountId! });
      if (error) throw error;
      return Number(data ?? 0);
    },
  });
};

export type Transaction = {
  id: string;
  kind: string;
  status: "pending" | "success" | "failed";
  from_account_id: string | null;
  to_account_id: string | null;
  amount_paise: number;
  description: string | null;
  failure_reason: string | null;
  created_at: string;
  completed_at: string | null;
};

export const useTransactions = (accountId?: string, limit = 50) => {
  return useQuery({
    queryKey: ["transactions", accountId, limit],
    enabled: !!accountId,
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as Transaction[];
    },
  });
};
