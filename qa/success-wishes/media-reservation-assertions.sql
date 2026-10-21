DO $media$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.success_wishes_media_uploads'::regclass AND relrowsecurity)
  THEN RAISE EXCEPTION 'media upload RLS disabled'; END IF;
 IF has_table_privilege('anon','public.success_wishes_media_uploads','SELECT')
   OR has_table_privilege('authenticated','public.success_wishes_media_uploads','SELECT')
   OR has_table_privilege('authenticated','public.success_wishes_media_uploads','INSERT')
   THEN RAISE EXCEPTION 'media reservation table is exposed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger
   WHERE tgname='success_wishes_media_reservation_guard' AND tgenabled='O')
  THEN RAISE EXCEPTION 'media reservation security guard missing'; END IF;
 IF has_function_privilege('anon','public.success_wishes_guard_media_reservation()','EXECUTE')
   OR has_function_privilege('authenticated','public.success_wishes_guard_media_reservation()','EXECUTE')
  THEN RAISE EXCEPTION 'media reservation guard exposed'; END IF;
 RAISE NOTICE 'Private media reservation gates PASS';
END $media$;
