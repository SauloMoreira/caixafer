
-- 1. Add stock columns to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS quantity_in_stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minimum_stock_level integer NULL;

-- 2. Create stock_movements table
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type text NOT NULL,
  quantity integer NOT NULL,
  previous_stock integer NOT NULL,
  new_stock integer NOT NULL,
  reference_type text NULL,
  reference_id uuid NULL,
  notes text NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. Enable RLS on stock_movements
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for stock_movements
CREATE POLICY "Admins can do all on stock_movements"
  ON public.stock_movements FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can insert stock_movements"
  ON public.stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated can view stock_movements"
  ON public.stock_movements FOR SELECT
  TO authenticated
  USING (true);

-- 5. Add stock_alert notification type
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'stock_alert';

-- 6. Trigger function: decrease stock on sale_items insert
CREATE OR REPLACE FUNCTION public.decrease_stock_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only for product items (not manual)
  IF NEW.product_id IS NOT NULL THEN
    -- Decrease stock
    UPDATE public.products
    SET quantity_in_stock = quantity_in_stock - NEW.quantity
    WHERE id = NEW.product_id;

    -- Record stock movement
    INSERT INTO public.stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reference_type, reference_id, created_by)
    SELECT
      NEW.product_id,
      'sale',
      NEW.quantity,
      p.quantity_in_stock + NEW.quantity,
      p.quantity_in_stock,
      'sale_item',
      NEW.id,
      (SELECT created_by FROM public.sales WHERE id = NEW.sale_id)
    FROM public.products p WHERE p.id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_decrease_stock_on_sale
  AFTER INSERT ON public.sale_items
  FOR EACH ROW
  EXECUTE FUNCTION public.decrease_stock_on_sale();

-- 7. Trigger function: decrease stock on fiado charge items insert
CREATE OR REPLACE FUNCTION public.decrease_stock_on_fiado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products
    SET quantity_in_stock = quantity_in_stock - NEW.quantity
    WHERE id = NEW.product_id;

    INSERT INTO public.stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reference_type, reference_id, created_by)
    SELECT
      NEW.product_id,
      'fiado',
      NEW.quantity,
      p.quantity_in_stock + NEW.quantity,
      p.quantity_in_stock,
      'fiado_charge_item',
      NEW.id,
      (SELECT created_by FROM public.spr_fiado_charges WHERE id = NEW.charge_id)
    FROM public.products p WHERE p.id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_decrease_stock_on_fiado
  AFTER INSERT ON public.spr_fiado_charge_items
  FOR EACH ROW
  EXECUTE FUNCTION public.decrease_stock_on_fiado();

-- 8. Function to check and notify low/zero stock
CREATE OR REPLACE FUNCTION public.check_stock_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  prod RECORD;
  admin_rec RECORD;
  alert_title text;
  alert_message text;
BEGIN
  -- Get product info after stock change
  SELECT * INTO prod FROM public.products WHERE id = NEW.product_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Check zero stock
  IF prod.quantity_in_stock <= 0 THEN
    alert_title := 'Estoque zerado: ' || prod.name;
    alert_message := prod.name || ' está sem estoque. Reposição necessária.';
  -- Check low stock (only if minimum is configured)
  ELSIF prod.minimum_stock_level IS NOT NULL AND prod.quantity_in_stock <= prod.minimum_stock_level THEN
    alert_title := 'Estoque baixo: ' || prod.name;
    alert_message := prod.name || ' está com apenas ' || prod.quantity_in_stock || ' unidade(s) em estoque (mínimo: ' || prod.minimum_stock_level || ').';
  ELSE
    RETURN NEW;
  END IF;

  -- Notify all admins (deduplicate: skip if unread notification exists)
  FOR admin_rec IN
    SELECT id FROM public.profiles WHERE role = 'admin'::app_role AND is_active = true
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = admin_rec.id
        AND type = 'stock_alert'
        AND reference_id = prod.id
        AND is_read = false
    ) THEN
      INSERT INTO public.notifications (user_id, type, title, message, reference_type, reference_id)
      VALUES (admin_rec.id, 'stock_alert', alert_title, alert_message, 'product', prod.id);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_stock_alerts
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.check_stock_alerts();
