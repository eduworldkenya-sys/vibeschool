-- Content Studio public API: remove HQ naming from caller-facing review RPCs.
-- Compatibility only: delegates to existing independently authorized checks.
-- No change to reviewer identity, evidence, fingerprint, release gates or publication authority.
begin;

create or replace function public.content_review_teacher_guide(
 p_derivative_id uuid, p_approve boolean, p_note text default null)
returns jsonb language sql security invoker set search_path=public,pg_temp
as $$
 select public.hq_review_teacher_guide(p_derivative_id,p_approve,p_note);
$$;

create or replace function public.content_review_generated_assessment(
 p_assessment_id uuid, p_approve boolean, p_note text default null)
returns jsonb language sql security invoker set search_path=public,pg_temp
as $$
 select public.hq_review_generated_assessment(p_assessment_id,p_approve,p_note);
$$;

create or replace function public.content_review_publication_release(
 p_publication_id uuid, p_approve boolean, p_notes text default '')
returns jsonb language sql security invoker set search_path=public,pg_temp
as $$
 select public.hq_review_publication_release(p_publication_id,p_approve,p_notes);
$$;

revoke all on function public.content_review_teacher_guide(uuid,boolean,text) from public,anon,service_role;
revoke all on function public.content_review_generated_assessment(uuid,boolean,text) from public,anon,service_role;
revoke all on function public.content_review_publication_release(uuid,boolean,text) from public,anon,service_role;
grant execute on function public.content_review_teacher_guide(uuid,boolean,text) to authenticated;
grant execute on function public.content_review_generated_assessment(uuid,boolean,text) to authenticated;
grant execute on function public.content_review_publication_release(uuid,boolean,text) to authenticated;

comment on function public.content_review_publication_release(uuid,boolean,text)
 is 'Content Studio-facing independent review API. Delegates to canonical checks; no HQ UI or HQ membership is needed for commissioned reviewers.';
commit;
