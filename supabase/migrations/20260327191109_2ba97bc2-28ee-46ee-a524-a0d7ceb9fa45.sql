
-- Add missing columns to security_audit_logs
ALTER TABLE public.security_audit_logs
  ADD COLUMN IF NOT EXISTS session_id uuid,
  ADD COLUMN IF NOT EXISTS action_summary text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS requires_admin_review boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS target_role text;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.security_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_date ON public.security_audit_logs(business_date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON public.security_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON public.security_audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON public.security_audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user_id ON public.security_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON public.security_audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON public.security_audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_requires_review ON public.security_audit_logs(requires_admin_review) WHERE requires_admin_review = true;

-- Enable realtime for security_audit_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_audit_logs;

-- Update the audit_cash_transfers trigger to include session_id, action_summary, reason, snapshot, and responsibility changed event
CREATE OR REPLACE FUNCTION public.audit_cash_transfers()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  from_name text;
  to_name text;
  session_snapshot jsonb;
BEGIN
  SELECT full_name INTO from_name FROM profiles WHERE id = NEW.from_user_id;
  SELECT full_name INTO to_name FROM profiles WHERE id = NEW.to_user_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, new_data, severity, session_id, action_summary, reason, requires_admin_review, target_user_id, target_role, status)
    VALUES ('cash_transfer_requested', 'cash_session_transfers', NEW.id, NEW.from_user_id,
      (SELECT role::text FROM profiles WHERE id = NEW.from_user_id),
      NEW.business_date, 'INSERT', to_jsonb(NEW), 'medium', NEW.cash_closing_id,
      from_name || ' solicitou transferência para ' || to_name,
      NEW.transfer_reason, true, NEW.to_user_id,
      (SELECT role::text FROM profiles WHERE id = NEW.to_user_id),
      'pending');
    
    -- Notify all admins
    INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
    SELECT p.id, 'cash_transfer'::notification_type,
      'Transferência de caixa solicitada',
      from_name || ' solicitou transferência de caixa para ' || to_name || '. Motivo: ' || NEW.transfer_reason,
      'cash_transfer', NEW.id
    FROM profiles p WHERE p.role = 'admin'::app_role AND p.is_active = true;
    
    -- Notify target cashier
    INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
    VALUES (NEW.to_user_id, 'cash_transfer'::notification_type,
      'Solicitação de transferência de caixa',
      from_name || ' quer transferir o caixa para você. Motivo: ' || NEW.transfer_reason,
      'cash_transfer', NEW.id);
    
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Build session snapshot on acceptance
    IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
      SELECT jsonb_build_object(
        'opening_balance', cc.opening_balance,
        'sales_total', cc.sales_total,
        'income_total', cc.income_total,
        'expense_total', cc.expense_total,
        'expected_balance', cc.expected_balance,
        'transfer_count', cc.transfer_count,
        'current_responsible_id', cc.current_responsible_id
      ) INTO session_snapshot
      FROM cash_closings cc WHERE cc.id = NEW.cash_closing_id;
    END IF;

    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, old_data, new_data, severity, session_id, action_summary, reason, requires_admin_review, target_user_id, target_role, status)
    VALUES (
      CASE
        WHEN NEW.status = 'accepted' THEN 'cash_transfer_accepted'
        WHEN NEW.status = 'rejected' THEN 'cash_transfer_rejected'
        WHEN NEW.status = 'cancelled' THEN 'cash_transfer_cancelled'
        ELSE 'cash_transfer_updated'
      END,
      'cash_session_transfers', NEW.id, auth.uid(),
      (SELECT role::text FROM profiles WHERE id = auth.uid()),
      NEW.business_date, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW),
      CASE WHEN NEW.status = 'accepted' THEN 'high' ELSE 'medium' END,
      NEW.cash_closing_id,
      CASE
        WHEN NEW.status = 'accepted' THEN to_name || ' aceitou a transferência de ' || from_name
        WHEN NEW.status = 'rejected' THEN to_name || ' recusou a transferência de ' || from_name
        WHEN NEW.status = 'cancelled' THEN from_name || ' cancelou a transferência'
        ELSE 'Transferência atualizada'
      END,
      NEW.transfer_reason,
      CASE WHEN NEW.status = 'accepted' THEN true ELSE false END,
      CASE WHEN NEW.status = 'accepted' THEN NEW.from_user_id ELSE NEW.to_user_id END,
      CASE WHEN NEW.status = 'accepted' THEN (SELECT role::text FROM profiles WHERE id = NEW.from_user_id) ELSE (SELECT role::text FROM profiles WHERE id = NEW.to_user_id) END,
      CASE WHEN NEW.status = 'accepted' THEN 'completed' WHEN NEW.status = 'rejected' THEN 'rejected' WHEN NEW.status = 'cancelled' THEN 'cancelled' ELSE 'completed' END
    );
    
    -- On acceptance, update the cash_closings record and log responsibility change
    IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
      UPDATE cash_closings
      SET current_responsible_id = NEW.to_user_id,
          transfer_count = transfer_count + 1,
          last_transfer_id = NEW.id
      WHERE id = NEW.cash_closing_id;

      -- Log responsibility changed event with snapshot
      INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, new_data, severity, session_id, action_summary, reason, requires_admin_review, target_user_id, target_role, status)
      VALUES ('cash_responsibility_changed', 'cash_closings', NEW.cash_closing_id, NEW.to_user_id,
        (SELECT role::text FROM profiles WHERE id = NEW.to_user_id),
        NEW.business_date, 'UPDATE',
        jsonb_build_object('from_user', from_name, 'to_user', to_name, 'transfer_id', NEW.id, 'session_snapshot', session_snapshot),
        'high', NEW.cash_closing_id,
        'Responsabilidade transferida de ' || from_name || ' para ' || to_name,
        NEW.transfer_reason, true, NEW.from_user_id,
        (SELECT role::text FROM profiles WHERE id = NEW.from_user_id),
        'completed');
      
      -- Notify admins about acceptance
      INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
      SELECT p.id, 'cash_transfer'::notification_type,
        'Transferência de caixa aceita',
        to_name || ' aceitou a transferência de caixa de ' || from_name || '.',
        'cash_transfer', NEW.id
      FROM profiles p WHERE p.role = 'admin'::app_role AND p.is_active = true;
      
      -- Notify original cashier
      INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
      VALUES (NEW.from_user_id, 'cash_transfer'::notification_type,
        'Transferência aceita',
        to_name || ' aceitou a transferência do caixa.',
        'cash_transfer', NEW.id);
    END IF;
    
    -- On rejection, notify requester
    IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
      INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
      VALUES (NEW.from_user_id, 'cash_transfer'::notification_type,
        'Transferência recusada',
        to_name || ' recusou a transferência do caixa.',
        'cash_transfer', NEW.id);
    END IF;
    
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

