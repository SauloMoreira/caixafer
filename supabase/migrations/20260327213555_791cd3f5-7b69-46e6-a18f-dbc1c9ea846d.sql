ALTER TABLE public.daily_operation_insights
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_doi_product_id ON public.daily_operation_insights(product_id);
CREATE INDEX IF NOT EXISTS idx_doi_business_date_user ON public.daily_operation_insights(business_date, user_id);