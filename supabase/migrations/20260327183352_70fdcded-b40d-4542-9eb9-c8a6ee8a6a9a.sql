
-- Drop and recreate the target update policy with proper WITH CHECK
DROP POLICY IF EXISTS "Target can update transfer status" ON public.cash_session_transfers;
CREATE POLICY "Target can update transfer status"
  ON public.cash_session_transfers
  FOR UPDATE
  TO authenticated
  USING ((to_user_id = auth.uid()) AND (status = 'pending'::transfer_status))
  WITH CHECK ((to_user_id = auth.uid()) AND (status IN ('accepted'::transfer_status, 'rejected'::transfer_status)));

-- Fix requester cancel policy too
DROP POLICY IF EXISTS "Requester can cancel transfers" ON public.cash_session_transfers;
CREATE POLICY "Requester can cancel transfers"
  ON public.cash_session_transfers
  FOR UPDATE
  TO authenticated
  USING ((from_user_id = auth.uid()) AND (status = 'pending'::transfer_status))
  WITH CHECK ((from_user_id = auth.uid()) AND (status = 'cancelled'::transfer_status));
