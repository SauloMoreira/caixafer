CREATE POLICY "Cash coordinators can view operation insights"
  ON public.daily_operation_insights
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'cash_coordinator'::app_role));