
-- Trigger to block cash_entries INSERT if user is not the current session responsible
CREATE OR REPLACE FUNCTION public.validate_cash_entry_responsible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  session_responsible_id uuid;
  session_id uuid;
BEGIN
  -- Only enforce for today's entries
  IF NEW.business_date != CURRENT_DATE THEN
    RETURN NEW;
  END IF;

  -- Skip validation for entries created by triggers (source_type set means auto-generated)
  IF NEW.source_type IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Check if there's an open session today
  SELECT cc.current_responsible_id, cc.id
  INTO session_responsible_id, session_id
  FROM public.cash_closings cc
  WHERE cc.business_date = CURRENT_DATE
    AND cc.status = 'open'
    AND cc.is_latest_version = true
  LIMIT 1;

  -- If no open session, allow (the entry will be created without a session context)
  IF session_responsible_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if the user is the current responsible OR has operational override
  IF NEW.created_by = session_responsible_id THEN
    RETURN NEW;
  END IF;

  -- Check if user has operational override (primary admin)
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.created_by AND has_operational_override = true
  ) THEN
    RETURN NEW;
  END IF;

  -- Block the insert and log
  INSERT INTO public.security_audit_logs (
    event_type, entity_type, user_id, action, severity,
    business_date, target_user_id, session_id, notes
  ) VALUES (
    'cash_movement_blocked_wrong_user', 'cash_entries', NEW.created_by,
    'INSERT_BLOCKED', 'medium', NEW.business_date, session_responsible_id, session_id,
    'Tentativa de inserir movimento bloqueada. Usuário não é o responsável atual da sessão.'
  );

  RAISE EXCEPTION 'Operação bloqueada: somente o responsável atual do caixa pode registrar movimentos.';
END;
$$;

CREATE TRIGGER trg_validate_cash_entry_responsible
  BEFORE INSERT ON public.cash_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_cash_entry_responsible();
