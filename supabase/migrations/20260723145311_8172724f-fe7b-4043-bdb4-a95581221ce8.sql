ALTER TABLE public.sales ALTER COLUMN business_date SET DEFAULT public.business_today();
ALTER TABLE public.cash_entries ALTER COLUMN business_date SET DEFAULT public.business_today();
ALTER TABLE public.spr_fiado_charges ALTER COLUMN business_date SET DEFAULT public.business_today();
ALTER TABLE public.spr_fiado_payments ALTER COLUMN payment_date SET DEFAULT public.business_today();