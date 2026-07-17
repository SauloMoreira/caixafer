-- Passo 1: função central de "data de hoje no horário de Brasília"
CREATE OR REPLACE FUNCTION public.business_today()
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date;
$$;

-- Passo 2: sales
DROP POLICY IF EXISTS "Cashiers can update own sales today" ON public.sales;
CREATE POLICY "Cashiers can update own sales today" ON public.sales
  FOR UPDATE TO authenticated
  USING ((auth.uid() = created_by) AND (business_date = public.business_today()));

DROP POLICY IF EXISTS "Cashiers can delete own sales today" ON public.sales;
CREATE POLICY "Cashiers can delete own sales today" ON public.sales
  FOR DELETE TO authenticated
  USING ((auth.uid() = created_by) AND (business_date = public.business_today()));

-- Passo 3: cash_entries
DROP POLICY IF EXISTS "Cashiers can update own entries today" ON public.cash_entries;
CREATE POLICY "Cashiers can update own entries today" ON public.cash_entries
  FOR UPDATE TO authenticated
  USING ((auth.uid() = created_by) AND (business_date = public.business_today()));

DROP POLICY IF EXISTS "Cashiers can delete own entries today" ON public.cash_entries;
CREATE POLICY "Cashiers can delete own entries today" ON public.cash_entries
  FOR DELETE TO authenticated
  USING ((auth.uid() = created_by) AND (business_date = public.business_today()));

-- Passo 4: cash_closings
DROP POLICY IF EXISTS "Cashiers can update own closings today or close pending" ON public.cash_closings;
CREATE POLICY "Cashiers can update own closings today or close pending"
ON public.cash_closings FOR UPDATE TO public
USING (
  (auth.uid() = user_id) AND (
    business_date = public.business_today()
    OR status = 'open'::closing_status
  )
);

DROP POLICY IF EXISTS "Transferred cashier can update closings today or close pending" ON public.cash_closings;
CREATE POLICY "Transferred cashier can update closings today or close pending"
ON public.cash_closings FOR UPDATE TO authenticated
USING (
  (current_responsible_id = auth.uid()) AND (auth.uid() <> user_id) AND (
    business_date = public.business_today()
    OR status = 'open'::closing_status
  )
);

-- Passo 5: get_open_cash_session_today
CREATE OR REPLACE FUNCTION public.get_open_cash_session_today()
RETURNS TABLE(
  closing_id uuid, business_date date, user_id uuid,
  current_responsible_id uuid, responsible_name text, status text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT cc.id, cc.business_date, cc.user_id, cc.current_responsible_id,
         p.full_name, cc.status::text
  FROM public.cash_closings cc
  JOIN public.profiles p ON p.id = cc.current_responsible_id
  WHERE cc.business_date = public.business_today()
    AND cc.status = 'open'
    AND cc.is_latest_version = true
  LIMIT 1;
$$;

-- Passo 6: funções de gatilho
CREATE OR REPLACE FUNCTION public.validate_cash_entry_responsible()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  session_responsible_id uuid;
  session_id uuid;
BEGIN
  IF NEW.business_date != public.business_today() THEN
    RETURN NEW;
  END IF;
  IF NEW.source_type IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT cc.current_responsible_id, cc.id
  INTO session_responsible_id, session_id
  FROM public.cash_closings cc
  WHERE cc.business_date = public.business_today()
    AND cc.status = 'open'
    AND cc.is_latest_version = true
  LIMIT 1;
  IF session_responsible_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.created_by = session_responsible_id THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.created_by AND has_operational_override = true) THEN
    RETURN NEW;
  END IF;
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

CREATE OR REPLACE FUNCTION public.validate_sale_responsible()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  session_responsible_id uuid;
  session_id uuid;
BEGIN
  IF NEW.business_date != public.business_today() THEN
    RETURN NEW;
  END IF;
  SELECT cc.current_responsible_id, cc.id
  INTO session_responsible_id, session_id
  FROM public.cash_closings cc
  WHERE cc.business_date = public.business_today()
    AND cc.status = 'open'
    AND cc.is_latest_version = true
  LIMIT 1;
  IF session_responsible_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.created_by = session_responsible_id THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.created_by AND has_operational_override = true) THEN
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

CREATE OR REPLACE FUNCTION public.validate_fiado_charge_responsible()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  session_responsible_id uuid;
  session_id uuid;
BEGIN
  IF NEW.business_date != public.business_today() THEN
    RETURN NEW;
  END IF;
  SELECT cc.current_responsible_id, cc.id
  INTO session_responsible_id, session_id
  FROM public.cash_closings cc
  WHERE cc.business_date = public.business_today()
    AND cc.status = 'open'
    AND cc.is_latest_version = true
  LIMIT 1;
  IF session_responsible_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.created_by = session_responsible_id THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.created_by AND has_operational_override = true) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.security_audit_logs (
    event_type, entity_type, user_id, action, severity,
    business_date, target_user_id, session_id, notes
  ) VALUES (
    'fiado_charge_blocked_wrong_user', 'spr_fiado_charges', NEW.created_by,
    'INSERT_BLOCKED', 'medium', NEW.business_date, session_responsible_id, session_id,
    'Tentativa de registrar fiado bloqueada. Usuário não é o responsável atual da sessão.'
  );
  RAISE EXCEPTION 'Operação bloqueada: somente o responsável atual do caixa pode registrar fiado.';
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_fiado_payment_responsible()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  session_responsible_id uuid;
  session_id uuid;
BEGIN
  IF NEW.payment_date != public.business_today() THEN
    RETURN NEW;
  END IF;
  SELECT cc.current_responsible_id, cc.id
  INTO session_responsible_id, session_id
  FROM public.cash_closings cc
  WHERE cc.business_date = public.business_today()
    AND cc.status = 'open'
    AND cc.is_latest_version = true
  LIMIT 1;
  IF session_responsible_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.created_by = session_responsible_id THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.created_by AND has_operational_override = true) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.security_audit_logs (
    event_type, entity_type, user_id, action, severity,
    business_date, target_user_id, session_id, notes
  ) VALUES (
    'fiado_payment_blocked_wrong_user', 'spr_fiado_payments', NEW.created_by,
    'INSERT_BLOCKED', 'medium', NEW.payment_date, session_responsible_id, session_id,
    'Tentativa de pagamento SPR bloqueada. Usuário não é o responsável atual da sessão.'
  );
  RAISE EXCEPTION 'Operação bloqueada: somente o responsável atual do caixa pode registrar pagamentos SPR.';
END;
$$;