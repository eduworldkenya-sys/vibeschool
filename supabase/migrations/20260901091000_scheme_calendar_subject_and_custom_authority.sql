begin;

-- SOW-02/SOW-03: weekly allocation must bind to the canonical global subject.
alter table public.subject_weekly_allocations
  add column if not exists global_subject_id uuid references public.subjects(id) on delete restrict;

with unique_global_subject as (
  select lower(btrim(name)) as normalized_name, min(id) as id
  from public.subjects
  where school_id is null
  group by lower(btrim(name))
  having count(*) = 1
)
update public.subject_weekly_allocations swa
set global_subject_id = ugs.id
from unique_global_subject ugs
where swa.global_subject_id is null
  and lower(btrim(swa.subject_label)) = ugs.normalized_name;

create index if not exists subject_weekly_allocations_grade_global_subject_idx
  on public.subject_weekly_allocations(grade,global_subject_id);

-- Resolve the exact academic term by ownership + date. Mutable lifecycle status
-- is deliberately not part of the authority contract.
create or replace function public.resolve_academic_term_for_date(
  p_school_id uuid,
  p_date date
)
returns table(
  term_id uuid,
  academic_year integer,
  term_number integer,
  start_date date,
  end_date date
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then raise exception 'SCHEME_AUTH_REQUIRED'; end if;
  if not (
    public.is_school_admin(p_school_id)
    or exists(select 1 from public.school_members sm where sm.school_id=p_school_id and sm.profile_id=v_uid)
    or exists(select 1 from public.teacher_profiles tp where tp.school_id=p_school_id and tp.profile_id=v_uid)
    or exists(select 1 from public.profiles p where p.id=v_uid and p.school_id=p_school_id)
  ) then raise exception 'SCHEME_SCHOOL_ACCESS_REQUIRED'; end if;

  select count(*) into v_count
  from public.academic_terms at
  where at.school_id=p_school_id
    and p_date between at.start_date and at.end_date;

  if v_count=0 then raise exception 'SCHEME_TERM_NOT_FOUND_FOR_DATE:%',p_date; end if;
  if v_count>1 then raise exception 'SCHEME_OVERLAPPING_TERMS_FOR_DATE:%',p_date; end if;

  return query
  select at.id,at.academic_year,at.term,at.start_date,at.end_date
  from public.academic_terms at
  where at.school_id=p_school_id
    and p_date between at.start_date and at.end_date;
end;
$function$;

-- Resolve an instructional week from the configured term_weeks calendar. A
-- school override wins over the national row for the same term/week.
create or replace function public.resolve_instructional_week_for_date(
  p_school_id uuid,
  p_date date
)
returns table(
  term_id uuid,
  academic_year integer,
  term_number integer,
  week_number integer,
  week_start date,
  week_end date,
  week_type text,
  week_label text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_term_id uuid;
  v_year integer;
  v_term integer;
  v_count integer;
begin
  if v_uid is null then raise exception 'SCHEME_AUTH_REQUIRED'; end if;
  if not (
    public.is_school_admin(p_school_id)
    or exists(select 1 from public.school_members sm where sm.school_id=p_school_id and sm.profile_id=v_uid)
    or exists(select 1 from public.teacher_profiles tp where tp.school_id=p_school_id and tp.profile_id=v_uid)
    or exists(select 1 from public.profiles p where p.id=v_uid and p.school_id=p_school_id)
  ) then raise exception 'SCHEME_SCHOOL_ACCESS_REQUIRED'; end if;

  select r.term_id,r.academic_year,r.term_number
  into v_term_id,v_year,v_term
  from public.resolve_academic_term_for_date(p_school_id,p_date) r;

  with candidates as (
    select distinct on (tw.term_id,tw.week_number)
      tw.term_id,tw.week_number,tw.start_date,tw.end_date,tw.week_type,tw.label
    from public.term_weeks tw
    where tw.term_id=v_term_id
      and (tw.school_id=p_school_id or tw.school_id is null)
      and p_date between tw.start_date and tw.end_date
    order by tw.term_id,tw.week_number,(tw.school_id=p_school_id) desc
  )
  select count(*) into v_count from candidates;

  if v_count=0 then raise exception 'SCHEME_INSTRUCTIONAL_WEEK_NOT_CONFIGURED:%',p_date; end if;
  if v_count>1 then raise exception 'SCHEME_OVERLAPPING_INSTRUCTIONAL_WEEKS:%',p_date; end if;

  return query
  with candidates as (
    select distinct on (tw.term_id,tw.week_number)
      tw.term_id,tw.week_number,tw.start_date,tw.end_date,tw.week_type,tw.label
    from public.term_weeks tw
    where tw.term_id=v_term_id
      and (tw.school_id=p_school_id or tw.school_id is null)
      and p_date between tw.start_date and tw.end_date
    order by tw.term_id,tw.week_number,(tw.school_id=p_school_id) desc
  )
  select c.term_id,v_year,v_term,c.week_number,c.start_date,c.end_date,c.week_type,c.label
  from candidates c;
end;
$function$;

create or replace function public.resolve_subject_weekly_allocation(
  p_class_id uuid,
  p_subject_id uuid
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_school_id uuid;
  v_grade text;
  v_global_subject_id uuid;
  v_count integer;
  v_lessons integer;
begin
  if v_uid is null then raise exception 'SCHEME_AUTH_REQUIRED'; end if;
  select c.school_id,c.grade into v_school_id,v_grade from public.classes c where c.id=p_class_id;
  if v_school_id is null then raise exception 'SCHEME_CLASS_NOT_FOUND'; end if;
  if not exists(select 1 from public.teacher_classes tc where tc.teacher_id=v_uid and tc.school_id=v_school_id and tc.class_id=p_class_id and tc.subject_id=p_subject_id)
     and not public.is_school_admin(v_school_id)
  then raise exception 'SCHEME_ASSIGNMENT_REQUIRED'; end if;

  select case when s.school_id is null then s.id else s.global_subject_id end
  into v_global_subject_id
  from public.subjects s
  where s.id=p_subject_id and (s.school_id=v_school_id or s.school_id is null);
  if v_global_subject_id is null then raise exception 'SCHEME_SUBJECT_TAXONOMY_REQUIRED'; end if;

  select count(*),min(swa.lessons_per_week)
  into v_count,v_lessons
  from public.subject_weekly_allocations swa
  where swa.grade=v_grade and swa.global_subject_id=v_global_subject_id;

  if v_count=0 then return null; end if;
  if v_count>1 then raise exception 'SCHEME_ALLOCATION_AMBIGUOUS'; end if;
  return v_lessons;
end;
$function$;

-- SOW-06/SOW-08: custom lessons also allocate sequence under the same advisory
-- lock. Optional resource linking happens in the same transaction.
create or replace function public.commit_custom_scheme_item(
  p_class_id uuid,
  p_subject_id uuid,
  p_academic_term_id uuid,
  p_week integer,
  p_topic text,
  p_strand text default null,
  p_resource_id uuid default null,
  p_resource_role text default null
)
returns public.scheme_of_work
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_class public.classes%rowtype;
  v_subject public.subjects%rowtype;
  v_term public.academic_terms%rowtype;
  v_next_sequence integer;
  v_inserted public.scheme_of_work%rowtype;
  v_resource public.learning_resources%rowtype;
  v_role text;
begin
  if v_uid is null then raise exception 'SCHEME_AUTH_REQUIRED'; end if;
  if nullif(btrim(p_topic),'') is null then raise exception 'SCHEME_TOPIC_REQUIRED'; end if;
  if p_week is null or p_week<1 then raise exception 'SCHEME_WEEK_REQUIRED'; end if;

  select * into v_class from public.classes c where c.id=p_class_id;
  if v_class.id is null then raise exception 'SCHEME_CLASS_NOT_FOUND'; end if;
  select * into v_subject from public.subjects s where s.id=p_subject_id;
  if v_subject.id is null then raise exception 'SCHEME_SUBJECT_NOT_FOUND'; end if;
  select * into v_term from public.academic_terms at where at.id=p_academic_term_id and at.school_id=v_class.school_id;
  if v_term.id is null then raise exception 'SCHEME_TERM_NOT_IN_SCHOOL'; end if;

  if not exists(select 1 from public.teacher_classes tc where tc.teacher_id=v_uid and tc.school_id=v_class.school_id and tc.class_id=p_class_id and tc.subject_id=p_subject_id)
     and not public.is_school_admin(v_class.school_id)
  then raise exception 'SCHEME_ASSIGNMENT_REQUIRED'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_class_id::text||':'||p_subject_id::text||':'||p_academic_term_id::text,0));
  select coalesce(max(s.sequence_number),0)+1 into v_next_sequence
  from public.scheme_of_work s
  where s.class_id=p_class_id and s.subject_id=p_subject_id and s.academic_term_id=p_academic_term_id;

  insert into public.scheme_of_work(
    school_id,teacher_id,class_id,subject_id,curriculum_id,curriculum_content_id,
    academic_term_id,curriculum_type,grade,subject,term,week,strand,sub_strand,
    topic,status,source,content_status,sequence_number
  ) values (
    v_class.school_id,v_uid,p_class_id,p_subject_id,null,null,p_academic_term_id,
    'custom',v_class.name,v_subject.name,v_term.term,p_week,nullif(btrim(p_strand),''),null,
    btrim(p_topic),'planned','custom','missing',v_next_sequence
  ) returning * into v_inserted;

  if p_resource_id is not null then
    if not exists(
      select 1 from public.class_resource_library crl
      where crl.teacher_id=v_uid and crl.school_id=v_class.school_id
        and crl.class_id=p_class_id and (crl.subject_id=p_subject_id or crl.subject_id is null)
        and crl.resource_id=p_resource_id and crl.status='active'
    ) then raise exception 'SCHEME_RESOURCE_NOT_IN_CLASS_LIBRARY'; end if;

    select * into v_resource from public.learning_resources lr
    where lr.id=p_resource_id and lr.status='active';
    if v_resource.id is null or v_resource.publication_id is null or v_resource.chapter_id is null then
      raise exception 'SCHEME_CHAPTER_RESOURCE_REQUIRED';
    end if;

    v_role:=coalesce(nullif(btrim(p_resource_role),''),'supplementary');
    if v_role not in ('primary','supplementary','teacher_reference','learner_reading','exercise','remedial','enrichment','project','assessment_source','before_class','in_class','after_class','homework') then
      raise exception 'SCHEME_RESOURCE_ROLE_INVALID';
    end if;

    insert into public.scheme_lesson_resource_links(
      scheme_lesson_id,publication_id,chapter_id,resource_id,resource_role,sequence,
      exercise_refs,created_by
    ) values (
      v_inserted.id,v_resource.publication_id,v_resource.chapter_id,v_resource.id,
      v_role,1,'[]'::jsonb,v_uid
    );
  end if;

  return v_inserted;
end;
$function$;

-- The legacy auto-generator can create partial curriculum rows. Remove it from
-- the authenticated normal path; the hardened commit RPC is the authority.
revoke execute on function public.generate_scheme_from_curriculum(uuid,uuid,uuid,boolean) from authenticated;
revoke execute on function public.ensure_scheme_from_curriculum(uuid,uuid,uuid) from authenticated;

grant execute on function public.resolve_academic_term_for_date(uuid,date) to authenticated;
grant execute on function public.resolve_instructional_week_for_date(uuid,date) to authenticated;
grant execute on function public.resolve_subject_weekly_allocation(uuid,uuid) to authenticated;
grant execute on function public.commit_custom_scheme_item(uuid,uuid,uuid,integer,text,text,uuid,text) to authenticated;

commit;
