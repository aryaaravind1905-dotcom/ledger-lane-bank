
-- ============================================================
-- PHASE 2: LOANS + FIXED DEPOSITS
-- ============================================================

-- Extend transaction kinds for new money movements
ALTER TYPE public.txn_kind ADD VALUE IF NOT EXISTS 'loan_disbursement';
ALTER TYPE public.txn_kind ADD VALUE IF NOT EXISTS 'loan_repayment';
ALTER TYPE public.txn_kind ADD VALUE IF NOT EXISTS 'fd_lock';
ALTER TYPE public.txn_kind ADD VALUE IF NOT EXISTS 'fd_payout';
