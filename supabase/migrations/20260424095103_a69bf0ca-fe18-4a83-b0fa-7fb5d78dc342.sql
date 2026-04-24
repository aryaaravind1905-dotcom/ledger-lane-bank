
-- ============================================================
-- BANKING APP: Phase 1 + AutoPay & Cards
-- Double-entry ledger, idempotent transfers, strict RLS
-- ============================================================

-- ---------- ENUMS ----------
CREATE TYPE public.account_type AS ENUM ('savings', 'current');
CREATE TYPE public.account_status AS ENUM ('active', 'frozen', 'closed');
CREATE TYPE public.txn_status AS ENUM ('pending', 'success', 'failed');
CREATE TYPE public.txn_kind AS ENUM ('transfer', 'autopay', 'reversal', 'system');
CREATE TYPE public.entry_direction AS ENUM ('debit', 'credit');
CREATE TYPE public.autopay_freq AS ENUM ('daily', 'weekly', 'monthly');
CREATE TYPE public.autopay_status AS ENUM ('active', 'paused', 'disabled');
CREATE TYPE public.card_status AS ENUM ('active', 'blocked');

-- ---------- PROFILES ----------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read"  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile write" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ---------- ACCOUNTS ----------
-- account_number: 12-digit synthetic; ifsc fixed for our "bank"
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL UNIQUE,
  ifsc TEXT NOT NULL DEFAULT 'LOVB0000001',
  account_type public.account_type NOT NULL,
  status public.account_status NOT NULL DEFAULT 'active',
  -- Opening credit so a fresh user has something to play with (seeded via signup function)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX accounts_user_idx ON public.accounts(user_id);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts read" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
-- Inserts/updates happen only via SECURITY DEFINER functions

-- ---------- LEDGER ENTRIES (double-entry; immutable) ----------
CREATE TABLE public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  direction public.entry_direction NOT NULL,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ledger_account_idx ON public.ledger_entries(account_id);
CREATE INDEX ledger_txn_idx ON public.ledger_entries(transaction_id);
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ledger read" ON public.ledger_entries FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.user_id = auth.uid())
);

-- ---------- TRANSACTIONS ----------
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.txn_kind NOT NULL DEFAULT 'transfer',
  status public.txn_status NOT NULL DEFAULT 'pending',
  from_account_id UUID REFERENCES public.accounts(id),
  to_account_id UUID REFERENCES public.accounts(id),
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  description TEXT,
  failure_reason TEXT,
  idempotency_key TEXT UNIQUE,
  initiated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX txn_from_idx ON public.transactions(from_account_id);
CREATE INDEX txn_to_idx   ON public.transactions(to_account_id);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own txn read" ON public.transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.accounts a
          WHERE (a.id = from_account_id OR a.id = to_account_id)
            AND a.user_id = auth.uid())
);

-- ---------- BENEFICIARIES ----------
CREATE TABLE public.beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc TEXT NOT NULL,
  holder_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, account_number, ifsc)
);
ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own benef all" ON public.beneficiaries FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- AUTOPAY ----------
CREATE TABLE public.autopay_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_account_id UUID NOT NULL REFERENCES public.accounts(id),
  to_account_number TEXT NOT NULL,
  to_ifsc TEXT NOT NULL,
  nickname TEXT NOT NULL,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  frequency public.autopay_freq NOT NULL,
  status public.autopay_status NOT NULL DEFAULT 'active',
  next_run_at TIMESTAMPTZ NOT NULL,
  consecutive_failures INT NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  last_status public.txn_status,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX autopay_user_idx ON public.autopay_configs(user_id);
CREATE INDEX autopay_due_idx  ON public.autopay_configs(next_run_at) WHERE status = 'active';
ALTER TABLE public.autopay_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own autopay all" ON public.autopay_configs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- CARDS ----------
-- Only PIN HASH stored; never plaintext.
CREATE TABLE public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  card_number_last4 TEXT NOT NULL,
  card_number_masked TEXT NOT NULL,  -- e.g. "**** **** **** 1234"
  cardholder_name TEXT NOT NULL,
  expiry_month INT NOT NULL,
  expiry_year INT NOT NULL,
  pin_hash TEXT,                      -- bcrypt-style hash via pgcrypto
  status public.card_status NOT NULL DEFAULT 'active',
  failed_pin_attempts INT NOT NULL DEFAULT 0,
  blocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cards_user_idx ON public.cards(user_id);
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cards read" ON public.cards FOR SELECT USING (auth.uid() = user_id);
-- Mutations via SECURITY DEFINER functions only

-- ---------- TIMESTAMPS TRIGGER ----------
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- HELPERS: balance derivation ----------
CREATE OR REPLACE FUNCTION public.account_balance_paise(p_account UUID)
RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_paise ELSE -amount_paise END), 0)
  FROM public.ledger_entries WHERE account_id = p_account;
$$;

