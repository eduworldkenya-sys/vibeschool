BEGIN;
-- Private reusable preparation files; no live classroom membership grants access.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('vibe-live-studio-private','vibe-live-studio-private',false,8388608,ARRAY['application/pdf','image/jpeg','image/png','image/webp']::text[]);

-- The existing private classroom schema owns the authorization predicate.
-- Storage policy expressions must not require callers to read profiles, even
-- when PostgreSQL evaluates them for a different bucket.
CREATE FUNCTION vibe_live.studio_file_owner() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $owner$
 SELECT EXISTS(SELECT 1 FROM public.profiles p
 WHERE p.id=(SELECT auth.uid()) AND p.role::text='teacher'
 AND p.account_status::text='active' AND NOT coalesce(p.is_anonymized,false))
$owner$;
REVOKE ALL ON FUNCTION vibe_live.studio_file_owner() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION vibe_live.studio_file_owner() TO authenticated;

-- authorization-test: storage.objects; scripts/test-live-class-assets.mjs exercises owner and student/outsider isolation.
CREATE POLICY live_studio_owner_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (
 bucket_id='vibe-live-studio-private' AND split_part(name,'/',1)=(select auth.uid())::text
 AND name ~ '^[0-9a-f-]{36}/[0-9a-f]{64}\.(pdf|jpg|png|webp)$'
 AND (SELECT vibe_live.studio_file_owner())
);
CREATE POLICY live_studio_owner_read ON storage.objects FOR SELECT TO authenticated USING (
 bucket_id='vibe-live-studio-private' AND split_part(name,'/',1)=(select auth.uid())::text
 AND (SELECT vibe_live.studio_file_owner())
);
CREATE POLICY live_studio_owner_delete ON storage.objects FOR DELETE TO authenticated USING (
 bucket_id='vibe-live-studio-private' AND split_part(name,'/',1)=(select auth.uid())::text
 AND (SELECT vibe_live.studio_file_owner())
);
COMMIT;
