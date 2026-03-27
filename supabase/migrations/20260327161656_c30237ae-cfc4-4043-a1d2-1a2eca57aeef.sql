
-- Table for daily operation insights per category
CREATE TABLE public.daily_operation_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_date date NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  category text NOT NULL,
  suggested_quantity integer DEFAULT 0,
  exposed_quantity integer DEFAULT 0,
  sold_quantity integer DEFAULT 0,
  leftover_quantity integer DEFAULT 0,
  had_shortage boolean NOT NULL DEFAULT false,
  had_restock boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_date, user_id, category)
);

-- Enable RLS
ALTER TABLE public.daily_operation_insights ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can do all on operation insights"
ON public.daily_operation_insights FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Cashier can insert own
CREATE POLICY "Cashiers can insert own operation insights"
ON public.daily_operation_insights FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Cashier can view own
CREATE POLICY "Cashiers can view own operation insights"
ON public.daily_operation_insights FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Cashier can update own today only
CREATE POLICY "Cashiers can update own operation insights today"
ON public.daily_operation_insights FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND business_date = CURRENT_DATE);
