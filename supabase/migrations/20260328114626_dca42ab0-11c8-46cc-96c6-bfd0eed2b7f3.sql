
-- Fix: Allow cashiers to update their own OPEN sessions from previous days (to close them)
-- Previously, the policy restricted updates to CURRENT_DATE only, blocking closing of previous-day sessions

-- Drop and recreate the cashier update policy
DROP POLICY IF EXISTS "Cashiers can update own closings today" ON public.cash_closings;

CREATE POLICY "Cashiers can update own closings today or close pending"
ON public.cash_closings
FOR UPDATE
TO public
USING (
  (auth.uid() = user_id) AND (
    business_date = CURRENT_DATE
    OR status = 'open'::closing_status
  )
);

-- Drop and recreate the transferred cashier update policy
DROP POLICY IF EXISTS "Transferred cashier can update closings today" ON public.cash_closings;

CREATE POLICY "Transferred cashier can update closings today or close pending"
ON public.cash_closings
FOR UPDATE
TO authenticated
USING (
  (current_responsible_id = auth.uid()) AND (auth.uid() <> user_id) AND (
    business_date = CURRENT_DATE
    OR status = 'open'::closing_status
  )
);
