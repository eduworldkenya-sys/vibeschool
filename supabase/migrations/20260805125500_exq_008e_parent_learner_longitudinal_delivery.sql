-- EXQ-008E — Parent/learner published-report delivery and longitudinal record authority.
-- Production-equivalent repository migration.

-- Restore the canonical production function bodies before applying their execution grants.
create or replace function public.exq_get_published_report_card(p_report_card_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  caller uuid:=auth.uid();
  rc public.report_cards%rowtype;
  student_profile uuid;
  parent_allowed boolean:=false;
  learner_allowed boolean:=false;
  staff_allowed boolean:=false;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into rc from public.report_cards where id=p_report_card_id;
  if not found then raise exception 'report_card_not_found'; end if;
  if rc.status not in ('published','locked') then raise exception 'report_card_not_published'; end if;

  select s.profile_id into student_profile from public.students s where s.id=rc.student_id;
  learner_allowed:=student_profile is not null and student_profile=caller;
  select exists(
    select 1 from public.parent_student_links psl
    where psl.parent_id=caller and psl.student_id=rc.student_id
      and (psl.school_id is null or psl.school_id=rc.school_id)
      and coalesce(psl.access_level,'full')<>'none'
  ) into parent_allowed;
  staff_allowed:=rc.teacher_id=caller or exists(
    select 1 from public.school_members sm
    where sm.school_id=rc.school_id and sm.profile_id=caller and sm.role in ('owner','admin')
  );
  if not (learner_allowed or parent_allowed or staff_allowed) then raise exception 'report_card_not_authorized'; end if;

  return jsonb_build_object(
    'ok',true,
    'report_card_id',rc.id,
    'student_id',rc.student_id,
    'class_id',rc.class_id,
    'term_id',rc.term_id,
    'academic_year',rc.academic_year,
    'status',rc.status,
    'revision',rc.revision,
    'published_at',rc.published_at,
    'locked_at',rc.locked_at,
    'snapshot',rc.generated_snapshot
  );
end;
$function$;

create or replace function public.exq_list_my_published_report_cards()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  caller uuid:=auth.uid();
  result jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'report_card_id',rc.id,
    'student_id',rc.student_id,
    'student_name',s.name,
    'class_id',rc.class_id,
    'class_name',c.name,
    'term_id',rc.term_id,
    'term_name',t.name,
    'academic_year',rc.academic_year,
    'status',rc.status,
    'revision',rc.revision,
    'published_at',rc.published_at,
    'locked_at',rc.locked_at,
    'summary',coalesce(rc.generated_snapshot->'evidence'->'summary',rc.generated_snapshot->'summary','{}'::jsonb)
  ) order by rc.academic_year desc,t.term desc,rc.revision desc),'[]'::jsonb)
  into result
  from public.report_cards rc
  join public.students s on s.id=rc.student_id
  join public.classes c on c.id=rc.class_id
  join public.academic_terms t on t.id=rc.term_id
  where rc.status in ('published','locked')
    and (
      s.profile_id=caller
      or exists (
        select 1 from public.parent_student_links psl
        where psl.parent_id=caller and psl.student_id=rc.student_id
          and (psl.school_id is null or psl.school_id=rc.school_id)
          and coalesce(psl.access_level,'full')<>'none'
      )
    );
  return jsonb_build_object('ok',true,'reports',result);
end;
$function$;

