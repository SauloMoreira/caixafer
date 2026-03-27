
-- Fix permissive INSERT policies on audit tables
DROP POLICY "System can insert audit logs" ON public.security_audit_logs;
CREATE POLICY "Authenticated can insert audit logs"
ON public.security_audit_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY "System can insert incidents" ON public.security_incidents;
CREATE POLICY "Authenticated can insert incidents"
ON public.security_incidents FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Fix the cash_closings audit trigger (had duplicate column)
CREATE OR REPLACE FUNCTION public.audit_cash_closings_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, new_data, severity)
    VALUES ('cash_opened', 'cash_closings', NEW.id, NEW.user_id, (SELECT role::text FROM profiles WHERE id = NEW.user_id), NEW.business_date, 'INSERT', to_jsonb(NEW), 'info');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, old_data, new_data, severity)
    VALUES (
      CASE WHEN NEW.status = 'closed' AND OLD.status = 'open' THEN 'cash_closed' ELSE 'cash_reopened' END,
      'cash_closings', NEW.id, auth.uid(), (SELECT role::text FROM profiles WHERE id = auth.uid()), NEW.business_date, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW),
      CASE WHEN NEW.status = 'closed' AND OLD.status = 'open' THEN 'medium' ELSE 'high' END
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;