-- ---------- SIGNUP HOOK ----------
-- Auto-creates profile + savings account + opening seed credit + virtual card
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_acc UUID;
  v_acc_no TEXT;
  v_card_pan TEXT;
  v_seed_txn UUID;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
          NEW.raw_user_meta_data->>'phone');

  v_acc_no := lpad((floor(random()*1e12))::bigint::text, 12, '0');
  INSERT INTO public.accounts (user_id, account_number, account_type)
  VALUES (NEW.id, v_acc_no, 'savings') RETURNING id INTO v_acc;

  -- Opening credit ₹10,000 (1,000,000 paise) from system to make app usable
  INSERT INTO public.transactions (kind, status, to_account_id, amount_paise, description, initiated_by, completed_at)
  VALUES ('system', 'success', v_acc, 1000000, 'Welcome opening credit', NEW.id, now())
  RETURNING id INTO v_seed_txn;
  INSERT INTO public.ledger_entries (transaction_id, account_id, direction, amount_paise)
  VALUES (v_seed_txn, v_acc, 'credit', 1000000);

  -- Virtual card
  v_card_pan := lpad((floor(random()*1e16))::bigint::text, 16, '0');
  INSERT INTO public.cards (user_id, account_id, card_number_last4, card_number_masked,
                            cardholder_name, expiry_month, expiry_year)
  VALUES (NEW.id, v_acc, right(v_card_pan,4),
          '**** **** **** ' || right(v_card_pan,4),
          COALESCE(NEW.raw_user_meta_data->>'full_name','Card Holder'),
          12, EXTRACT(YEAR FROM now())::INT + 5);

  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- TRANSFER ENGINE (idempotent, atomic, policy-enforced) ----------
