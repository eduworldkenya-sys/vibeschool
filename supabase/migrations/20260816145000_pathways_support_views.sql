-- Relationship-scoped Pathways support reads.
-- Parents may see only linked learners. Teachers may see only learners in a
-- class assigned to them. Neither support role may mutate the learner Passport.

begin;

create or replace function public.parent_get_linked_pathway_passports()
returns table(
  student_id uuid,
  student_name text,
  pathway_slug text,
  pathway_name text,
  evidence_type text,
  adopted_at timestamptz,
  reviewed_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    s.id,
    coalesce(p.full_name, 'Learner')::text,
    pw.slug,
    pw.name,
    pp.evidence_type,
    pp.adopted_at,
    pp.reviewed_at
  from public.parent_student_links l
  join public.students s on s.id = l.student_id and s.deleted_at is null
  left join public.profiles p on p.id = s.profile_id
  left join public.student_pathway_passports pp on pp.student_id = s.id
  left join public.pathways pw on pw.id = pp.adopted_pathway_id and pw.status = 'published'
  where l.parent_id = auth.uid()
  order by coalesce(p.full_name, 'Learner'), s.id;
$function$;
revoke all on function public.parent_get_linked_pathway_passports() from public, anon;
grant execute on function public.parent_get_linked_pathway_passports() to authenticated;

create or replace function public.teacher_get_assigned_pathway_passports()
returns table(
  student_id uuid,
  student_name text,
  class_id uuid,
  pathway_slug text,
  pathway_name text,
  evidence_type text,
  adopted_at timestamptz,
  reviewed_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select distinct
    s.id,
    coalesce(p.full_name, 'Learner')::text,
    s.class_id,
    pw.slug,
    pw.name,
    pp.evidence_type,
    pp.adopted_at,
    pp.reviewed_at
  from public.teacher_classes tc
  join public.students s on s.class_id = tc.class_id and s.deleted_at is null
  left join public.profiles p on p.id = s.profile_id
  left join public.student_pathway_passports pp on pp.student_id = s.id
  left join public.pathways pw on pw.id = pp.adopted_pathway_id and pw.status = 'published'
  where tc.teacher_id = auth.uid()
  order by coalesce(p.full_name, 'Learner'), s.id;
$function$;
revoke all on function public.teacher_get_assigned_pathway_passports() from public, anon;
grant execute on function public.teacher_get_assigned_pathway_passports() to authenticated;

commit;
