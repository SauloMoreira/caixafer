
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_count integer;
BEGIN
  SELECT COUNT(*) INTO admin_count
  FROM public.profiles
  WHERE role = 'admin'::app_role AND approval_status = 'approved' AND is_active = true;

  INSERT INTO public.profiles (id, full_name, email, role, approval_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    CASE WHEN admin_count = 0 THEN 'admin'::app_role ELSE 'cashier'::app_role END,
    CASE WHEN admin_count = 0 THEN 'approved' ELSE 'pending_approval' END
  );
  RETURN NEW;
END;
$$;
