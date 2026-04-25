
-- Drop FK from accounts.user_id to auth.users so bank-internal pools can exist
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;

-- Create system pool accounts
DO $$
DECLARE
  v_system_user UUID := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE account_number = 'SYS_LOANS_POOL') THEN
    INSERT INTO public.accounts (user_id, account_number, account_type, ifsc)
    VALUES (v_system_user, 'SYS_LOANS_POOL', 'current', 'LOVB0SYSTEM');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE account_number = 'SYS_FD_POOL') THEN
    INSERT INTO public.accounts (user_id, account_number, account_type, ifsc)
    VALUES (v_system_user, 'SYS_FD_POOL', 'current', 'LOVB0SYSTEM');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._system_account(p_kind TEXT)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.accounts
   WHERE account_number = CASE p_kind
                            WHEN 'loans' THEN 'SYS_LOANS_POOL'
                            WHEN 'fd'    THEN 'SYS_FD_POOL'
                          END
   LIMIT 1;
$$;
