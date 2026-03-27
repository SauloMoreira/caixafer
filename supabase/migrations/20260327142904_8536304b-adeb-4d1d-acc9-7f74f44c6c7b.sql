
-- Security audit logs table
CREATE TABLE public.security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  user_id uuid REFERENCES public.profiles(id),
  user_role text,
  target_user_id uuid,
  business_date date,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  route text,
  notes text,
  severity text NOT NULL DEFAULT 'info',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view audit logs"
ON public.security_audit_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit logs"
ON public.security_audit_logs FOR INSERT TO authenticated
WITH CHECK (true);

-- Security incidents table
CREATE TABLE public.security_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_type text NOT NULL,
  user_id uuid REFERENCES public.profiles(id),
  route text,
  context jsonb,
  severity text NOT NULL DEFAULT 'medium',
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid REFERENCES public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view incidents"
ON public.security_incidents FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update incidents"
ON public.security_incidents FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert incidents"
ON public.security_incidents FOR INSERT TO authenticated
WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_audit_logs_event_type ON public.security_audit_logs(event_type);
CREATE INDEX idx_audit_logs_created_at ON public.security_audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON public.security_audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_type ON public.security_audit_logs(entity_type);
CREATE INDEX idx_incidents_type ON public.security_incidents(incident_type);
CREATE INDEX idx_incidents_created_at ON public.security_incidents(created_at DESC);

-- Audit trigger function for sales
CREATE OR REPLACE FUNCTION public.audit_sales_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, new_data, severity)
    VALUES ('sale_created', 'sales', NEW.id, NEW.created_by, (SELECT role::text FROM profiles WHERE id = NEW.created_by), NEW.business_date, 'INSERT', to_jsonb(NEW), 'info');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, old_data, new_data, severity)
    VALUES ('sale_updated', 'sales', NEW.id, auth.uid(), (SELECT role::text FROM profiles WHERE id = auth.uid()), NEW.business_date, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), 'medium');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, old_data, severity)
    VALUES ('sale_deleted', 'sales', OLD.id, auth.uid(), (SELECT role::text FROM profiles WHERE id = auth.uid()), OLD.business_date, 'DELETE', to_jsonb(OLD), 'high');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_sales
AFTER INSERT OR UPDATE OR DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.audit_sales_changes();

-- Audit trigger function for cash_entries
CREATE OR REPLACE FUNCTION public.audit_cash_entries_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, new_data, severity)
    VALUES ('cash_entry_created', 'cash_entries', NEW.id, NEW.created_by, (SELECT role::text FROM profiles WHERE id = NEW.created_by), NEW.business_date, 'INSERT', to_jsonb(NEW), 'info');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, old_data, new_data, severity)
    VALUES ('cash_entry_updated', 'cash_entries', NEW.id, auth.uid(), (SELECT role::text FROM profiles WHERE id = auth.uid()), NEW.business_date, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), 'medium');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, old_data, severity)
    VALUES ('cash_entry_deleted', 'cash_entries', OLD.id, auth.uid(), (SELECT role::text FROM profiles WHERE id = auth.uid()), OLD.business_date, 'DELETE', to_jsonb(OLD), 'high');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_cash_entries
AFTER INSERT OR UPDATE OR DELETE ON public.cash_entries
FOR EACH ROW EXECUTE FUNCTION public.audit_cash_entries_changes();

-- Audit trigger function for cash_closings
CREATE OR REPLACE FUNCTION public.audit_cash_closings_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, new_data, severity)
    VALUES ('cash_opened', 'cash_closings', NEW.id, NEW.user_id, (SELECT role::text FROM profiles WHERE id = NEW.user_id), NEW.business_date, 'INSERT', to_jsonb(NEW), 'info');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, old_data, new_data, severity,
      event_type)
    SELECT
      CASE WHEN NEW.status = 'closed' AND OLD.status = 'open' THEN 'cash_closed' ELSE 'cash_reopened' END,
      'cash_closings', NEW.id, auth.uid(), (SELECT role::text FROM profiles WHERE id = auth.uid()), NEW.business_date, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW),
      CASE WHEN NEW.status = 'closed' AND OLD.status = 'open' THEN 'medium' ELSE 'high' END;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_cash_closings
