
-- Allow transferred-to cashier to update cash_closings they are responsible for (today only)
CREATE POLICY "Transferred cashier can update closings today"
  ON public.cash_closings FOR UPDATE
  TO authenticated
  USING (current_responsible_id = auth.uid() AND business_date = CURRENT_DATE AND auth.uid() != user_id);

-- Allow transferred-to cashier to view cash_closings they are responsible for
CREATE POLICY "Transferred cashier can view closings"
  ON public.cash_closings FOR SELECT
  TO authenticated
  USING (current_responsible_id = auth.uid());

-- Allow transferred-to cashier to insert sales for a session they are responsible for
-- (sales RLS uses created_by = auth.uid() which already works)

-- Allow transferred-to cashier to insert cash_entries for a session they are responsible for
-- (cash_entries RLS uses created_by = auth.uid() which already works)
