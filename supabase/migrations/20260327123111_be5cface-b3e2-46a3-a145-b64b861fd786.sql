
-- Add new columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending_approval',
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: users can upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage policy: users can update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage policy: anyone can read avatars (public bucket)
CREATE POLICY "Public avatar access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Storage policy: users can delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Update handle_new_user to set email and approval_status
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_count integer;
BEGIN
  -- Check if there are any approved admins
  SELECT COUNT(*) INTO admin_count
  FROM public.profiles
  WHERE role = 'admin' AND approval_status = 'approved' AND is_active = true;

  INSERT INTO public.profiles (id, full_name, email, role, approval_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    CASE WHEN admin_count = 0 THEN 'admin' ELSE 'cashier' END,
    CASE WHEN admin_count = 0 THEN 'approved' ELSE 'pending_approval' END
  );
  RETURN NEW;
END;
$$;

-- Update RLS: profiles select - users can see own profile, admins can see all
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Update RLS: profiles update - users can update own non-role fields, admins can update all
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
