CREATE OR REPLACE FUNCTION public.can_access_spr_operation()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.cash_closings cc
      WHERE cc.business_date = CURRENT_DATE
        AND cc.status = 'open'
        AND cc.is_latest_version = true
        AND (
          cc.current_responsible_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.has_operational_override = true
          )
        )
    );
$$;

DROP POLICY IF EXISTS "Authenticated can view volunteers" ON public.spr_volunteers;
DROP POLICY IF EXISTS "Cashiers can insert volunteers" ON public.spr_volunteers;
DROP POLICY IF EXISTS "Cashiers can update volunteers" ON public.spr_volunteers;

CREATE POLICY "SPR operators can view volunteers"
ON public.spr_volunteers
FOR SELECT
TO authenticated
USING (
  public.can_access_spr_operation()
);

CREATE POLICY "Volunteers can view own volunteer record"
ON public.spr_volunteers
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT p.volunteer_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'volunteer'::app_role
      AND p.volunteer_id IS NOT NULL
  )
);

CREATE POLICY "SPR operators can insert volunteers"
ON public.spr_volunteers
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_access_spr_operation()
);

CREATE POLICY "SPR operators can update volunteers"
ON public.spr_volunteers
FOR UPDATE
TO authenticated
USING (
  public.can_access_spr_operation()
)
WITH CHECK (
  public.can_access_spr_operation()
);

DROP POLICY IF EXISTS "Cashiers can insert fiado charges" ON public.spr_fiado_charges;
DROP POLICY IF EXISTS "Cashiers can update own fiado charges today" ON public.spr_fiado_charges;
DROP POLICY IF EXISTS "Cashiers can view own fiado charges" ON public.spr_fiado_charges;

CREATE POLICY "SPR operators can view fiado charges"
ON public.spr_fiado_charges
FOR SELECT
TO authenticated
USING (
  public.can_access_spr_operation()
);

CREATE POLICY "SPR operators can insert fiado charges"
ON public.spr_fiado_charges
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND public.can_access_spr_operation()
);

CREATE POLICY "SPR operators can update own fiado charges today"
ON public.spr_fiado_charges
FOR UPDATE
TO authenticated
USING (
  auth.uid() = created_by
  AND business_date = CURRENT_DATE
  AND public.can_access_spr_operation()
)
WITH CHECK (
  auth.uid() = created_by
  AND business_date = CURRENT_DATE
  AND public.can_access_spr_operation()
);

DROP POLICY IF EXISTS "Cashiers can insert fiado charge items" ON public.spr_fiado_charge_items;
DROP POLICY IF EXISTS "Cashiers can view own fiado charge items" ON public.spr_fiado_charge_items;

CREATE POLICY "SPR operators can view fiado charge items"
ON public.spr_fiado_charge_items
FOR SELECT
TO authenticated
USING (
  public.can_access_spr_operation()
);

CREATE POLICY "SPR operators can insert fiado charge items"
ON public.spr_fiado_charge_items
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_access_spr_operation()
  AND EXISTS (
    SELECT 1
    FROM public.spr_fiado_charges c
    WHERE c.id = spr_fiado_charge_items.charge_id
      AND c.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Cashiers can insert fiado payments" ON public.spr_fiado_payments;
DROP POLICY IF EXISTS "Cashiers can view own fiado payments" ON public.spr_fiado_payments;

CREATE POLICY "SPR operators can view fiado payments"
ON public.spr_fiado_payments
FOR SELECT
TO authenticated
USING (
  public.can_access_spr_operation()
);

CREATE POLICY "SPR operators can insert fiado payments"
ON public.spr_fiado_payments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND public.can_access_spr_operation()
);