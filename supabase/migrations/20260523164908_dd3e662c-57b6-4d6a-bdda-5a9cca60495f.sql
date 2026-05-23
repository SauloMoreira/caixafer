
-- 1) Recreate {public}-role policies as {authenticated}
DROP POLICY IF EXISTS "Admins can do all on closings" ON public.cash_closings;
DROP POLICY IF EXISTS "Cashiers can insert closings" ON public.cash_closings;
DROP POLICY IF EXISTS "Cashiers can update own closings today or close pending" ON public.cash_closings;
DROP POLICY IF EXISTS "Cashiers can view own closings" ON public.cash_closings;
CREATE POLICY "Admins can do all on closings" ON public.cash_closings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Cashiers can insert closings" ON public.cash_closings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Cashiers can update own closings today or close pending" ON public.cash_closings FOR UPDATE TO authenticated USING ((auth.uid() = user_id) AND ((business_date = CURRENT_DATE) OR (status = 'open'::closing_status))) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Cashiers can view own closings" ON public.cash_closings FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can do all on entries" ON public.cash_entries;
DROP POLICY IF EXISTS "Cashiers can delete own entries today" ON public.cash_entries;
DROP POLICY IF EXISTS "Cashiers can insert entries" ON public.cash_entries;
DROP POLICY IF EXISTS "Cashiers can update own entries today" ON public.cash_entries;
DROP POLICY IF EXISTS "Cashiers can view own entries" ON public.cash_entries;
CREATE POLICY "Admins can do all on entries" ON public.cash_entries FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Cashiers can delete own entries today" ON public.cash_entries FOR DELETE TO authenticated USING ((auth.uid() = created_by) AND (business_date = CURRENT_DATE));
CREATE POLICY "Cashiers can insert entries" ON public.cash_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Cashiers can update own entries today" ON public.cash_entries FOR UPDATE TO authenticated USING ((auth.uid() = created_by) AND (business_date = CURRENT_DATE));
CREATE POLICY "Cashiers can view own entries" ON public.cash_entries FOR SELECT TO authenticated USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Admins can do all on transfers" ON public.cash_session_transfers;
CREATE POLICY "Admins can do all on transfers" ON public.cash_session_transfers FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can update categories" ON public.categories;
CREATE POLICY "Admins can delete categories" ON public.categories FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update categories" ON public.categories FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can do all on operation insights" ON public.daily_operation_insights;
CREATE POLICY "Admins can do all on operation insights" ON public.daily_operation_insights FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
CREATE POLICY "Admins can delete products" ON public.products FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update products" ON public.products FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update profiles" ON public.profiles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can do all on sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Cashiers can delete own sale items today" ON public.sale_items;
DROP POLICY IF EXISTS "Cashiers can insert sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Cashiers can update own sale items today" ON public.sale_items;
DROP POLICY IF EXISTS "Cashiers can view own sale items" ON public.sale_items;
CREATE POLICY "Admins can do all on sale items" ON public.sale_items FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Cashiers can delete own sale items today" ON public.sale_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND sales.created_by = auth.uid() AND sales.business_date = CURRENT_DATE));
CREATE POLICY "Cashiers can insert sale items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND sales.created_by = auth.uid()));
CREATE POLICY "Cashiers can update own sale items today" ON public.sale_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND sales.created_by = auth.uid() AND sales.business_date = CURRENT_DATE));
CREATE POLICY "Cashiers can view own sale items" ON public.sale_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND sales.created_by = auth.uid()));

