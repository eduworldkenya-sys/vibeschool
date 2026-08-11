-- READ-SCHEME-001A: harden grants on the scheme-resource RPCs shipped in
-- 20260801120505_read010_step2_scheme_resource_rpcs.sql.
-- Restored from the production Supabase migration ledger version 20260801122742.

revoke execute on function public.list_scheme_lesson_resources(uuid) from public;
revoke execute on function public.list_scheme_lesson_resources(uuid) from anon;
grant execute on function public.list_scheme_lesson_resources(uuid) to authenticated;
grant execute on function public.list_scheme_lesson_resources(uuid) to service_role;

revoke execute on function public.upsert_scheme_lesson_resource(uuid, uuid, uuid, text, integer, integer, integer, jsonb) from public;
revoke execute on function public.upsert_scheme_lesson_resource(uuid, uuid, uuid, text, integer, integer, integer, jsonb) from anon;
grant execute on function public.upsert_scheme_lesson_resource(uuid, uuid, uuid, text, integer, integer, integer, jsonb) to authenticated;
grant execute on function public.upsert_scheme_lesson_resource(uuid, uuid, uuid, text, integer, integer, integer, jsonb) to service_role;

revoke execute on function public.remove_scheme_lesson_resource(uuid) from public;
revoke execute on function public.remove_scheme_lesson_resource(uuid) from anon;
grant execute on function public.remove_scheme_lesson_resource(uuid) to authenticated;
grant execute on function public.remove_scheme_lesson_resource(uuid) to service_role;

revoke execute on function public.recommend_textbook_chapters_for_scheme_lesson(uuid, integer) from public;
revoke execute on function public.recommend_textbook_chapters_for_scheme_lesson(uuid, integer) from anon;
grant execute on function public.recommend_textbook_chapters_for_scheme_lesson(uuid, integer) to authenticated;
grant execute on function public.recommend_textbook_chapters_for_scheme_lesson(uuid, integer) to service_role;

revoke execute on function public.assign_scheme_resource_to_class(uuid, uuid, timestamptz) from public;
revoke execute on function public.assign_scheme_resource_to_class(uuid, uuid, timestamptz) from anon;
grant execute on function public.assign_scheme_resource_to_class(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.assign_scheme_resource_to_class(uuid, uuid, timestamptz) to service_role;
