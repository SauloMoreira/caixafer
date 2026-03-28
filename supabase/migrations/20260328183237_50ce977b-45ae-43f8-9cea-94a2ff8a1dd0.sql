
-- Allow cash_coordinator to insert products
CREATE POLICY "Cash coordinators can insert products"
ON public.products FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'cash_coordinator'::app_role));

-- Allow cash_coordinator to update products
CREATE POLICY "Cash coordinators can update products"
ON public.products FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'cash_coordinator'::app_role));

-- Allow cash_coordinator to insert categories
CREATE POLICY "Cash coordinators can insert categories"
ON public.categories FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'cash_coordinator'::app_role));

-- Allow cash_coordinator to update categories
CREATE POLICY "Cash coordinators can update categories"
ON public.categories FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'cash_coordinator'::app_role));

-- Allow cash_coordinator full access to stock_movements
CREATE POLICY "Cash coordinators can manage stock_movements"
ON public.stock_movements FOR ALL TO authenticated
USING (has_role(auth.uid(), 'cash_coordinator'::app_role));
