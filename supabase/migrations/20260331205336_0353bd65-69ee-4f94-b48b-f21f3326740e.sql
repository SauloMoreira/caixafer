ALTER TABLE public.cash_session_transfers
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.cash_closings(id),
  ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS snapshot_initial_balance numeric,
  ADD COLUMN IF NOT EXISTS snapshot_sales_total numeric,
  ADD COLUMN IF NOT EXISTS snapshot_income_total numeric,
  ADD COLUMN IF NOT EXISTS snapshot_expense_total numeric,
  ADD COLUMN IF NOT EXISTS snapshot_expected_balance numeric,
  ADD COLUMN IF NOT EXISTS snapshot_cash_total numeric,
  ADD COLUMN IF NOT EXISTS snapshot_pix_total numeric,
  ADD COLUMN IF NOT EXISTS snapshot_debit_total numeric,
  ADD COLUMN IF NOT EXISTS snapshot_credit_total numeric,
  ADD COLUMN IF NOT EXISTS snapshot_bank_transfer_total numeric,
  ADD COLUMN IF NOT EXISTS snapshot_fiado_payment_total numeric,
  ADD COLUMN IF NOT EXISTS snapshot_movement_count integer,
  ADD COLUMN IF NOT EXISTS snapshot_sale_count integer;

CREATE INDEX IF NOT EXISTS idx_cash_session_transfers_session_id
  ON public.cash_session_transfers(session_id);

