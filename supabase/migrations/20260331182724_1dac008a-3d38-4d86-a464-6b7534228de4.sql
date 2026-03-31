DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'movement_category_type'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.movement_category_type AS ENUM ('income', 'expense');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.movement_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  movement_type public.movement_category_type NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.movement_categories ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_movement_categories_type_active_sort
  ON public.movement_categories (movement_type, is_active, sort_order, name);

CREATE UNIQUE INDEX IF NOT EXISTS uq_movement_categories_type_name
  ON public.movement_categories (movement_type, lower(name));

CREATE OR REPLACE FUNCTION public.set_movement_categories_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_movement_categories_updated_at ON public.movement_categories;
CREATE TRIGGER trg_movement_categories_updated_at
BEFORE UPDATE ON public.movement_categories
FOR EACH ROW
EXECUTE FUNCTION public.set_movement_categories_updated_at();

DROP POLICY IF EXISTS "Admins can view all movement categories" ON public.movement_categories;
CREATE POLICY "Admins can view all movement categories"
ON public.movement_categories
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert movement categories" ON public.movement_categories;
CREATE POLICY "Admins can insert movement categories"
ON public.movement_categories
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update movement categories" ON public.movement_categories;
CREATE POLICY "Admins can update movement categories"
ON public.movement_categories
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete movement categories" ON public.movement_categories;
CREATE POLICY "Admins can delete movement categories"
ON public.movement_categories
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can view active movement categories" ON public.movement_categories;
CREATE POLICY "Authenticated users can view active movement categories"
ON public.movement_categories
FOR SELECT
TO authenticated
USING (is_active = true);

INSERT INTO public.movement_categories (name, movement_type, description, is_active, sort_order)
VALUES
  ('Reposição', 'income', 'Entrada manual por reposição', true, 1),
  ('Ajuste', 'income', 'Entrada manual por ajuste', true, 2),
  ('Outro', 'income', 'Outras entradas manuais', true, 3),
  ('Reposição', 'expense', 'Saída manual por reposição', true, 1),
  ('Ajuste', 'expense', 'Saída manual por ajuste', true, 2),
  ('Compra', 'expense', 'Saída manual por compra', true, 3),
  ('Despesa extra', 'expense', 'Saída manual extraordinária', true, 4),
  ('Outro', 'expense', 'Outras saídas manuais', true, 5)
ON CONFLICT (movement_type, lower(name)) DO UPDATE
SET
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();