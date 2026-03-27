
-- Add manual item support to sale_items
ALTER TABLE public.sale_items
  ALTER COLUMN product_id DROP NOT NULL,
  ADD COLUMN manual_item_name text,
  ADD COLUMN item_type text NOT NULL DEFAULT 'product',
  ADD COLUMN notes text;

-- Add manual item support to spr_fiado_charge_items
ALTER TABLE public.spr_fiado_charge_items
  ALTER COLUMN product_id DROP NOT NULL,
  ADD COLUMN manual_item_name text,
  ADD COLUMN item_type text NOT NULL DEFAULT 'product',
  ADD COLUMN notes text;
