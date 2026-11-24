BEGIN;
-- Private reusable preparation files; no live classroom membership grants access.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('vibe-live-studio-private','vibe-live-studio-private',false,8388608,ARRAY['application/pdf','image/jpeg','image/png','image/webp']::text[]);

-- authorization-test: storage.objects; scripts/test-live-class-assets.mjs exercises owner and student/outsider isolation.
CREATE POLICY live_studio_owner_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (
 bucket_id='vibe-live-studio-private' AND split_part(name,'/',1)=(select auth.uid())::text
 AND name ~ '^[0-9a-f-]{36}/[0-9a-f]{64}\.(pdf|jpg|png|webp)$'
 AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(select auth.uid()) AND p.role::text='teacher'
   AND p.account_status::text='active' AND NOT coalesce(p.is_anonymized,false))
);
CREATE POLICY live_studio_owner_read ON storage.objects FOR SELECT TO authenticated USING (
 bucket_id='vibe-live-studio-private' AND split_part(name,'/',1)=(select auth.uid())::text
 AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(select auth.uid()) AND p.role::text='teacher'
   AND p.account_status::text='active' AND NOT coalesce(p.is_anonymized,false))
);
CREATE POLICY live_studio_owner_delete ON storage.objects FOR DELETE TO authenticated USING (
 bucket_id='vibe-live-studio-private' AND split_part(name,'/',1)=(select auth.uid())::text
 AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(select auth.uid()) AND p.role::text='teacher'
   AND p.account_status::text='active' AND NOT coalesce(p.is_anonymized,false))
);
COMMIT;
