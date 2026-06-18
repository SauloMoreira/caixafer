-- Correção contábil do snapshot de transferência de caixa.
--
-- Antes: snapshot_expected_balance somava TODAS as formas de pagamento (PIX, cartão,
-- transferência) ao saldo esperado em dinheiro físico, inflando o valor esperado em caixa.
--
-- Depois: snapshot_expected_balance considera APENAS dinheiro físico.
--   esperado = saldo_inicial + vendas_dinheiro + entradas_dinheiro − saídas_dinheiro
--
-- IMPORTANTE: snapshots HISTÓRICOS (já gravados) permanecem inalterados.
-- Apenas snapshots criados a partir de agora usarão a fórmula correta.
-- As telas exibem o recálculo via camada cash-accounting.ts (frontend).

CREATE OR REPLACE FUNCTION public.set_cash_transfer_snapshot_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_income_cash_total numeric := 0;
  v_expense_cash_total numeric := 0;
  v_requires_snapshot boolean := false;
BEGIN
  NEW.updated_at := now();
  NEW.session_id := COALESCE(NEW.session_id, NEW.cash_closing_id);

  IF TG_OP = 'INSERT' THEN
    NEW.requested_by := COALESCE(NEW.requested_by, NEW.from_user_id, auth.uid());
    RETURN NEW;
  END IF;

  NEW.requested_by := COALESCE(NEW.requested_by, OLD.requested_by, NEW.from_user_id);

  v_requires_snapshot := NEW.status = 'accepted'
    AND (
      COALESCE(OLD.status, 'pending'::transfer_status) <> 'accepted'
      OR NEW.snapshot_initial_balance IS NULL
      OR NEW.snapshot_sales_total IS NULL
      OR NEW.snapshot_income_total IS NULL
      OR NEW.snapshot_expense_total IS NULL
      OR NEW.snapshot_expected_balance IS NULL
      OR NEW.snapshot_cash_total IS NULL
      OR NEW.snapshot_pix_total IS NULL
      OR NEW.snapshot_debit_total IS NULL
      OR NEW.snapshot_credit_total IS NULL
      OR NEW.snapshot_bank_transfer_total IS NULL
      OR NEW.snapshot_fiado_payment_total IS NULL
      OR NEW.snapshot_movement_count IS NULL
      OR NEW.snapshot_sale_count IS NULL
    );

  IF v_requires_snapshot THEN
    NEW.accepted_at := COALESCE(NEW.accepted_at, OLD.accepted_at, now());
    NEW.accepted_by := COALESCE(NEW.accepted_by, OLD.accepted_by, auth.uid(), NEW.to_user_id);

    SELECT COALESCE(cc.opening_balance, 0)
      INTO v_opening_balance
    FROM public.cash_closings cc
    WHERE cc.id = NEW.cash_closing_id
    LIMIT 1;

    -- Movimento financeiro (todas as formas) — usado em relatórios/UI
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

    -- Entradas/Saídas: totais GLOBAIS (todas formas) + totais SÓ DINHEIRO
    -- Lançamentos sem payment_method explícito são tratados como dinheiro (legado).
    SELECT
      COALESCE(SUM(CASE WHEN ce.entry_type = 'income' THEN ce.amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN ce.entry_type = 'expense' THEN ce.amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN ce.source_type = 'spr_fiado_payment' THEN ce.amount ELSE 0 END), 0),
      COUNT(*)::integer,
      COALESCE(SUM(CASE
        WHEN ce.entry_type = 'income'
         AND (ce.payment_method IS NULL OR ce.payment_method = 'dinheiro')
        THEN ce.amount ELSE 0 END), 0),
      COALESCE(SUM(CASE
        WHEN ce.entry_type = 'expense'
         AND (ce.payment_method IS NULL OR ce.payment_method = 'dinheiro')
        THEN ce.amount ELSE 0 END), 0)
    INTO
      v_income_total,
      v_expense_total,
      v_fiado_payment_total,
      v_movement_count,
      v_income_cash_total,
      v_expense_cash_total
    FROM public.cash_entries ce
    WHERE ce.business_date = NEW.business_date
      AND COALESCE(ce.is_deleted, false) = false;

    -- *** CORREÇÃO CONTÁBIL ***
    -- Saldo esperado considera APENAS dinheiro físico.
    -- PIX/cartão/transferência NÃO entram aqui.
    v_expected_balance := v_opening_balance
                        + v_cash_total
                        + v_income_cash_total
                        - v_expense_cash_total;

    NEW.snapshot_initial_balance := v_opening_balance;
    NEW.snapshot_sales_total := v_sales_total;       -- movimento total (todas formas)
    NEW.snapshot_income_total := v_income_total;     -- movimento total (todas formas)
    NEW.snapshot_expense_total := v_expense_total;   -- movimento total (todas formas)
    NEW.snapshot_expected_balance := v_expected_balance; -- AGORA é só dinheiro físico
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
$function$;