create or replace function public.exq_get_longitudinal_report_record(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  caller uuid:=auth.uid();
  student_profile uuid;
  allowed boolean:=false;
  reports jsonb;
  trends jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select profile_id into student_profile from public.students where id=p_student_id;
  allowed:=student_profile=caller
    or exists(select 1 from public.parent_student_links psl where psl.parent_id=caller and psl.student_id=p_student_id and coalesce(psl.access_level,'full')<>'none')
    or exists(
      select 1 from public.report_cards rc
      where rc.student_id=p_student_id and (
        rc.teacher_id=caller or exists(select 1 from public.school_members sm where sm.school_id=rc.school_id and sm.profile_id=caller and sm.role in ('owner','admin'))
      )
    );
  if not allowed then raise exception 'longitudinal_record_not_authorized'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'report_card_id',rc.id,
    'academic_year',rc.academic_year,
    'term_id',rc.term_id,
    'term_name',t.name,
    'term_number',t.term,
    'class_id',rc.class_id,
    'class_name',c.name,
    'status',rc.status,
    'revision',rc.revision,
    'published_at',rc.published_at,
    'assessment_average',coalesce((rc.generated_snapshot->'evidence'->'summary'->>'overall_assessment_average')::numeric,(rc.generated_snapshot->'summary'->>'overall_assessment_average')::numeric),
    'mastery_average',coalesce((rc.generated_snapshot->'evidence'->'summary'->>'overall_mastery_average')::numeric,(rc.generated_snapshot->'summary'->>'overall_mastery_average')::numeric),
    'attendance_rate',coalesce((rc.generated_snapshot->'evidence'->'attendance'->>'attendance_rate')::numeric,(rc.generated_snapshot->'attendance'->>'attendance_rate')::numeric)
  ) order by rc.academic_year,t.term,rc.revision),'[]'::jsonb)
  into reports
  from public.report_cards rc
  join public.academic_terms t on t.id=rc.term_id
  join public.classes c on c.id=rc.class_id
  where rc.student_id=p_student_id and rc.status in ('published','locked');

  select jsonb_build_object(
    'report_count',count(*),
    'first_assessment_average',(array_agg(coalesce((rc.generated_snapshot->'evidence'->'summary'->>'overall_assessment_average')::numeric,(rc.generated_snapshot->'summary'->>'overall_assessment_average')::numeric) order by rc.academic_year,t.term))[1],
    'latest_assessment_average',(array_agg(coalesce((rc.generated_snapshot->'evidence'->'summary'->>'overall_assessment_average')::numeric,(rc.generated_snapshot->'summary'->>'overall_assessment_average')::numeric) order by rc.academic_year desc,t.term desc))[1],
    'first_mastery_average',(array_agg(coalesce((rc.generated_snapshot->'evidence'->'summary'->>'overall_mastery_average')::numeric,(rc.generated_snapshot->'summary'->>'overall_mastery_average')::numeric) order by rc.academic_year,t.term))[1],
    'latest_mastery_average',(array_agg(coalesce((rc.generated_snapshot->'evidence'->'summary'->>'overall_mastery_average')::numeric,(rc.generated_snapshot->'summary'->>'overall_mastery_average')::numeric) order by rc.academic_year desc,t.term desc))[1]
  ) into trends
  from public.report_cards rc join public.academic_terms t on t.id=rc.term_id
  where rc.student_id=p_student_id and rc.status in ('published','locked');

  return jsonb_build_object('ok',true,'student_id',p_student_id,'reports',reports,'trends',coalesce(trends,'{}'::jsonb));
end;
$function$;

revoke all on function public.exq_get_published_report_card(uuid) from public,anon;
revoke all on function public.exq_list_my_published_report_cards() from public,anon;
revoke all on function public.exq_get_longitudinal_report_record(uuid) from public,anon;
grant execute on function public.exq_get_published_report_card(uuid) to authenticated,service_role;
grant execute on function public.exq_list_my_published_report_cards() to authenticated,service_role;
grant execute on function public.exq_get_longitudinal_report_record(uuid) to authenticated,service_role;

drop policy if exists report_cards_published_parent_learner_read on public.report_cards;
create policy report_cards_published_parent_learner_read
on public.report_cards for select to authenticated
using (
  status in ('published','locked') and (
    exists(select 1 from public.students s where s.id=report_cards.student_id and s.profile_id=(select auth.uid()))
    or exists(
      select 1 from public.parent_student_links psl
      where psl.student_id=report_cards.student_id
        and psl.parent_id=(select auth.uid())
        and (psl.school_id is null or psl.school_id=report_cards.school_id)
        and coalesce(psl.access_level,'full')<>'none'
    )
  )
);

drop policy if exists report_card_subjects_published_parent_learner_read on public.report_card_subjects;
create policy report_card_subjects_published_parent_learner_read
on public.report_card_subjects for select to authenticated
using (
  exists(
    select 1 from public.report_cards rc
    where rc.id=report_card_subjects.report_card_id
      and rc.status in ('published','locked')
      and (
        exists(select 1 from public.students s where s.id=rc.student_id and s.profile_id=(select auth.uid()))
        or exists(
          select 1 from public.parent_student_links psl
          where psl.student_id=rc.student_id
            and psl.parent_id=(select auth.uid())
            and (psl.school_id is null or psl.school_id=rc.school_id)
            and coalesce(psl.access_level,'full')<>'none'
        )
      )
  )
);
