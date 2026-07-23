
-- 1) business_today: set fixed search_path
CREATE OR REPLACE FUNCTION public.business_today()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date;
$$;

-- 2) Overload can_access_spr_operation with company scoping
CREATE OR REPLACE FUNCTION public.can_access_spr_operation(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _company_id IS NOT NULL
    AND public.user_belongs_to_company(auth.uid(), _company_id)
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1
        FROM public.cash_closings cc
        WHERE cc.business_date = public.business_today()
          AND cc.status = 'open'
          AND cc.is_latest_version = true
          AND cc.company_id = _company_id
          AND (
            cc.current_responsible_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = auth.uid() AND p.has_operational_override = true
            )
          )
      )
    );
$$;

-- 3) Update SPR policies to use company-scoped variant

-- spr_volunteers
DROP POLICY IF EXISTS "SPR operators can view volunteers" ON public.spr_volunteers;
CREATE POLICY "SPR operators can view volunteers"
ON public.spr_volunteers FOR SELECT TO authenticated
USING (public.can_access_spr_operation(company_id));

DROP POLICY IF EXISTS "SPR operators can insert volunteers" ON public.spr_volunteers;
CREATE POLICY "SPR operators can insert volunteers"
ON public.spr_volunteers FOR INSERT TO authenticated
WITH CHECK (public.can_access_spr_operation(company_id));

DROP POLICY IF EXISTS "SPR operators can update volunteers" ON public.spr_volunteers;
CREATE POLICY "SPR operators can update volunteers"
ON public.spr_volunteers FOR UPDATE TO authenticated
USING (public.can_access_spr_operation(company_id))
WITH CHECK (public.can_access_spr_operation(company_id));

-- spr_fiado_charges
DROP POLICY IF EXISTS "SPR operators can view fiado charges" ON public.spr_fiado_charges;
CREATE POLICY "SPR operators can view fiado charges"
ON public.spr_fiado_charges FOR SELECT TO authenticated
USING (public.can_access_spr_operation(company_id));

DROP POLICY IF EXISTS "SPR operators can insert fiado charges" ON public.spr_fiado_charges;
CREATE POLICY "SPR operators can insert fiado charges"
ON public.spr_fiado_charges FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by AND public.can_access_spr_operation(company_id));

DROP POLICY IF EXISTS "SPR operators can update own fiado charges today" ON public.spr_fiado_charges;
CREATE POLICY "SPR operators can update own fiado charges today"
ON public.spr_fiado_charges FOR UPDATE TO authenticated
USING (auth.uid() = created_by AND business_date = public.business_today() AND public.can_access_spr_operation(company_id))
WITH CHECK (auth.uid() = created_by AND business_date = public.business_today() AND public.can_access_spr_operation(company_id));

-- spr_fiado_charge_items (no company_id — join via parent charge)
DROP POLICY IF EXISTS "SPR operators can view fiado charge items" ON public.spr_fiado_charge_items;
CREATE POLICY "SPR operators can view fiado charge items"
ON public.spr_fiado_charge_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.spr_fiado_charges c
    WHERE c.id = spr_fiado_charge_items.charge_id
      AND public.can_access_spr_operation(c.company_id)
  )
);

DROP POLICY IF EXISTS "SPR operators can insert fiado charge items" ON public.spr_fiado_charge_items;
CREATE POLICY "SPR operators can insert fiado charge items"
ON public.spr_fiado_charge_items FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.spr_fiado_charges c
    WHERE c.id = spr_fiado_charge_items.charge_id
      AND c.created_by = auth.uid()
      AND public.can_access_spr_operation(c.company_id)
  )
);

-- spr_fiado_payments
DROP POLICY IF EXISTS "SPR operators can view fiado payments" ON public.spr_fiado_payments;
CREATE POLICY "SPR operators can view fiado payments"
ON public.spr_fiado_payments FOR SELECT TO authenticated
USING (public.can_access_spr_operation(company_id));

DROP POLICY IF EXISTS "SPR operators can insert fiado payments" ON public.spr_fiado_payments;
CREATE POLICY "SPR operators can insert fiado payments"
ON public.spr_fiado_payments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by AND public.can_access_spr_operation(company_id));

-- 4) daily_operation_insights: add company scope for cash coordinators
DROP POLICY IF EXISTS "Cash coordinators can view operation insights" ON public.daily_operation_insights;
CREATE POLICY "Cash coordinators can view operation insights"
ON public.daily_operation_insights FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'cash_coordinator'::app_role)
  AND public.user_belongs_to_company(auth.uid(), company_id)
);

-- 5) cash_closings: restrict update policy to authenticated role
DROP POLICY IF EXISTS "Cashiers can update own closings today or close pending" ON public.cash_closings;
CREATE POLICY "Cashiers can update own closings today or close pending"
ON public.cash_closings FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND (business_date = public.business_today() OR status = 'open'::closing_status));
