CREATE UNIQUE INDEX idx_one_open_cash_per_day
ON public.cash_closings (business_date)
WHERE (status = 'open');