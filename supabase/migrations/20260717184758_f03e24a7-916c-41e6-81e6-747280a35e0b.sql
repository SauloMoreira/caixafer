
-- ============================================================
-- Finding 1: cash_coordinator explicit scoped SELECT on financial tables
-- ============================================================
DROP POLICY IF EXISTS "Cash coordinators can view cash entries in their company" ON public.cash_entries;
CREATE POLICY "Cash coordinators can view cash entries in their company"
ON public.cash_entries FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'cash_coordinator'::app_role)
  AND public.user_belongs_to_company(auth.uid(), company_id)
);

DROP POLICY IF EXISTS "Cash coordinators can view sales in their company" ON public.sales;
CREATE POLICY "Cash coordinators can view sales in their company"
ON public.sales FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'cash_coordinator'::app_role)
  AND public.user_belongs_to_company(auth.uid(), company_id)
);

DROP POLICY IF EXISTS "Cash coordinators can view cash closings in their company" ON public.cash_closings;
CREATE POLICY "Cash coordinators can view cash closings in their company"
ON public.cash_closings FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'cash_coordinator'::app_role)
  AND public.user_belongs_to_company(auth.uid(), company_id)
);

-- ============================================================
-- Finding 2: Admin profile view scoped to same company membership
-- ============================================================
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view profiles in their company"
ON public.profiles FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.company_memberships cm_admin
    JOIN public.company_memberships cm_target
      ON cm_target.company_id = cm_admin.company_id
    WHERE cm_admin.user_id = auth.uid()
      AND cm_admin.is_active = true
      AND cm_target.user_id = profiles.id
      AND cm_target.is_active = true
  )
);

-- ============================================================
-- Finding 3: SPR operators can update items of their own charges
-- ============================================================
DROP POLICY IF EXISTS "Operators can update items of their own fiado charges" ON public.spr_fiado_charge_items;
CREATE POLICY "Operators can update items of their own fiado charges"
ON public.spr_fiado_charge_items FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.spr_fiado_charges c
    WHERE c.id = spr_fiado_charge_items.charge_id
      AND c.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.spr_fiado_charges c
    WHERE c.id = spr_fiado_charge_items.charge_id
      AND c.created_by = auth.uid()
  )
);