-- Update cash_closings audit to include session_id and action_summary
CREATE OR REPLACE FUNCTION public.audit_cash_closings_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_name text;
BEGIN
  SELECT full_name INTO user_name FROM profiles WHERE id = COALESCE(auth.uid(), NEW.user_id);
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, new_data, severity, session_id, action_summary, status)
    VALUES ('cash_opened', 'cash_closings', NEW.id, NEW.user_id, (SELECT role::text FROM profiles WHERE id = NEW.user_id), NEW.business_date, 'INSERT', to_jsonb(NEW), 'info', NEW.id,
      COALESCE(user_name, 'Usuário') || ' abriu o caixa', 'completed');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, old_data, new_data, severity, session_id, action_summary, requires_admin_review, status)
    VALUES (
      CASE WHEN NEW.status = 'closed' AND OLD.status = 'open' THEN 'cash_closed'
           WHEN NEW.reopened_at IS NOT NULL AND OLD.reopened_at IS NULL THEN 'cash_reopened'
           ELSE 'cash_updated' END,
      'cash_closings', NEW.id, auth.uid(), (SELECT role::text FROM profiles WHERE id = auth.uid()), NEW.business_date, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW),
      CASE WHEN NEW.status = 'closed' AND OLD.status = 'open' THEN 'medium'
           WHEN NEW.reopened_at IS NOT NULL AND OLD.reopened_at IS NULL THEN 'high'
           ELSE 'info' END,
      NEW.id,
      CASE WHEN NEW.status = 'closed' AND OLD.status = 'open' THEN COALESCE(user_name, 'Usuário') || ' fechou o caixa'
           WHEN NEW.reopened_at IS NOT NULL AND OLD.reopened_at IS NULL THEN COALESCE(user_name, 'Usuário') || ' reabriu o caixa'
           ELSE COALESCE(user_name, 'Usuário') || ' atualizou o caixa' END,
      CASE WHEN NEW.reopened_at IS NOT NULL AND OLD.reopened_at IS NULL THEN true ELSE false END,
      'completed'
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

