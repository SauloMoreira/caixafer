
-- Trigger to block sales INSERT if user is not the current session responsible
CREATE OR REPLACE FUNCTION public.validate_sale_responsible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  session_responsible_id uuid;
  session_id uuid;
BEGIN
  IF NEW.business_date != CURRENT_DATE THEN
    RETURN NEW;
  END IF;

  SELECT cc.current_responsible_id, cc.id
  INTO session_responsible_id, session_id
  FROM public.cash_closings cc
  WHERE cc.business_date = CURRENT_DATE
    AND cc.status = 'open'
    AND cc.is_latest_version = true
  LIMIT 1;

  IF session_responsible_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.created_by = session_responsible_id THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.created_by AND has_operational_override = true
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.security_audit_logs (
    event_type, entity_type, user_id, action, severity,
    business_date, target_user_id, session_id, notes
  ) VALUES (
    'sale_blocked_wrong_user', 'sales', NEW.created_by,
    'INSERT_BLOCKED', 'medium', NEW.business_date, session_responsible_id, session_id,
    'Tentativa de venda bloqueada. Usuário não é o responsável atual da sessão.'
  );

  RAISE EXCEPTION 'Operação bloqueada: somente o responsável atual do caixa pode registrar vendas.';
END;
$$;

CREATE TRIGGER trg_validate_sale_responsible
  BEFORE INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_sale_responsible();
