import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ─────────────── Loans ───────────────
export type Loan = {
  id: string;
  account_id: string;
  principal_paise: number;
  tenure_months: number;
  monthly_income_paise: number;
  credit_score: number;
  risk: "low" | "medium" | "high" | null;
  interest_rate_bps: number | null;
  emi_paise: number | null;
  status: "applied" | "approved" | "rejected" | "active" | "closed" | "defaulted";
  rejection_reason: string | null;
  missed_emi_count: number;
  applied_at: string;
  approved_at: string | null;
  disbursed_at: string | null;
  closed_at: string | null;
};

export type Emi = {
  id: string;
  loan_id: string;
  installment_no: number;
  due_date: string;
  amount_paise: number;
  late_fee_paise: number;
  status: "scheduled" | "paid" | "late" | "missed";
  paid_at: string | null;
  transaction_id: string | null;
};

export const useLoans = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["loans", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Loan[]> => {
      const { data, error } = await supabase
        .from("loans")
        .select("*")
        .order("applied_at", { ascending: false });
      if (error) throw error;
      return data as Loan[];
    },
  });
};

export const useEmis = (loanId?: string) => {
  return useQuery({
    queryKey: ["emis", loanId],
    enabled: !!loanId,
    queryFn: async (): Promise<Emi[]> => {
      const { data, error } = await supabase
        .from("emis")
        .select("*")
        .eq("loan_id", loanId!)
        .order("installment_no");
      if (error) throw error;
      return data as Emi[];
    },
  });
};

export const useApplyLoan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      accountId: string;
      principalPaise: number;
      tenureMonths: number;
      monthlyIncomePaise: number;
      creditScore: number;
    }) => {
      const { data, error } = await supabase.rpc("apply_loan", {
        p_account: args.accountId,
        p_principal_paise: args.principalPaise,
        p_tenure_months: args.tenureMonths,
        p_monthly_income_paise: args.monthlyIncomePaise,
        p_credit_score: args.creditScore,
      });
      if (error) throw error;
      return data as { loan_id: string; status: string; reason?: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loans"] });
      qc.invalidateQueries({ queryKey: ["balance"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
};

export const useRepayEmi = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (emiId: string) => {
      const { data, error } = await supabase.rpc("repay_emi", { p_emi: emiId });
      if (error) throw error;
      return data as { ok: boolean; reason?: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loans"] });
      qc.invalidateQueries({ queryKey: ["emis"] });
      qc.invalidateQueries({ queryKey: ["balance"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
};

// ─────────────── Fixed Deposits ───────────────
export type FixedDeposit = {
  id: string;
  account_id: string;
  principal_paise: number;
  tenure_months: number;
  interest_rate_bps: number;
  start_date: string;
  maturity_date: string;
  status: "active" | "matured" | "withdrawn";
  payout_paise: number | null;
  matured_at: string | null;
  withdrawn_at: string | null;
  created_at: string;
};

export const useFixedDeposits = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fds", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<FixedDeposit[]> => {
      const { data, error } = await supabase
        .from("fixed_deposits")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FixedDeposit[];
    },
  });
};

export const useCreateFd = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { accountId: string; principalPaise: number; tenureMonths: number }) => {
      const { data, error } = await supabase.rpc("create_fd", {
        p_account: args.accountId,
        p_principal_paise: args.principalPaise,
        p_tenure_months: args.tenureMonths,
      });
      if (error) throw error;
      return data as { fd_id: string; rate_bps: number; maturity_date: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fds"] });
      qc.invalidateQueries({ queryKey: ["balance"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
};

export const useWithdrawFd = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fdId: string) => {
      const { data, error } = await supabase.rpc("withdraw_fd_premature", { p_fd: fdId });
      if (error) throw error;
      return data as { ok: boolean; payout_paise: number; interest_paise: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fds"] });
      qc.invalidateQueries({ queryKey: ["balance"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
};
