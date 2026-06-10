ALTER TABLE public.spr_fiado_payments
  ADD COLUMN IF NOT EXISTS payment_group_id uuid;

UPDATE public.spr_fiado_payments
  SET payment_group_id = id
  WHERE payment_group_id IS NULL;

ALTER TABLE public.spr_fiado_payments
  ALTER COLUMN payment_group_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN payment_group_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_spr_fiado_payments_group
  ON public.spr_fiado_payments(payment_group_id);