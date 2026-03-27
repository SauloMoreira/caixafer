-- Function to check open cash session today, bypassing RLS
-- Returns the session info so any cashier can know if a session is already open
CREATE OR REPLACE FUNCTION public.get_open_cash_session_today()
RETURNS TABLE(
  closing_id uuid,
  business_date date,
  user_id uuid,
  current_responsible_id uuid,
  responsible_name text,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    cc.id as closing_id,
    cc.business_date,
    cc.user_id,
    cc.current_responsible_id,
    p.full_name as responsible_name,
    cc.status::text
  FROM public.cash_closings cc
  JOIN public.profiles p ON p.id = cc.current_responsible_id
  WHERE cc.business_date = CURRENT_DATE
    AND cc.status = 'open'
    AND cc.is_latest_version = true
  LIMIT 1;
$$;