
-- Security alert candidates table
CREATE TABLE public.security_alert_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  audit_log_id uuid REFERENCES public.security_audit_logs(id),
  event_type text NOT NULL,
  session_id uuid,
  business_date date,
  actor_user_id uuid,
  target_user_id uuid,
  financial_delta numeric,
  context_json jsonb,
  candidate_score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
);

ALTER TABLE public.security_alert_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view candidates" ON public.security_alert_candidates
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can manage candidates" ON public.security_alert_candidates
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_alert_candidates_created ON public.security_alert_candidates(created_at DESC);
CREATE INDEX idx_alert_candidates_status ON public.security_alert_candidates(status);
CREATE INDEX idx_alert_candidates_score ON public.security_alert_candidates(candidate_score DESC);

-- Security alerts table
CREATE TABLE public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  candidate_id uuid REFERENCES public.security_alert_candidates(id),
  audit_log_id uuid REFERENCES public.security_audit_logs(id),
  severity text NOT NULL DEFAULT 'medium',
  priority text NOT NULL DEFAULT 'normal',
  title text NOT NULL,
  summary text,
  recommended_action text,
  fingerprint text,
  is_deduplicated boolean NOT NULL DEFAULT false,
  is_sent boolean NOT NULL DEFAULT false,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  requires_admin_review boolean NOT NULL DEFAULT false,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  review_notes text,
  event_type text,
  session_id uuid,
  business_date date,
  actor_user_id uuid,
  target_user_id uuid,
  context_json jsonb
);

ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view alerts" ON public.security_alerts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can update alerts" ON public.security_alerts
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "System can insert alerts" ON public.security_alerts
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_alerts_created ON public.security_alerts(created_at DESC);
CREATE INDEX idx_alerts_severity ON public.security_alerts(severity);
CREATE INDEX idx_alerts_is_read ON public.security_alerts(is_read) WHERE is_read = false;
CREATE INDEX idx_alerts_requires_review ON public.security_alerts(requires_admin_review) WHERE requires_admin_review = true;
CREATE INDEX idx_alerts_fingerprint ON public.security_alerts(fingerprint);
CREATE INDEX idx_alerts_event_type ON public.security_alerts(event_type);
CREATE INDEX idx_alerts_business_date ON public.security_alerts(business_date);

-- Security alert deliveries table
CREATE TABLE public.security_alert_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  alert_id uuid NOT NULL REFERENCES public.security_alerts(id),
  channel text NOT NULL,
  recipient text NOT NULL,
  delivery_status text NOT NULL DEFAULT 'pending',
  provider_response text,
  sent_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.security_alert_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view deliveries" ON public.security_alert_deliveries
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can manage deliveries" ON public.security_alert_deliveries
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_deliveries_alert ON public.security_alert_deliveries(alert_id);
CREATE INDEX idx_deliveries_channel ON public.security_alert_deliveries(channel);

-- Enable realtime for alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_alerts;

-- Function to evaluate audit logs and create alerts
CREATE OR REPLACE FUNCTION public.evaluate_security_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  score integer := 0;
  alert_severity text;
  alert_priority text;
  alert_title text;
  alert_fingerprint text;
  existing_alert_id uuid;
  candidate_id uuid;
  dedup_window interval := '30 minutes'::interval;