AFTER INSERT OR UPDATE ON public.cash_closings
FOR EACH ROW EXECUTE FUNCTION public.audit_cash_closings_changes();

-- Audit trigger function for spr_fiado_charges
CREATE OR REPLACE FUNCTION public.audit_fiado_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, new_data, severity)
    VALUES ('fiado_created', 'spr_fiado_charges', NEW.id, NEW.created_by, (SELECT role::text FROM profiles WHERE id = NEW.created_by), NEW.business_date, 'INSERT', to_jsonb(NEW), 'info');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, old_data, new_data, severity)
    VALUES ('fiado_updated', 'spr_fiado_charges', NEW.id, auth.uid(), (SELECT role::text FROM profiles WHERE id = auth.uid()), NEW.business_date, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), 'medium');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, old_data, severity)
    VALUES ('fiado_deleted', 'spr_fiado_charges', OLD.id, auth.uid(), (SELECT role::text FROM profiles WHERE id = auth.uid()), OLD.business_date, 'DELETE', to_jsonb(OLD), 'high');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_fiado_charges
AFTER INSERT OR UPDATE OR DELETE ON public.spr_fiado_charges
FOR EACH ROW EXECUTE FUNCTION public.audit_fiado_changes();

-- Audit trigger function for spr_fiado_payments
CREATE OR REPLACE FUNCTION public.audit_fiado_payments_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, new_data, severity)
    VALUES ('fiado_payment_created', 'spr_fiado_payments', NEW.id, NEW.created_by, (SELECT role::text FROM profiles WHERE id = NEW.created_by), NEW.payment_date, 'INSERT', to_jsonb(NEW), 'info');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, action, old_data, severity)
    VALUES ('fiado_payment_deleted', 'spr_fiado_payments', OLD.id, auth.uid(), (SELECT role::text FROM profiles WHERE id = auth.uid()), 'DELETE', to_jsonb(OLD), 'high');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_fiado_payments
AFTER INSERT OR DELETE ON public.spr_fiado_payments
FOR EACH ROW EXECUTE FUNCTION public.audit_fiado_payments_changes();

-- Audit trigger function for profiles (user management)
CREATE OR REPLACE FUNCTION public.audit_profile_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Only audit significant changes
    IF OLD.role IS DISTINCT FROM NEW.role
       OR OLD.approval_status IS DISTINCT FROM NEW.approval_status
       OR OLD.is_active IS DISTINCT FROM NEW.is_active
       OR OLD.volunteer_id IS DISTINCT FROM NEW.volunteer_id
    THEN
      INSERT INTO security_audit_logs (
        event_type, entity_type, entity_id, user_id, user_role, target_user_id, action, old_data, new_data, severity
      ) VALUES (
        CASE
          WHEN OLD.approval_status != 'approved' AND NEW.approval_status = 'approved' THEN 'user_approved'
          WHEN OLD.approval_status != 'rejected' AND NEW.approval_status = 'rejected' THEN 'user_rejected'
          WHEN OLD.is_active AND NOT NEW.is_active THEN 'user_deactivated'
          WHEN NOT OLD.is_active AND NEW.is_active THEN 'user_activated'
          WHEN OLD.role IS DISTINCT FROM NEW.role THEN 'role_changed'
          WHEN OLD.volunteer_id IS DISTINCT FROM NEW.volunteer_id THEN 'volunteer_link_changed'
          ELSE 'profile_updated'
        END,
        'profiles', NEW.id, auth.uid(),
        (SELECT role::text FROM profiles WHERE id = auth.uid()),
        NEW.id, 'UPDATE',
        jsonb_build_object('role', OLD.role, 'approval_status', OLD.approval_status, 'is_active', OLD.is_active, 'volunteer_id', OLD.volunteer_id),
        jsonb_build_object('role', NEW.role, 'approval_status', NEW.approval_status, 'is_active', NEW.is_active, 'volunteer_id', NEW.volunteer_id),
        CASE WHEN OLD.role IS DISTINCT FROM NEW.role OR OLD.is_active IS DISTINCT FROM NEW.is_active THEN 'high' ELSE 'medium' END
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_profiles
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_profile_changes();
