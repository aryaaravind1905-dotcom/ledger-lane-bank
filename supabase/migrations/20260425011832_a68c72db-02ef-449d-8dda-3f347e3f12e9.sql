
CREATE TYPE public.loan_status AS ENUM ('applied','approved','rejected','active','closed','defaulted');
CREATE TYPE public.risk_band   AS ENUM ('low','medium','high');
CREATE TYPE public.emi_status  AS ENUM ('scheduled','paid','late','missed');
CREATE TYPE public.fd_status   AS ENUM ('active','matured','withdrawn');

CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID NOT NULL,
  principal_paise BIGINT NOT NULL,
  tenure_months INT NOT NULL,
  monthly_income_paise BIGINT NOT NULL,
  credit_score INT NOT NULL,
  risk public.risk_band,
  interest_rate_bps INT,
  emi_paise BIGINT,
  status public.loan_status NOT NULL DEFAULT 'applied',
  rejection_reason TEXT,
  missed_emi_count INT NOT NULL DEFAULT 0,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  disbursed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);
CREATE INDEX loans_user_idx ON public.loans(user_id);
CREATE INDEX loans_status_idx ON public.loans(status);
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own loans read" ON public.loans FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE public.emis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  installment_no INT NOT NULL,
  due_date DATE NOT NULL,
  amount_paise BIGINT NOT NULL,
  late_fee_paise BIGINT NOT NULL DEFAULT 0,
  status public.emi_status NOT NULL DEFAULT 'scheduled',
  paid_at TIMESTAMPTZ,
  transaction_id UUID,
  UNIQUE (loan_id, installment_no)
);
CREATE INDEX emis_loan_idx ON public.emis(loan_id);
CREATE INDEX emis_due_idx ON public.emis(due_date) WHERE status IN ('scheduled','late');
ALTER TABLE public.emis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own emis read" ON public.emis FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.loans l WHERE l.id = emis.loan_id AND l.user_id = auth.uid()));

CREATE TABLE public.fixed_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID NOT NULL,
  principal_paise BIGINT NOT NULL,
  tenure_months INT NOT NULL,
  interest_rate_bps INT NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  maturity_date DATE NOT NULL,
  status public.fd_status NOT NULL DEFAULT 'active',
  payout_paise BIGINT,
  matured_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX fd_user_idx ON public.fixed_deposits(user_id);
CREATE INDEX fd_status_idx ON public.fixed_deposits(status);
ALTER TABLE public.fixed_deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own fd read" ON public.fixed_deposits FOR SELECT USING (auth.uid() = user_id);