BEGIN
  -- Only process high-impact events
  IF NEW.severity NOT IN ('high', 'critical') AND NEW.event_type NOT IN (
    'cash_transfer_requested', 'cash_transfer_accepted', 'cash_responsibility_changed',
    'cash_reopened', 'cash_entry_deleted', 'sale_deleted',
    'unauthorized_route_access', 'unauthorized_data_access_attempt',
    'admin_access_blocked_missing_mfa'
  ) THEN
    RETURN NEW;
  END IF;

  -- Calculate score based on event type
  CASE NEW.event_type
    WHEN 'cash_responsibility_changed' THEN score := score + 40;
    WHEN 'cash_transfer_requested' THEN score := score + 25;
    WHEN 'cash_transfer_accepted' THEN score := score + 30;
    WHEN 'cash_reopened' THEN score := score + 35;
    WHEN 'cash_entry_deleted', 'sale_deleted' THEN score := score + 30;
    WHEN 'unauthorized_route_access', 'unauthorized_data_access_attempt' THEN score := score + 25;
    WHEN 'admin_access_blocked_missing_mfa' THEN score := score + 40;
    ELSE score := score + 10;
  END CASE;

  -- Boost for severity
  CASE NEW.severity
    WHEN 'critical' THEN score := score + 30;
    WHEN 'high' THEN score := score + 20;
    WHEN 'medium' THEN score := score + 5;
    ELSE NULL;
  END CASE;

  -- Boost for requires_admin_review
  IF NEW.requires_admin_review THEN score := score + 15; END IF;

  -- Boost for financial changes
  IF NEW.old_data IS NOT NULL AND NEW.new_data IS NOT NULL THEN
    IF (NEW.old_data->>'amount')::numeric IS DISTINCT FROM (NEW.new_data->>'amount')::numeric THEN
      score := score + 20;
    END IF;
    IF (NEW.old_data->>'total_amount')::numeric IS DISTINCT FROM (NEW.new_data->>'total_amount')::numeric THEN
      score := score + 20;
    END IF;
  END IF;

  -- Boost for recurrence (multiple events in same session today)
  IF NEW.session_id IS NOT NULL THEN
    IF (SELECT COUNT(*) FROM security_audit_logs WHERE session_id = NEW.session_id AND business_date = NEW.business_date AND severity IN ('high', 'critical') AND id != NEW.id) > 0 THEN
      score := score + 15;
    END IF;
  END IF;

  -- Determine severity and priority from score
  IF score >= 70 THEN
    alert_severity := 'critical'; alert_priority := 'urgent';
  ELSIF score >= 50 THEN
    alert_severity := 'high'; alert_priority := 'high';
  ELSIF score >= 30 THEN
    alert_severity := 'medium'; alert_priority := 'normal';
  ELSE
    -- Score too low, skip alert
    RETURN NEW;
  END IF;

  -- Generate fingerprint for deduplication
  alert_fingerprint := md5(NEW.event_type || COALESCE(NEW.session_id::text, '') || COALESCE(NEW.business_date::text, '') || COALESCE(NEW.user_id::text, ''));

  -- Check for deduplication
  SELECT id INTO existing_alert_id FROM security_alerts
  WHERE fingerprint = alert_fingerprint AND created_at > (now() - dedup_window) AND NOT is_deduplicated
  LIMIT 1;

  -- Generate title
  alert_title := COALESCE(NEW.action_summary, 
    CASE NEW.event_type
      WHEN 'cash_responsibility_changed' THEN 'Responsabilidade de caixa transferida'
      WHEN 'cash_transfer_requested' THEN 'Transferência de caixa solicitada'
      WHEN 'cash_transfer_accepted' THEN 'Transferência de caixa aceita'
      WHEN 'cash_reopened' THEN 'Caixa reaberto'
      WHEN 'cash_entry_deleted' THEN 'Lançamento excluído'
      WHEN 'sale_deleted' THEN 'Venda excluída'
      WHEN 'unauthorized_route_access' THEN 'Tentativa de acesso não autorizado'
      WHEN 'unauthorized_data_access_attempt' THEN 'Tentativa de acesso a dados'
      WHEN 'admin_access_blocked_missing_mfa' THEN 'Acesso admin bloqueado (sem MFA)'
      ELSE 'Evento de segurança: ' || NEW.event_type
    END
  );

  IF existing_alert_id IS NOT NULL THEN
    -- Deduplicate: mark the duplicate
    INSERT INTO security_alert_candidates (audit_log_id, event_type, session_id, business_date, actor_user_id, target_user_id, candidate_score, status)
    VALUES (NEW.id, NEW.event_type, NEW.session_id, NEW.business_date, NEW.user_id, NEW.target_user_id, score, 'deduplicated');
    RETURN NEW;
  END IF;

  -- Create candidate
  INSERT INTO security_alert_candidates (audit_log_id, event_type, session_id, business_date, actor_user_id, target_user_id, candidate_score, status)
  VALUES (NEW.id, NEW.event_type, NEW.session_id, NEW.business_date, NEW.user_id, NEW.target_user_id, score, 'promoted')
  RETURNING id INTO candidate_id;

  -- Create alert
  INSERT INTO security_alerts (candidate_id, audit_log_id, severity, priority, title, fingerprint, requires_admin_review, event_type, session_id, business_date, actor_user_id, target_user_id, context_json)
  VALUES (candidate_id, NEW.id, alert_severity, alert_priority, alert_title, alert_fingerprint,
    CASE WHEN alert_severity IN ('high', 'critical') THEN true ELSE false END,
    NEW.event_type, NEW.session_id, NEW.business_date, NEW.user_id, NEW.target_user_id,
    jsonb_build_object('action_summary', NEW.action_summary, 'reason', NEW.reason, 'old_data', NEW.old_data, 'new_data', NEW.new_data, 'user_role', NEW.user_role, 'route', NEW.route)
  );

  -- Create notification for admins (high/critical only)
  IF alert_severity IN ('high', 'critical') THEN
    INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
    SELECT p.id, 'cash_correction'::notification_type, '🚨 ' || alert_title,
      'Severidade: ' || alert_severity || '. Score: ' || score || '. Verifique a Central de Segurança.',
      'security_alert', NEW.id
    FROM profiles p WHERE p.role = 'admin'::app_role AND p.is_active = true;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger
CREATE TRIGGER evaluate_security_alert_trigger
  AFTER INSERT ON public.security_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.evaluate_security_alert();
