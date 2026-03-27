
-- Tighten storage policies: users can only manage their own uploads
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
CREATE POLICY "Authenticated users can update own product images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
CREATE POLICY "Authenticated users can delete own product images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Admins can manage all product images
CREATE POLICY "Admins can manage all product images"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

-- Prevent non-admin users from updating sensitive profile fields
-- Drop the generic "Users can update own profile" and "Users can update own profile name" policies
-- and replace with a restricted one
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile name" ON public.profiles;

-- Users can update own profile (non-sensitive fields only)
-- The actual field restriction is handled by the app, but RLS ensures they can only update their own row
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  -- Prevent self-promotion: role and approval_status must stay the same
  AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  AND approval_status = (SELECT approval_status FROM public.profiles WHERE id = auth.uid())
);

-- Prevent delete on audit logs
CREATE POLICY "No one can delete audit logs"
ON public.security_audit_logs FOR DELETE TO authenticated
USING (false);

-- Prevent delete on incidents (only admin resolves, never deletes)
CREATE POLICY "No one can delete incidents"
ON public.security_incidents FOR DELETE TO authenticated
USING (false);
