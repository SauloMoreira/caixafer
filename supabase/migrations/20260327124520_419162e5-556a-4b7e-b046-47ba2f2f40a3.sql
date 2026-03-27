
-- Add avatar_url to spr_volunteers
ALTER TABLE public.spr_volunteers
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Storage policy for volunteer avatars (reuse avatars bucket, subfolder volunteers/)
CREATE POLICY "Authenticated can upload volunteer avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'volunteers');

CREATE POLICY "Authenticated can update volunteer avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'volunteers');

CREATE POLICY "Authenticated can delete volunteer avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'volunteers');
