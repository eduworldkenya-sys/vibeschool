-- VibeSchool Pathways P0.6 — relationship-authorized support projection.
-- Parents/teachers may understand a learner's saved direction but cannot read raw
-- Quick Check answers or mutate/adopt the learner-owned Pathway Passport.

create or replace function public.pathways_get_supported_learner_passport(p_student_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  caller uuid := auth.uid();
  caller_role text;
  learner public.students%rowtype;
  allowed boolean := false;
  payload jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if p_student_id is null then raise exception 'student_required'; end if;

  select role into caller_role from public.profiles where id = caller;
  select * into learner from public.students where id = p_student_id and deleted_at is null;
  if not found then raise exception 'learner_not_found'; end if;

  if caller_role = 'parent' then
    select exists(
      select 1 from public.parent_student_links psl
      where psl.parent_id = caller and psl.student_id = learner.id
    ) into allowed;
  elsif caller_role = 'teacher' then
    select exists(
      select 1 from public.teacher_classes tc
      where tc.teacher_id = caller
        and tc.class_id = learner.class_id
        and coalesce(tc.is_active,true)
    ) into allowed;
  elsif caller_role = 'student' and learner.profile_id = caller then
    allowed := true;
  end if;

  if not allowed then raise exception 'pathway_support_access_denied'; end if;

  select jsonb_build_object(
    'student_id', pp.student_id,
    'pathway_id', p.id,
    'pathway_slug', p.slug,
    'pathway_name', p.name,
    'summary', p.plain_language_summary,
    'evidence_type', pp.evidence_type,
    'rule_version', pp.rule_version,
    'adopted_at', pp.adopted_at,
    'reviewed_at', pp.reviewed_at,
    'updated_at', pp.updated_at,
    'support_notice', 'Learner-owned VibeSchool guidance. This is not an official placement decision and this support view cannot change it.'
  ) into payload
  from public.student_pathway_passports pp
  join public.pathways p on p.id = pp.adopted_pathway_id
  where pp.student_id = learner.id;

  return coalesce(payload, 'null'::jsonb);
end;
$function$;

revoke all on function public.pathways_get_supported_learner_passport(uuid) from public, anon;
grant execute on function public.pathways_get_supported_learner_passport(uuid) to authenticated;

comment on function public.pathways_get_supported_learner_passport(uuid) is
'Read-only Pathways support projection. Requires learner self, parent_student_links, or active teacher_classes authority. Deliberately excludes raw learner answers/evidence snapshot and exposes no mutation capability.';
