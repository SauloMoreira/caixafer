CREATE OR REPLACE FUNCTION public.admin_can_view_profile_in_company(_target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm_admin
    JOIN public.company_memberships cm_target
      ON cm_target.company_id = cm_admin.company_id
    WHERE cm_admin.user_id = auth.uid()
      AND cm_admin.is_active = true
      AND cm_target.user_id = _target_user_id
      AND cm_target.is_active = true
  );
$$;

DROP POLICY IF EXISTS "Admins can view profiles in their company" ON public.profiles;

CREATE POLICY "Admins can view profiles in their company"
ON public.profiles FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.admin_can_view_profile_in_company(profiles.id)
);