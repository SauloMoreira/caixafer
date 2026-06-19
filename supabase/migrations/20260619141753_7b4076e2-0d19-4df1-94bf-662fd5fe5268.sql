
-- 1. Bloquear inserts diretos em security_audit_logs (forçar uso da RPC log_security_event)
DROP POLICY IF EXISTS "Block direct writes to security_audit_logs" ON public.security_audit_logs;
CREATE POLICY "Block direct writes to security_audit_logs"
  ON public.security_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Block direct updates to security_audit_logs" ON public.security_audit_logs;
CREATE POLICY "Block direct updates to security_audit_logs"
  ON public.security_audit_logs
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Block direct deletes to security_audit_logs" ON public.security_audit_logs;
CREATE POLICY "Block direct deletes to security_audit_logs"
  ON public.security_audit_logs
  FOR DELETE
  TO authenticated
  USING (false);

-- 2. Bloquear inserts/updates/deletes diretos em security_incidents
DROP POLICY IF EXISTS "Block direct writes to security_incidents" ON public.security_incidents;
CREATE POLICY "Block direct writes to security_incidents"
  ON public.security_incidents
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Block direct updates to security_incidents" ON public.security_incidents;
CREATE POLICY "Block direct updates to security_incidents"
  ON public.security_incidents
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Block direct deletes to security_incidents" ON public.security_incidents;
CREATE POLICY "Block direct deletes to security_incidents"
  ON public.security_incidents
  FOR DELETE
  TO authenticated
  USING (false);

-- 3. Bloquear inserts diretos de não-admins em security_alert_candidates
DROP POLICY IF EXISTS "Only admins can insert security_alert_candidates" ON public.security_alert_candidates;
CREATE POLICY "Only admins can insert security_alert_candidates"
  ON public.security_alert_candidates
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Restringir upload de product-images a admin/cash_coordinator
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
CREATE POLICY "Admin/coordinator can upload product images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'cash_coordinator'::app_role)
    )
  );

DROP POLICY IF EXISTS "Authenticated users can update own product images" ON storage.objects;
CREATE POLICY "Admin/coordinator can update product images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'cash_coordinator'::app_role)
    )
  );

DROP POLICY IF EXISTS "Authenticated users can delete own product images" ON storage.objects;
CREATE POLICY "Admin/coordinator can delete product images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'cash_coordinator'::app_role)
    )
  );

-- 5. Revogar EXECUTE público das funções do Livro de Caixa (manter apenas authenticated)
REVOKE EXECUTE ON FUNCTION public.get_cash_book_sales(date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_cash_book_entries(date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_cash_book_closings() FROM PUBLIC, anon;
