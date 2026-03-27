
-- Add notification type for cash transfers
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'cash_transfer';

-- Create transfer status enum
CREATE TYPE public.transfer_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');

-- Create cash_session_transfers table
CREATE TABLE public.cash_session_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_closing_id uuid NOT NULL REFERENCES public.cash_closings(id) ON DELETE CASCADE,
  business_date date NOT NULL,
  from_user_id uuid NOT NULL REFERENCES public.profiles(id),
  to_user_id uuid NOT NULL REFERENCES public.profiles(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  transfer_reason text NOT NULL,
  status public.transfer_status NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT different_users CHECK (from_user_id != to_user_id)
);

-- Add current_responsible_id and transfer fields to cash_closings
ALTER TABLE public.cash_closings
  ADD COLUMN current_responsible_id uuid REFERENCES public.profiles(id),
  ADD COLUMN transfer_count integer NOT NULL DEFAULT 0,
  ADD COLUMN last_transfer_id uuid REFERENCES public.cash_session_transfers(id);

-- Set current_responsible_id = user_id for existing rows
UPDATE public.cash_closings SET current_responsible_id = user_id WHERE current_responsible_id IS NULL;

-- Make current_responsible_id NOT NULL after backfill
ALTER TABLE public.cash_closings ALTER COLUMN current_responsible_id SET NOT NULL;
ALTER TABLE public.cash_closings ALTER COLUMN current_responsible_id SET DEFAULT gen_random_uuid();

-- Enable RLS on cash_session_transfers
ALTER TABLE public.cash_session_transfers ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can do everything
CREATE POLICY "Admins can do all on transfers"
  ON public.cash_session_transfers FOR ALL
  TO public
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- RLS: Cashiers can view transfers they are involved in
CREATE POLICY "Users can view own transfers"
  ON public.cash_session_transfers FOR SELECT
  TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- RLS: Cashiers can insert transfers (as from_user)
CREATE POLICY "Cashiers can request transfers"
  ON public.cash_session_transfers FOR INSERT
  TO authenticated
  WITH CHECK (from_user_id = auth.uid());

-- RLS: Target cashier can accept/reject transfers
CREATE POLICY "Target can update transfer status"
  ON public.cash_session_transfers FOR UPDATE
  TO authenticated
  USING (to_user_id = auth.uid() AND status = 'pending'::transfer_status);

-- RLS: Requester can cancel pending transfers
CREATE POLICY "Requester can cancel transfers"
  ON public.cash_session_transfers FOR UPDATE
  TO authenticated
  USING (from_user_id = auth.uid() AND status = 'pending'::transfer_status);

-- Audit trigger for transfers
CREATE OR REPLACE FUNCTION public.audit_cash_transfers()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, new_data, severity)
    VALUES ('cash_transfer_requested', 'cash_session_transfers', NEW.id, NEW.from_user_id,
      (SELECT role::text FROM profiles WHERE id = NEW.from_user_id),
      NEW.business_date, 'INSERT', to_jsonb(NEW), 'medium');
    
    -- Notify all admins
    INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
    SELECT p.id, 'cash_transfer'::notification_type,
      'Transferência de caixa solicitada',
      (SELECT full_name FROM profiles WHERE id = NEW.from_user_id) || ' solicitou transferência de caixa para ' || (SELECT full_name FROM profiles WHERE id = NEW.to_user_id) || '. Motivo: ' || NEW.transfer_reason,
      'cash_transfer', NEW.id
    FROM profiles p WHERE p.role = 'admin'::app_role AND p.is_active = true;
    
    -- Notify target cashier
    INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
    VALUES (NEW.to_user_id, 'cash_transfer'::notification_type,
      'Solicitação de transferência de caixa',
      (SELECT full_name FROM profiles WHERE id = NEW.from_user_id) || ' quer transferir o caixa para você. Motivo: ' || NEW.transfer_reason,
      'cash_transfer', NEW.id);
    
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO security_audit_logs (event_type, entity_type, entity_id, user_id, user_role, business_date, action, old_data, new_data, severity)
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
      CASE WHEN NEW.status = 'accepted' THEN 'high' ELSE 'medium' END
    );
    
    -- On acceptance, update the cash_closings record
    IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
      UPDATE cash_closings
      SET current_responsible_id = NEW.to_user_id,
          transfer_count = transfer_count + 1,
          last_transfer_id = NEW.id
      WHERE id = NEW.cash_closing_id;
      
      -- Notify admins about acceptance
      INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
      SELECT p.id, 'cash_transfer'::notification_type,
        'Transferência de caixa aceita',
        (SELECT full_name FROM profiles WHERE id = NEW.to_user_id) || ' aceitou a transferência de caixa de ' || (SELECT full_name FROM profiles WHERE id = NEW.from_user_id) || '.',
        'cash_transfer', NEW.id
      FROM profiles p WHERE p.role = 'admin'::app_role AND p.is_active = true;
      
      -- Notify original cashier
      INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
      VALUES (NEW.from_user_id, 'cash_transfer'::notification_type,
        'Transferência aceita',
        (SELECT full_name FROM profiles WHERE id = NEW.to_user_id) || ' aceitou a transferência do caixa.',
        'cash_transfer', NEW.id);
    END IF;
    
    -- On rejection, notify requester
    IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
      INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
      VALUES (NEW.from_user_id, 'cash_transfer'::notification_type,
        'Transferência recusada',
        (SELECT full_name FROM profiles WHERE id = NEW.to_user_id) || ' recusou a transferência do caixa.',
        'cash_transfer', NEW.id);
    END IF;
    
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE TRIGGER audit_cash_transfers_trigger
  AFTER INSERT OR UPDATE ON public.cash_session_transfers
  FOR EACH ROW EXECUTE FUNCTION public.audit_cash_transfers();
