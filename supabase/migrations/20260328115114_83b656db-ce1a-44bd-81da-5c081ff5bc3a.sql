
-- Fix: Add explicit WITH CHECK to allow status change to 'closed' on previous days
DROP POLICY IF EXISTS "Cashiers can update own closings today or close pending" ON public.cash_closings;

CREATE POLICY "Cashiers can update own closings today or close pending"
ON public.cash_closings
FOR UPDATE
TO public
USING (
  (auth.uid() = user_id) AND (
    business_date = CURRENT_DATE
    OR status = 'open'::closing_status
  )
)
WITH CHECK (
  (auth.uid() = user_id)
);

DROP POLICY IF EXISTS "Transferred cashier can update closings today or close pending" ON public.cash_closings;

CREATE POLICY "Transferred cashier can update closings today or close pending"
ON public.cash_closings
FOR UPDATE
TO authenticated
USING (
  (current_responsible_id = auth.uid()) AND (auth.uid() <> user_id) AND (
    business_date = CURRENT_DATE
    OR status = 'open'::closing_status
  )
)
WITH CHECK (
  (current_responsible_id = auth.uid()) AND (auth.uid() <> user_id)
);
