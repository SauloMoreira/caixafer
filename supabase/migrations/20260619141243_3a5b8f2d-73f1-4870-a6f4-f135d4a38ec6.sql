
-- Função: retorna todas as vendas de uma data para usuários autorizados
CREATE OR REPLACE FUNCTION public.get_cash_book_sales(_date date)
RETURNS TABLE (
  id uuid,
  total_amount numeric,
  payment_method text,
  notes text,
  is_deleted boolean,
  status text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.total_amount, s.payment_method::text, s.notes,
         s.is_deleted, s.status::text, s.created_at
  FROM public.sales s
  WHERE s.business_date = _date
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.approval_status = 'approved'
        AND p.role IN ('admin','cash_coordinator','cashier')
    )
  ORDER BY s.created_at ASC;
$$;

-- Função: retorna todos os lançamentos (cash_entries) de uma data para usuários autorizados
CREATE OR REPLACE FUNCTION public.get_cash_book_entries(_date date)
RETURNS TABLE (
  id uuid,
  entry_type text,
  category text,
  description text,
  amount numeric,
  payment_method text,
  document_type text,
  document_reference text,
  source_type text,
  is_deleted boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.entry_type::text, e.category, e.description, e.amount,
         e.payment_method::text, e.document_type, e.document_reference,
         e.source_type, e.is_deleted, e.created_at
  FROM public.cash_entries e
  WHERE e.business_date = _date
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.approval_status = 'approved'
        AND p.role IN ('admin','cash_coordinator','cashier')
    )
  ORDER BY e.created_at ASC;
$$;

-- Função: retorna a lista de fechamentos (datas + saldo de abertura) para numeração de páginas
CREATE OR REPLACE FUNCTION public.get_cash_book_closings()
RETURNS TABLE (
  business_date date,
  opening_balance numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cc.business_date, cc.opening_balance
  FROM public.cash_closings cc
  WHERE EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.approval_status = 'approved'
        AND p.role IN ('admin','cash_coordinator','cashier')
    )
  ORDER BY cc.business_date ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_cash_book_sales(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cash_book_entries(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cash_book_closings() TO authenticated;
