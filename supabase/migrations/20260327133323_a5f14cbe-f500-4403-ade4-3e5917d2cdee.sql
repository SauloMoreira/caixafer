
-- Allow admins to upload avatars for any user
CREATE POLICY "Admins can upload any avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update avatars for any user
CREATE POLICY "Admins can update any avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND has_role(auth.uid(), 'admin'::app_role));