-- Update sales audit to include action_summary and session context
CREATE OR REPLACE FUNCTION public.audit_sales_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_name text;
BEGIN
  SELECT full_name INTO user_name FROM profiles WHERE id = COALESCE(auth.uid(), NEW.created_by);
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, new_data, severity, action_summary, status)
    VALUES ('sale_created', 'sales', NEW.id, NEW.created_by, (SELECT role::text FROM profiles WHERE id = NEW.created_by), NEW.business_date, 'INSERT', to_jsonb(NEW), 'info',
      COALESCE(user_name, 'Usuário') || ' registrou venda #' || NEW.sale_number, 'completed');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, old_data, new_data, severity, action_summary, requires_admin_review, status)
    VALUES (
      CASE WHEN NEW.is_deleted AND NOT OLD.is_deleted THEN 'sale_deleted' ELSE 'sale_updated' END,
      'sales', NEW.id, auth.uid(), (SELECT role::text FROM profiles WHERE id = auth.uid()), NEW.business_date, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW),
      CASE WHEN NEW.is_deleted AND NOT OLD.is_deleted THEN 'high' ELSE 'medium' END,
      CASE WHEN NEW.is_deleted AND NOT OLD.is_deleted THEN COALESCE(user_name, 'Usuário') || ' excluiu venda #' || NEW.sale_number
           ELSE COALESCE(user_name, 'Usuário') || ' editou venda #' || NEW.sale_number END,
      CASE WHEN NEW.is_deleted AND NOT OLD.is_deleted THEN true ELSE false END,
      'completed');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, old_data, severity, action_summary, requires_admin_review, status)
    VALUES ('sale_deleted', 'sales', OLD.id, auth.uid(), (SELECT role::text FROM profiles WHERE id = auth.uid()), OLD.business_date, 'DELETE', to_jsonb(OLD), 'high',
      'Venda #' || OLD.sale_number || ' removida permanentemente', true, 'completed');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- Update cash_entries audit to include action_summary
CREATE OR REPLACE FUNCTION public.audit_cash_entries_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_name text;
  entry_desc text;
BEGIN
  SELECT full_name INTO user_name FROM profiles WHERE id = COALESCE(auth.uid(), NEW.created_by);
  entry_desc := COALESCE(NEW.description, NEW.category);
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, new_data, severity, action_summary, status)
    VALUES ('cash_entry_created', 'cash_entries', NEW.id, NEW.created_by, (SELECT role::text FROM profiles WHERE id = NEW.created_by), NEW.business_date, 'INSERT', to_jsonb(NEW), 'info',
      COALESCE(user_name, 'Usuário') || ' criou ' || NEW.entry_type || ': ' || entry_desc, 'completed');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, old_data, new_data, severity, action_summary, requires_admin_review, status)
    VALUES (
      CASE WHEN NEW.is_deleted AND NOT OLD.is_deleted THEN 'cash_entry_deleted' ELSE 'cash_entry_updated' END,
      'cash_entries', NEW.id, auth.uid(), (SELECT role::text FROM profiles WHERE id = auth.uid()), NEW.business_date, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW),
      CASE WHEN NEW.is_deleted AND NOT OLD.is_deleted THEN 'high'
           WHEN OLD.amount IS DISTINCT FROM NEW.amount THEN 'high'
           WHEN OLD.payment_method IS DISTINCT FROM NEW.payment_method THEN 'medium'
           ELSE 'medium' END,
      CASE WHEN NEW.is_deleted AND NOT OLD.is_deleted THEN COALESCE(user_name, 'Usuário') || ' excluiu lançamento: ' || entry_desc
           WHEN OLD.amount IS DISTINCT FROM NEW.amount THEN COALESCE(user_name, 'Usuário') || ' corrigiu valor de lançamento'
           WHEN OLD.payment_method IS DISTINCT FROM NEW.payment_method THEN COALESCE(user_name, 'Usuário') || ' corrigiu forma de pagamento'
           ELSE COALESCE(user_name, 'Usuário') || ' editou lançamento: ' || entry_desc END,
      CASE WHEN NEW.is_deleted AND NOT OLD.is_deleted THEN true
           WHEN OLD.amount IS DISTINCT FROM NEW.amount THEN true
           ELSE false END,
      'completed');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, old_data, severity, action_summary, requires_admin_review, status)
    VALUES ('cash_entry_deleted', 'cash_entries', OLD.id, auth.uid(), (SELECT role::text FROM profiles WHERE id = auth.uid()), OLD.business_date, 'DELETE', to_jsonb(OLD), 'high',
      'Lançamento removido permanentemente', true, 'completed');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;