DROP POLICY IF EXISTS "Admins can do all on sales" ON public.sales;
DROP POLICY IF EXISTS "Cashiers can delete own sales today" ON public.sales;
DROP POLICY IF EXISTS "Cashiers can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Cashiers can update own sales today" ON public.sales;
DROP POLICY IF EXISTS "Cashiers can view own sales" ON public.sales;
CREATE POLICY "Admins can do all on sales" ON public.sales FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Cashiers can delete own sales today" ON public.sales FOR DELETE TO authenticated USING ((auth.uid() = created_by) AND (business_date = CURRENT_DATE));
CREATE POLICY "Cashiers can insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Cashiers can update own sales today" ON public.sales FOR UPDATE TO authenticated USING ((auth.uid() = created_by) AND (business_date = CURRENT_DATE));
CREATE POLICY "Cashiers can view own sales" ON public.sales FOR SELECT TO authenticated USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Admins can do all on fiado charge items" ON public.spr_fiado_charge_items;
DROP POLICY IF EXISTS "Admins can do all on fiado charges" ON public.spr_fiado_charges;
DROP POLICY IF EXISTS "Admins can do all on fiado payments" ON public.spr_fiado_payments;
CREATE POLICY "Admins can do all on fiado charge items" ON public.spr_fiado_charge_items FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can do all on fiado charges" ON public.spr_fiado_charges FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can do all on fiado payments" ON public.spr_fiado_payments FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete volunteers" ON public.spr_volunteers;
DROP POLICY IF EXISTS "Admins can insert volunteers" ON public.spr_volunteers;
DROP POLICY IF EXISTS "Admins can update volunteers" ON public.spr_volunteers;
CREATE POLICY "Admins can delete volunteers" ON public.spr_volunteers FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert volunteers" ON public.spr_volunteers FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update volunteers" ON public.spr_volunteers FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 2) Volunteer avatar storage policies
DROP POLICY IF EXISTS "Authenticated can upload volunteer avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update volunteer avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete volunteer avatars" ON storage.objects;

CREATE POLICY "SPR operators can upload volunteer avatars"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'volunteers'
    AND (has_role(auth.uid(), 'admin'::app_role) OR can_access_spr_operation()));

CREATE POLICY "SPR operators can update volunteer avatars"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'volunteers'
    AND (has_role(auth.uid(), 'admin'::app_role) OR can_access_spr_operation()));

CREATE POLICY "SPR operators can delete volunteer avatars"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'volunteers'
    AND (has_role(auth.uid(), 'admin'::app_role) OR can_access_spr_operation()));

-- 3) Replace direct security inserts with RPCs
DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.security_audit_logs;
DROP POLICY IF EXISTS "Authenticated can insert incidents" ON public.security_incidents;

CREATE OR REPLACE FUNCTION public.log_security_event(
  _event_type text, _entity_type text, _action text,
  _entity_id uuid DEFAULT NULL, _route text DEFAULT NULL, _notes text DEFAULT NULL,
  _severity text DEFAULT 'info', _old_data jsonb DEFAULT NULL, _new_data jsonb DEFAULT NULL,
  _target_user_id uuid DEFAULT NULL, _business_date date DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  IF _severity NOT IN ('info','low','medium','high','critical') THEN _severity := 'info'; END IF;
  IF length(_event_type) > 100 OR length(_entity_type) > 100 OR length(_action) > 100 THEN
    RAISE EXCEPTION 'Field too long';
  END IF;
  IF _notes IS NOT NULL AND length(_notes) > 2000 THEN _notes := left(_notes, 2000); END IF;
  INSERT INTO public.security_audit_logs(
    event_type, entity_type, entity_id, user_id, action, route, notes,
    severity, old_data, new_data, target_user_id, business_date
  ) VALUES (
    _event_type, _entity_type, _entity_id, _uid, _action, _route, _notes,
    _severity, _old_data, _new_data, _target_user_id, _business_date
  );
END; $$;

CREATE OR REPLACE FUNCTION public.log_security_incident(
  _incident_type text, _route text DEFAULT NULL, _context jsonb DEFAULT NULL, _severity text DEFAULT 'medium'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  IF _severity NOT IN ('low','medium','high','critical') THEN _severity := 'medium'; END IF;
  IF length(_incident_type) > 100 THEN RAISE EXCEPTION 'incident_type too long'; END IF;
  INSERT INTO public.security_incidents(incident_type, user_id, route, context, severity)
  VALUES (_incident_type, _uid, _route, _context, _severity);
END; $$;

-- 4) Remove security tables from Realtime
ALTER PUBLICATION supabase_realtime DROP TABLE public.security_alerts;
ALTER PUBLICATION supabase_realtime DROP TABLE public.security_audit_logs;

-- 5) Revoke anon execute on SECURITY DEFINER helpers, grant to authenticated
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon;', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated;', r.sig);
  END LOOP;
END $$;