-- Limits: per-txn 1,00,000 INR ; daily 5,00,000 INR
-- Savings min balance: 1,000 INR
CREATE OR REPLACE FUNCTION public.execute_transfer(
  p_from_account UUID,
  p_to_account_number TEXT,
  p_to_ifsc TEXT,
  p_amount_paise BIGINT,
  p_description TEXT,
  p_idempotency_key TEXT,
  p_kind public.txn_kind DEFAULT 'transfer'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_from public.accounts;
  v_to   public.accounts;
  v_txn  UUID;
  v_existing public.transactions;
  v_balance BIGINT;
  v_min_balance BIGINT;
  v_daily_spent BIGINT;
  v_per_txn_limit CONSTANT BIGINT := 10000000;   -- 1,00,000 INR
  v_daily_limit   CONSTANT BIGINT := 50000000;   -- 5,00,000 INR
  v_savings_min   CONSTANT BIGINT := 100000;     -- 1,000 INR
BEGIN
  IF v_user IS NULL AND p_kind <> 'autopay' THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.transactions WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('transaction_id', v_existing.id, 'status', v_existing.status, 'idempotent_replay', true);
    END IF;
  END IF;

  -- Validate amount + per-txn limit
  IF p_amount_paise <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF p_amount_paise > v_per_txn_limit THEN RAISE EXCEPTION 'per_transaction_limit_exceeded'; END IF;

  -- Lock from account
  SELECT * INTO v_from FROM public.accounts WHERE id = p_from_account FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'from_account_not_found'; END IF;
  IF p_kind <> 'autopay' AND v_from.user_id <> v_user THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_from.status <> 'active' THEN RAISE EXCEPTION 'from_account_inactive'; END IF;

  -- Resolve destination (intra-bank if exists, else external simulated)
  SELECT * INTO v_to FROM public.accounts
   WHERE account_number = p_to_account_number AND ifsc = p_to_ifsc
   FOR UPDATE;

  -- Daily spent (only successful debits today)
  SELECT COALESCE(SUM(amount_paise),0) INTO v_daily_spent
  FROM public.transactions
  WHERE from_account_id = p_from_account
    AND status = 'success'
    AND created_at >= date_trunc('day', now());
  IF v_daily_spent + p_amount_paise > v_daily_limit THEN
    RAISE EXCEPTION 'daily_limit_exceeded';
  END IF;

  -- Create pending transaction
  INSERT INTO public.transactions (kind, status, from_account_id, to_account_id,
                                   amount_paise, description, idempotency_key, initiated_by)
  VALUES (p_kind, 'pending', p_from_account,
          CASE WHEN v_to.id IS NOT NULL THEN v_to.id ELSE NULL END,
          p_amount_paise, p_description, p_idempotency_key, v_user)
  RETURNING id INTO v_txn;

  -- Balance check w/ min balance rule
  v_balance := public.account_balance_paise(p_from_account);
  v_min_balance := CASE WHEN v_from.account_type = 'savings' THEN v_savings_min ELSE 0 END;
  IF v_balance - p_amount_paise < v_min_balance THEN
    UPDATE public.transactions
       SET status='failed', failure_reason='insufficient_balance', completed_at=now()
     WHERE id = v_txn;
    RETURN jsonb_build_object('transaction_id', v_txn, 'status','failed','reason','insufficient_balance');
  END IF;

  -- Post double-entry
  INSERT INTO public.ledger_entries (transaction_id, account_id, direction, amount_paise)
  VALUES (v_txn, p_from_account, 'debit', p_amount_paise);

  IF v_to.id IS NOT NULL THEN
    INSERT INTO public.ledger_entries (transaction_id, account_id, direction, amount_paise)
    VALUES (v_txn, v_to.id, 'credit', p_amount_paise);
  END IF;
  -- For external (no matching account), debit-only is fine: money leaves the bank.

  UPDATE public.transactions
     SET status='success', completed_at=now()
   WHERE id = v_txn;

  RETURN jsonb_build_object('transaction_id', v_txn, 'status','success');
END $$;

-- ---------- AUTOPAY RUNNER ----------
CREATE OR REPLACE FUNCTION public.run_due_autopays()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_result JSONB;
  v_count INT := 0;
  v_idem TEXT;
  v_status TEXT;
BEGIN
  FOR r IN
    SELECT * FROM public.autopay_configs
     WHERE status='active' AND next_run_at <= now()
     ORDER BY next_run_at ASC
     LIMIT 200
  LOOP
    v_idem := 'autopay:' || r.id || ':' || to_char(r.next_run_at,'YYYYMMDDHH24MISS');
    BEGIN
      v_result := public.execute_transfer(
        r.from_account_id, r.to_account_number, r.to_ifsc,
        r.amount_paise, 'AutoPay: ' || r.nickname, v_idem, 'autopay'
      );
      v_status := v_result->>'status';
    EXCEPTION WHEN OTHERS THEN
      v_status := 'failed';
    END;

    IF v_status = 'success' THEN
      UPDATE public.autopay_configs
         SET last_run_at = now(),
             last_status = 'success',
             consecutive_failures = 0,
             next_run_at = CASE r.frequency
               WHEN 'daily'   THEN r.next_run_at + INTERVAL '1 day'
               WHEN 'weekly'  THEN r.next_run_at + INTERVAL '7 days'
               WHEN 'monthly' THEN r.next_run_at + INTERVAL '1 month'
             END
       WHERE id = r.id;
    ELSE
      UPDATE public.autopay_configs
         SET last_run_at = now(),
             last_status = 'failed',
             consecutive_failures = r.consecutive_failures + 1,
             status = CASE WHEN r.consecutive_failures + 1 >= 3 THEN 'disabled'::autopay_status ELSE 'active'::autopay_status END,
             next_run_at = r.next_run_at + INTERVAL '1 day'  -- 24h retry gap per policy
       WHERE id = r.id;
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

-- ---------- CARD PIN MANAGEMENT ----------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_card_pin(p_card UUID, p_pin TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_card public.cards;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF p_pin !~ '^\d{4}$' THEN RAISE EXCEPTION 'pin_must_be_4_digits'; END IF;
  SELECT * INTO v_card FROM public.cards WHERE id = p_card AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'card_not_found'; END IF;
  UPDATE public.cards
     SET pin_hash = crypt(p_pin, gen_salt('bf')),
         failed_pin_attempts = 0
   WHERE id = p_card;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.verify_card_pin(p_card UUID, p_pin TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_card public.cards; v_ok BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO v_card FROM public.cards WHERE id = p_card AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'card_not_found'; END IF;
  IF v_card.status = 'blocked' THEN
    RETURN jsonb_build_object('ok', false, 'blocked', true, 'reason','card_blocked');
  END IF;
  IF v_card.pin_hash IS NULL THEN RAISE EXCEPTION 'pin_not_set'; END IF;
  v_ok := (v_card.pin_hash = crypt(p_pin, v_card.pin_hash));
  IF v_ok THEN
    UPDATE public.cards SET failed_pin_attempts = 0 WHERE id = p_card;
    RETURN jsonb_build_object('ok', true);
  ELSE
    UPDATE public.cards
       SET failed_pin_attempts = v_card.failed_pin_attempts + 1,
           status = CASE WHEN v_card.failed_pin_attempts + 1 >= 3 THEN 'blocked'::card_status ELSE 'active'::card_status END,
           blocked_at = CASE WHEN v_card.failed_pin_attempts + 1 >= 3 THEN now() ELSE NULL END
     WHERE id = p_card;
    RETURN jsonb_build_object('ok', false, 'attempts', v_card.failed_pin_attempts + 1,
                              'blocked', v_card.failed_pin_attempts + 1 >= 3);
  END IF;
END $$;

-- Unblock requires a 6-digit "OTP" (we just check it equals a value provided client-side via simulated flow).
-- We simulate by accepting any 6-digit code (in a real system, send via SMS).
CREATE OR REPLACE FUNCTION public.unblock_card(p_card UUID, p_otp TEXT, p_new_pin TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF p_otp !~ '^\d{6}$' THEN RAISE EXCEPTION 'invalid_otp'; END IF;
  IF p_new_pin !~ '^\d{4}$' THEN RAISE EXCEPTION 'pin_must_be_4_digits'; END IF;
  UPDATE public.cards
     SET status='active', failed_pin_attempts=0, blocked_at=NULL,
         pin_hash = crypt(p_new_pin, gen_salt('bf'))
   WHERE id = p_card AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'card_not_found'; END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ---------- pg_cron: AutoPay every 5 minutes ----------
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('autopay-runner', '*/5 * * * *', $$ SELECT public.run_due_autopays(); $$);