CREATE INDEX IF NOT EXISTS idx_cash_session_transfers_business_date_status_requested_at
  ON public.cash_session_transfers(business_date, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_session_transfers_from_to_users
  ON public.cash_session_transfers(from_user_id, to_user_id);

CREATE OR REPLACE FUNCTION public.set_cash_transfer_snapshot_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opening_balance numeric := 0;
  v_sales_total numeric := 0;
  v_income_total numeric := 0;
  v_expense_total numeric := 0;
  v_expected_balance numeric := 0;
  v_cash_total numeric := 0;
  v_pix_total numeric := 0;
  v_debit_total numeric := 0;
  v_credit_total numeric := 0;
  v_bank_transfer_total numeric := 0;
  v_fiado_payment_total numeric := 0;
  v_movement_count integer := 0;
  v_sale_count integer := 0;
BEGIN
  NEW.updated_at := now();
  NEW.session_id := COALESCE(NEW.session_id, NEW.cash_closing_id);

  IF TG_OP = 'INSERT' THEN
    NEW.requested_by := COALESCE(NEW.requested_by, NEW.from_user_id, auth.uid());
    RETURN NEW;
  END IF;

  NEW.requested_by := COALESCE(NEW.requested_by, OLD.requested_by, NEW.from_user_id);

  IF NEW.status = 'accepted' AND COALESCE(OLD.status, 'pending'::transfer_status) <> 'accepted' THEN
    NEW.accepted_at := COALESCE(NEW.accepted_at, now());
    NEW.accepted_by := COALESCE(NEW.accepted_by, auth.uid(), NEW.to_user_id);

    SELECT COALESCE(cc.opening_balance, 0)
      INTO v_opening_balance
    FROM public.cash_closings cc
    WHERE cc.id = NEW.cash_closing_id
    LIMIT 1;

    SELECT
      COALESCE(SUM(CASE WHEN s.payment_method = 'dinheiro' THEN s.total_amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN s.payment_method = 'pix' THEN s.total_amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN s.payment_method = 'debito' THEN s.total_amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN s.payment_method = 'credito' THEN s.total_amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN s.payment_method = 'transferencia' THEN s.total_amount ELSE 0 END), 0),
      COALESCE(SUM(s.total_amount), 0),
      COUNT(*)::integer
    INTO
      v_cash_total,
      v_pix_total,
      v_debit_total,
      v_credit_total,
      v_bank_transfer_total,
      v_sales_total,
      v_sale_count
    FROM public.sales s
    WHERE s.business_date = NEW.business_date
      AND COALESCE(s.is_deleted, false) = false;

    SELECT
      COALESCE(SUM(CASE WHEN ce.entry_type = 'income' THEN ce.amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN ce.entry_type = 'expense' THEN ce.amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN ce.source_type = 'spr_fiado_payment' THEN ce.amount ELSE 0 END), 0),
      COUNT(*)::integer
    INTO
      v_income_total,
      v_expense_total,
      v_fiado_payment_total,
      v_movement_count
    FROM public.cash_entries ce
    WHERE ce.business_date = NEW.business_date
      AND COALESCE(ce.is_deleted, false) = false;

    v_expected_balance := v_opening_balance + v_sales_total + v_income_total - v_expense_total;

    NEW.snapshot_initial_balance := v_opening_balance;
    NEW.snapshot_sales_total := v_sales_total;
    NEW.snapshot_income_total := v_income_total;
    NEW.snapshot_expense_total := v_expense_total;
    NEW.snapshot_expected_balance := v_expected_balance;
    NEW.snapshot_cash_total := v_cash_total;
    NEW.snapshot_pix_total := v_pix_total;
    NEW.snapshot_debit_total := v_debit_total;
    NEW.snapshot_credit_total := v_credit_total;
    NEW.snapshot_bank_transfer_total := v_bank_transfer_total;
    NEW.snapshot_fiado_payment_total := v_fiado_payment_total;
    NEW.snapshot_movement_count := v_movement_count;
    NEW.snapshot_sale_count := v_sale_count;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_cash_transfer_snapshot_fields ON public.cash_session_transfers;
CREATE TRIGGER set_cash_transfer_snapshot_fields
BEFORE INSERT OR UPDATE ON public.cash_session_transfers
FOR EACH ROW
EXECUTE FUNCTION public.set_cash_transfer_snapshot_fields();

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
    
    INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
    SELECT p.id, 'cash_transfer'::notification_type,
      'Transferência de caixa solicitada',
      from_name || ' solicitou transferência de caixa para ' || to_name || '. Motivo: ' || NEW.transfer_reason,
      'cash_transfer', NEW.id
    FROM profiles p WHERE p.role = 'admin'::app_role AND p.is_active = true;
    
    INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
    VALUES (NEW.to_user_id, 'cash_transfer'::notification_type,
      'Solicitação de transferência de caixa',
      from_name || ' quer transferir o caixa para você. Motivo: ' || NEW.transfer_reason,
      'cash_transfer', NEW.id);
    
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
      session_snapshot := jsonb_build_object(
        'initial_balance', NEW.snapshot_initial_balance,
        'sales_total', NEW.snapshot_sales_total,
        'income_total', NEW.snapshot_income_total,
        'expense_total', NEW.snapshot_expense_total,
        'expected_balance', NEW.snapshot_expected_balance,
        'cash_total', NEW.snapshot_cash_total,
        'pix_total', NEW.snapshot_pix_total,
        'debit_total', NEW.snapshot_debit_total,
        'credit_total', NEW.snapshot_credit_total,
        'bank_transfer_total', NEW.snapshot_bank_transfer_total,
        'fiado_payment_total', NEW.snapshot_fiado_payment_total,
        'movement_count', NEW.snapshot_movement_count,
        'sale_count', NEW.snapshot_sale_count,
        'requested_by', NEW.requested_by,
        'accepted_by', NEW.accepted_by,
        'session_id', NEW.session_id
      );
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
    
    IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
      UPDATE cash_closings
      SET current_responsible_id = NEW.to_user_id,
          transfer_count = transfer_count + 1,
          last_transfer_id = NEW.id,
          sales_total = COALESCE(NEW.snapshot_sales_total, sales_total),
          income_total = COALESCE(NEW.snapshot_income_total, income_total),
          expense_total = COALESCE(NEW.snapshot_expense_total, expense_total),
          expected_balance = COALESCE(NEW.snapshot_expected_balance, expected_balance)
      WHERE id = NEW.cash_closing_id;

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

      INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, new_data, severity, session_id, action_summary, reason, requires_admin_review, target_user_id, target_role, status)
      VALUES ('cash_transfer_snapshot_created', 'cash_session_transfers', NEW.id, COALESCE(NEW.accepted_by, auth.uid()),
        (SELECT role::text FROM profiles WHERE id = COALESCE(NEW.accepted_by, auth.uid())),
        NEW.business_date, 'SNAPSHOT_CREATED', session_snapshot,
        'high', NEW.cash_closing_id,
        'Snapshot operacional salvo na aceitação da transferência',
        NEW.transfer_reason, true, NEW.to_user_id,
        (SELECT role::text FROM profiles WHERE id = NEW.to_user_id),
        'completed');
      
      INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
      SELECT p.id, 'cash_transfer'::notification_type,
        'Transferência de caixa aceita',
        to_name || ' aceitou a transferência de caixa de ' || from_name || '.',
        'cash_transfer', NEW.id
      FROM profiles p WHERE p.role = 'admin'::app_role AND p.is_active = true;
      
      INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
      VALUES (NEW.from_user_id, 'cash_transfer'::notification_type,
        'Transferência aceita',
        to_name || ' aceitou a transferência do caixa.',
        'cash_transfer', NEW.id);
    END IF;
    
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