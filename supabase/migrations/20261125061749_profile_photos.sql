-- Each account owns one private portrait. Members of an active shared workspace can read it.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-photos', 'profile-photos', false, 262144, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "profile_photos_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (
    name = (SELECT auth.uid())::text || '/avatar.jpg'
    OR EXISTS (
      SELECT 1
      FROM public.org_members AS member
      JOIN public.tenant_organizations AS workspace ON workspace.id = member.org_id
      WHERE member.org_id IN (SELECT public.get_my_org_ids())
        AND workspace.deleted_at IS NULL
        AND objects.name = member.user_id::text || '/avatar.jpg'
    )
  )
);

CREATE POLICY "profile_photos_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-photos' AND name = (SELECT auth.uid())::text || '/avatar.jpg');

CREATE POLICY "profile_photos_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profile-photos' AND name = (SELECT auth.uid())::text || '/avatar.jpg')
WITH CHECK (bucket_id = 'profile-photos' AND name = (SELECT auth.uid())::text || '/avatar.jpg');

CREATE POLICY "profile_photos_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'profile-photos' AND name = (SELECT auth.uid())::text || '/avatar.jpg');
