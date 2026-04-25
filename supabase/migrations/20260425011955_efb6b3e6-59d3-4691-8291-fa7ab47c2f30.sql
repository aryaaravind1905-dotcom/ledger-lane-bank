
CREATE OR REPLACE FUNCTION public.apply_loan(
  p_account UUID,
  p_principal_paise BIGINT,
  p_tenure_months INT,
  p_monthly_income_paise BIGINT,
  p_credit_score INT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_acc public.accounts;
  v_loan_id UUID;
  v_risk public.risk_band;
  v_rate_bps INT;
  v_monthly_rate NUMERIC;
  v_emi BIGINT;
  v_dti NUMERIC;
  v_existing_emi_burden BIGINT := 0;
  v_disb_txn UUID;
  v_sys_loans UUID;
  i INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF p_principal_paise <= 0 THEN RAISE EXCEPTION 'invalid_principal'; END IF;
  IF p_tenure_months NOT BETWEEN 3 AND 60 THEN RAISE EXCEPTION 'tenure_out_of_range'; END IF;
  IF p_monthly_income_paise <= 0 THEN RAISE EXCEPTION 'invalid_income'; END IF;
  IF p_credit_score NOT BETWEEN 300 AND 900 THEN RAISE EXCEPTION 'invalid_credit_score'; END IF;

  SELECT * INTO v_acc FROM public.accounts WHERE id = p_account;
  IF NOT FOUND OR v_acc.user_id <> v_user THEN RAISE EXCEPTION 'account_not_found'; END IF;

  v_risk := CASE WHEN p_credit_score >= 750 THEN 'low'::public.risk_band
                 WHEN p_credit_score >= 680 THEN 'medium'::public.risk_band
                 ELSE 'high'::public.risk_band END;
  v_rate_bps := CASE v_risk WHEN 'low' THEN 800 WHEN 'medium' THEN 1200 ELSE 1800 END;

  v_monthly_rate := (v_rate_bps::NUMERIC / 10000) / 12;
  v_emi := CEIL(
    (p_principal_paise::NUMERIC * v_monthly_rate * power(1 + v_monthly_rate, p_tenure_months))
    / (power(1 + v_monthly_rate, p_tenure_months) - 1)
  )::BIGINT;

  SELECT COALESCE(SUM(emi_paise),0) INTO v_existing_emi_burden
  FROM public.loans WHERE user_id = v_user AND status = 'active';

  v_dti := ((v_existing_emi_burden + v_emi)::NUMERIC) / p_monthly_income_paise::NUMERIC;

  INSERT INTO public.loans (user_id, account_id, principal_paise, tenure_months,
                            monthly_income_paise, credit_score, risk, interest_rate_bps, emi_paise)
  VALUES (v_user, p_account, p_principal_paise, p_tenure_months,
          p_monthly_income_paise, p_credit_score, v_risk, v_rate_bps, v_emi)
  RETURNING id INTO v_loan_id;

  IF p_credit_score <= 600 THEN
    UPDATE public.loans SET status='rejected', rejection_reason='credit_score_below_threshold' WHERE id = v_loan_id;
    RETURN jsonb_build_object('loan_id', v_loan_id, 'status','rejected','reason','credit_score_below_threshold');
  END IF;
  IF v_dti >= 0.40 THEN
    UPDATE public.loans SET status='rejected', rejection_reason='debt_to_income_too_high' WHERE id = v_loan_id;
    RETURN jsonb_build_object('loan_id', v_loan_id, 'status','rejected','reason','debt_to_income_too_high');
  END IF;

  v_sys_loans := public._system_account('loans');
  UPDATE public.loans SET status='active', approved_at=now(), disbursed_at=now() WHERE id = v_loan_id;

  INSERT INTO public.transactions (kind, status, from_account_id, to_account_id,
                                   amount_paise, description, idempotency_key, initiated_by, completed_at)
  VALUES ('loan_disbursement', 'success', v_sys_loans, p_account,
          p_principal_paise, 'Loan disbursement', 'loan_disb:'||v_loan_id, v_user, now())
  RETURNING id INTO v_disb_txn;

  INSERT INTO public.ledger_entries (transaction_id, account_id, direction, amount_paise) VALUES
    (v_disb_txn, v_sys_loans, 'debit',  p_principal_paise),
    (v_disb_txn, p_account,   'credit', p_principal_paise);

  FOR i IN 1..p_tenure_months LOOP
    INSERT INTO public.emis (loan_id, installment_no, due_date, amount_paise)
    VALUES (v_loan_id, i, (CURRENT_DATE + (i || ' months')::interval)::date, v_emi);
  END LOOP;

  RETURN jsonb_build_object('loan_id', v_loan_id, 'status','active',
                            'risk', v_risk, 'interest_rate_bps', v_rate_bps,
                            'emi_paise', v_emi, 'tenure_months', p_tenure_months);
END $$;

CREATE OR REPLACE FUNCTION public.repay_emi(p_emi UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_emi public.emis; v_loan public.loans; v_acc public.accounts;
  v_total BIGINT; v_balance BIGINT; v_min_balance BIGINT;
  v_sys_loans UUID; v_txn UUID; v_remaining INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO v_emi FROM public.emis WHERE id = p_emi FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'emi_not_found'; END IF;
  IF v_emi.status = 'paid' THEN RAISE EXCEPTION 'already_paid'; END IF;

  SELECT * INTO v_loan FROM public.loans WHERE id = v_emi.loan_id FOR UPDATE;
  IF v_loan.user_id <> v_user THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_loan.status NOT IN ('active','defaulted') THEN RAISE EXCEPTION 'loan_not_repayable'; END IF;

  SELECT * INTO v_acc FROM public.accounts WHERE id = v_loan.account_id FOR UPDATE;
  v_total := v_emi.amount_paise + COALESCE(v_emi.late_fee_paise, 0);
  v_balance := public.account_balance_paise(v_acc.id);
  v_min_balance := CASE WHEN v_acc.account_type = 'savings' THEN 100000 ELSE 0 END;
  IF v_balance - v_total < v_min_balance THEN
    RETURN jsonb_build_object('ok', false, 'reason','insufficient_balance');
  END IF;

  v_sys_loans := public._system_account('loans');
  INSERT INTO public.transactions (kind, status, from_account_id, to_account_id,
                                   amount_paise, description, idempotency_key, initiated_by, completed_at)
  VALUES ('loan_repayment', 'success', v_acc.id, v_sys_loans, v_total,
          'EMI #'||v_emi.installment_no, 'emi_pay:'||v_emi.id, v_user, now())
  RETURNING id INTO v_txn;
  INSERT INTO public.ledger_entries (transaction_id, account_id, direction, amount_paise) VALUES
    (v_txn, v_acc.id,    'debit',  v_total),
    (v_txn, v_sys_loans, 'credit', v_total);

  UPDATE public.emis SET status='paid', paid_at=now(), transaction_id=v_txn WHERE id = v_emi.id;
  SELECT COUNT(*) INTO v_remaining FROM public.emis WHERE loan_id = v_loan.id AND status <> 'paid';
  IF v_remaining = 0 THEN UPDATE public.loans SET status='closed', closed_at=now() WHERE id = v_loan.id; END IF;

  RETURN jsonb_build_object('ok', true, 'transaction_id', v_txn);
END $$;

CREATE OR REPLACE FUNCTION public.run_due_emis()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD; v_loan public.loans; v_acc public.accounts;
  v_balance BIGINT; v_min_balance BIGINT;
  v_sys_loans UUID := public._system_account('loans');
  v_txn UUID; v_late_fee BIGINT; v_total BIGINT;
  v_count INT := 0; v_remaining INT;
BEGIN
  FOR r IN
    SELECT * FROM public.emis
     WHERE status IN ('scheduled','late') AND due_date <= CURRENT_DATE
     ORDER BY due_date ASC LIMIT 500
  LOOP
    SELECT * INTO v_loan FROM public.loans WHERE id = r.loan_id FOR UPDATE;
    IF v_loan.status <> 'active' THEN CONTINUE; END IF;

    SELECT * INTO v_acc FROM public.accounts WHERE id = v_loan.account_id FOR UPDATE;
    v_balance := public.account_balance_paise(v_acc.id);
    v_min_balance := CASE WHEN v_acc.account_type = 'savings' THEN 100000 ELSE 0 END;
    v_late_fee := CASE WHEN r.status = 'late'
                       THEN GREATEST(50000, (r.amount_paise * 2 / 100)::BIGINT)
                       ELSE 0 END;
    v_total := r.amount_paise + v_late_fee;

    IF v_balance - v_total >= v_min_balance THEN
      INSERT INTO public.transactions (kind, status, from_account_id, to_account_id,
                                       amount_paise, description, idempotency_key, initiated_by, completed_at)
      VALUES ('loan_repayment','success', v_acc.id, v_sys_loans, v_total,
              'Auto EMI #'||r.installment_no, 'emi_auto:'||r.id||':'||CURRENT_DATE, NULL, now())
      RETURNING id INTO v_txn;
      INSERT INTO public.ledger_entries (transaction_id, account_id, direction, amount_paise) VALUES
        (v_txn, v_acc.id,    'debit',  v_total),
        (v_txn, v_sys_loans, 'credit', v_total);
      UPDATE public.emis SET status='paid', paid_at=now(), late_fee_paise=v_late_fee, transaction_id=v_txn WHERE id = r.id;
      SELECT COUNT(*) INTO v_remaining FROM public.emis WHERE loan_id = v_loan.id AND status <> 'paid';
      IF v_remaining = 0 THEN UPDATE public.loans SET status='closed', closed_at=now() WHERE id = v_loan.id; END IF;
    ELSE
      IF r.status = 'scheduled' THEN
        UPDATE public.emis SET status='late' WHERE id = r.id;
      ELSE
        UPDATE public.emis SET status='missed', late_fee_paise=v_late_fee WHERE id = r.id;
        UPDATE public.loans
           SET missed_emi_count = v_loan.missed_emi_count + 1,
               status = CASE WHEN v_loan.missed_emi_count + 1 >= 3 THEN 'defaulted'::public.loan_status ELSE 'active'::public.loan_status END
         WHERE id = v_loan.id;
      END IF;
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

-- FD functions
CREATE OR REPLACE FUNCTION public.create_fd(
  p_account UUID, p_principal_paise BIGINT, p_tenure_months INT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid(); v_acc public.accounts;
  v_rate_bps INT; v_balance BIGINT; v_min_balance BIGINT;
  v_fd_id UUID; v_sys_fd UUID; v_txn UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF p_principal_paise < 500000 THEN RAISE EXCEPTION 'fd_minimum_5000'; END IF;
  IF p_tenure_months < 6 THEN RAISE EXCEPTION 'fd_min_tenure_6_months'; END IF;

  SELECT * INTO v_acc FROM public.accounts WHERE id = p_account FOR UPDATE;
  IF NOT FOUND OR v_acc.user_id <> v_user THEN RAISE EXCEPTION 'account_not_found'; END IF;

  v_rate_bps := CASE WHEN p_tenure_months >= 24 THEN 700
                     WHEN p_tenure_months >= 12 THEN 650 ELSE 500 END;

  v_balance := public.account_balance_paise(p_account);
  v_min_balance := CASE WHEN v_acc.account_type = 'savings' THEN 100000 ELSE 0 END;
  IF v_balance - p_principal_paise < v_min_balance THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  v_sys_fd := public._system_account('fd');
  INSERT INTO public.fixed_deposits (user_id, account_id, principal_paise, tenure_months, interest_rate_bps, maturity_date)
  VALUES (v_user, p_account, p_principal_paise, p_tenure_months, v_rate_bps,
          (CURRENT_DATE + (p_tenure_months || ' months')::interval)::date)
  RETURNING id INTO v_fd_id;

  INSERT INTO public.transactions (kind, status, from_account_id, to_account_id,
                                   amount_paise, description, idempotency_key, initiated_by, completed_at)
  VALUES ('fd_lock','success', p_account, v_sys_fd, p_principal_paise,
          'FD lock-in '||p_tenure_months||'m', 'fd_lock:'||v_fd_id, v_user, now())
  RETURNING id INTO v_txn;
  INSERT INTO public.ledger_entries (transaction_id, account_id, direction, amount_paise) VALUES
    (v_txn, p_account, 'debit',  p_principal_paise),
    (v_txn, v_sys_fd,  'credit', p_principal_paise);

  RETURN jsonb_build_object('fd_id', v_fd_id, 'rate_bps', v_rate_bps,
                            'maturity_date', (CURRENT_DATE + (p_tenure_months || ' months')::interval)::date);
END $$;

CREATE OR REPLACE FUNCTION public.withdraw_fd_premature(p_fd UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid(); v_fd public.fixed_deposits;
  v_held_days INT; v_held_months NUMERIC;
  v_eff_rate NUMERIC; v_interest BIGINT := 0; v_payout BIGINT;
  v_sys_fd UUID := public._system_account('fd'); v_txn UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO v_fd FROM public.fixed_deposits WHERE id = p_fd FOR UPDATE;
  IF NOT FOUND OR v_fd.user_id <> v_user THEN RAISE EXCEPTION 'fd_not_found'; END IF;
  IF v_fd.status <> 'active' THEN RAISE EXCEPTION 'fd_not_active'; END IF;

  v_held_days := CURRENT_DATE - v_fd.start_date;
  v_held_months := v_held_days::NUMERIC / 30.0;

  IF v_held_months < 3 THEN
    v_interest := 0;
  ELSE
    v_eff_rate := GREATEST(0, (v_fd.interest_rate_bps::NUMERIC / 10000) - 0.01);
    v_interest := FLOOR(v_fd.principal_paise * v_eff_rate * (v_held_months / 12.0))::BIGINT;
  END IF;
  v_payout := v_fd.principal_paise + v_interest;

  INSERT INTO public.transactions (kind, status, from_account_id, to_account_id,
                                   amount_paise, description, idempotency_key, initiated_by, completed_at)
  VALUES ('fd_payout','success', v_sys_fd, v_fd.account_id, v_payout,
          'FD premature withdrawal', 'fd_pre:'||v_fd.id, v_user, now())
  RETURNING id INTO v_txn;
  INSERT INTO public.ledger_entries (transaction_id, account_id, direction, amount_paise) VALUES
    (v_txn, v_sys_fd,        'debit',  v_payout),
    (v_txn, v_fd.account_id, 'credit', v_payout);

  UPDATE public.fixed_deposits SET status='withdrawn', withdrawn_at=now(), payout_paise=v_payout WHERE id = v_fd.id;
  RETURN jsonb_build_object('ok', true, 'payout_paise', v_payout, 'interest_paise', v_interest);
END $$;

CREATE OR REPLACE FUNCTION public.run_fd_maturities()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD; v_interest BIGINT; v_payout BIGINT;
  v_sys_fd UUID := public._system_account('fd');
  v_txn UUID; v_count INT := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.fixed_deposits
     WHERE status='active' AND maturity_date <= CURRENT_DATE LIMIT 500
  LOOP
    v_interest := FLOOR(
      r.principal_paise::NUMERIC * (r.interest_rate_bps::NUMERIC / 10000) * (r.tenure_months::NUMERIC / 12.0)
    )::BIGINT;
    v_payout := r.principal_paise + v_interest;
    INSERT INTO public.transactions (kind, status, from_account_id, to_account_id,
                                     amount_paise, description, idempotency_key, initiated_by, completed_at)
    VALUES ('fd_payout','success', v_sys_fd, r.account_id, v_payout,
            'FD maturity payout', 'fd_mat:'||r.id, NULL, now())
    RETURNING id INTO v_txn;
    INSERT INTO public.ledger_entries (transaction_id, account_id, direction, amount_paise) VALUES
      (v_txn, v_sys_fd,    'debit',  v_payout),
      (v_txn, r.account_id,'credit', v_payout);
    UPDATE public.fixed_deposits SET status='matured', matured_at=now(), payout_paise=v_payout WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;
