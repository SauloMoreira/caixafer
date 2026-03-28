
-- 1. Create categories table
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies
CREATE POLICY "Authenticated can view active categories"
  ON public.categories FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert categories"
  ON public.categories FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update categories"
  ON public.categories FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete categories"
  ON public.categories FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Add category_id to products (nullable for now)
ALTER TABLE public.products ADD COLUMN category_id uuid REFERENCES public.categories(id);

-- 5. Migrate existing categories (normalize duplicates)
INSERT INTO public.categories (name, sort_order)
VALUES
  ('Bebidas', 1),
  ('Doces', 2),
  ('Salgados', 3),
  ('Refeições', 4),
  ('Refrigerante', 5),
  ('Outros', 6),
  ('Geral', 7)
ON CONFLICT (name) DO NOTHING;

-- 6. Link products to categories (handle variants)
UPDATE public.products SET category_id = c.id
FROM public.categories c
WHERE LOWER(TRIM(products.category)) = LOWER(c.name);

-- Handle singular->plural mappings
UPDATE public.products SET category_id = c.id
FROM public.categories c
WHERE products.category_id IS NULL
  AND c.name = 'Bebidas' AND LOWER(TRIM(products.category)) = 'bebida';

UPDATE public.products SET category_id = c.id
FROM public.categories c
WHERE products.category_id IS NULL
  AND c.name = 'Doces' AND LOWER(TRIM(products.category)) = 'doce';

UPDATE public.products SET category_id = c.id
FROM public.categories c
WHERE products.category_id IS NULL
  AND c.name = 'Salgados' AND LOWER(TRIM(products.category)) = 'salgado';

-- Any remaining unlinked products -> 'Geral'
UPDATE public.products SET category_id = c.id
FROM public.categories c
WHERE products.category_id IS NULL AND c.name = 'Geral';

-- 7. Also normalize the text column to match
UPDATE public.products SET category = cat.name
FROM public.categories cat
WHERE products.category_id = cat.id AND products.category != cat.name;
