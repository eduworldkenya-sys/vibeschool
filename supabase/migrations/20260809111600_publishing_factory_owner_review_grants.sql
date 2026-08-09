-- Preserve the production permission boundary for HQ publishing actions.
-- The UI calls these functions as an authenticated platform owner; each function
-- performs its own is_platform_owner() check. Anonymous callers remain revoked.

revoke all on function public.hq_review_teacher_guide(uuid,boolean,text) from public,anon;
revoke all on function public.hq_review_generated_assessment(uuid,boolean,text) from public,anon;
revoke all on function public.hq_review_chapter_revision(uuid,boolean,text) from public,anon;
revoke all on function public.hq_review_vibelab_spec(uuid,boolean,text) from public,anon;
revoke all on function public.hq_apply_approved_chapter_revision(uuid,text) from public,anon;

grant execute on function public.hq_review_teacher_guide(uuid,boolean,text) to authenticated,service_role;
grant execute on function public.hq_review_generated_assessment(uuid,boolean,text) to authenticated,service_role;
grant execute on function public.hq_review_chapter_revision(uuid,boolean,text) to authenticated,service_role;
grant execute on function public.hq_review_vibelab_spec(uuid,boolean,text) to authenticated,service_role;
grant execute on function public.hq_apply_approved_chapter_revision(uuid,text) to authenticated,service_role;
