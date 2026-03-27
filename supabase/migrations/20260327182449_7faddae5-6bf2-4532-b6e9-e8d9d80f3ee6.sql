
CREATE OR REPLACE FUNCTION public.get_eligible_transfer_cashiers(_exclude_user_id uuid)
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name
  FROM public.profiles p
  WHERE p.role IN ('cashier', 'admin')
    AND p.is_active = true
    AND p.approval_status = 'approved'
    AND p.id != _exclude_user_id
  ORDER BY p.full_name;
$$;
