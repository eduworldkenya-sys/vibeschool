begin;

-- Extend the one canonical teaching occurrence authority.  Existing scheduled
-- occurrence identities (slot + date) remain unchanged.
alter table public.teaching_occurrences
  alter column timetable_slot_id drop not null;
alter table public.teaching_occurrences
  add column if not exists unscheduled_plan_id uuid references public.lesson_plans(id) on delete restrict;
alter table public.teaching_occurrences
  add column if not exists completion_review jsonb;

alter table public.teaching_occurrences
  drop constraint if exists teaching_occurrences_one_source_check;
alter table public.teaching_occurrences
  add constraint teaching_occurrences_one_source_check
    check ((timetable_slot_id is null) = (unscheduled_plan_id is not null));
create unique index if not exists teaching_occurrences_unscheduled_plan_key
  on public.teaching_occurrences(unscheduled_plan_id)
  where unscheduled_plan_id is not null;

-- A dated teacher may teach several distinct Scheme lessons of one subject.
-- Preserve the old uniqueness rule for legacy unscheduled rows with no
-- prepared provenance; do not rewrite or delete history.
drop index if exists public.uq_lesson_plans_unscheduled_teacher_class_subject_date;
create unique index if not exists uq_lesson_plans_unscheduled_legacy_date
  on public.lesson_plans(teacher_id,class_id,subject_id,taught_date)
  where timetable_slot_id is null and prepared_draft_id is null;
create unique index if not exists uq_lesson_plans_unscheduled_draft_date
  on public.lesson_plans(prepared_draft_id,taught_date)
  where timetable_slot_id is null and prepared_draft_id is not null;

-- Preserve existing immutable provenance. Allow a verified, teacher-owned
-- draft to underpin a real unscheduled plan without inventing a timetable slot.
create or replace function public.guard_lesson_plan_prepared_draft()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if tg_op = 'UPDATE' and old.prepared_draft_id is distinct from new.prepared_draft_id then
    raise exception 'PREPARED_DRAFT_PROVENANCE_IMMUTABLE';
  end if;
  if new.prepared_draft_id is not null and not exists (
    select 1
    from public.lesson_plan_drafts d
    where d.id = new.prepared_draft_id
      and d.teacher_id = new.teacher_id
      and d.school_id = new.school_id
      and d.subject_id = new.subject_id
      and (d.class_id is null or d.class_id = new.class_id)
      and (
        (new.timetable_slot_id is null and d.class_id = new.class_id
          and d.status <> 'archived')
        or exists (
          select 1 from public.timetable_slots ts
          where ts.id = new.timetable_slot_id
            and ts.teacher_id = new.teacher_id
            and ts.school_id = new.school_id
            and ts.class_id = new.class_id
            and ts.subject_id = new.subject_id
        )
      )
  ) then
    raise exception 'PREPARED_DRAFT_PROVENANCE_MISMATCH' using errcode = '42501';
  end if;
  return new;
end;
$function$;

revoke all on function public.guard_lesson_plan_prepared_draft() from public, anon, authenticated;

-- Server-owned, idempotent start. Only today's verified Scheme preparation may
-- become a new unscheduled teaching occurrence. Reuse canonical lesson plan,
-- outcome binding, audit and observation triggers.
create or replace function public.start_unscheduled_teaching(p_draft_id uuid)
returns public.teaching_occurrences
language plpgsql security definer set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_date date := (now() at time zone 'Africa/Nairobi')::date;
  v_draft public.lesson_plan_drafts%rowtype;
  v_plan public.lesson_plans%rowtype;
  v_occ public.teaching_occurrences%rowtype;
  v_dow integer;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  if p_draft_id is null then raise exception 'DRAFT_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('unscheduled:' || p_draft_id::text || ':' || v_date::text, 0));

  select * into v_draft from public.lesson_plan_drafts
  where id=p_draft_id and teacher_id=v_uid for update;
  if not found or v_draft.status = 'archived' then
    raise exception 'DRAFT_NOT_AVAILABLE' using errcode='42501';
  end if;
  if v_draft.class_id is null or v_draft.scheme_id is null or
     not public.lesson_draft_authorized(v_draft.school_id,v_draft.class_id,v_draft.subject_id) then
    raise exception 'DRAFT_ASSIGNMENT_REQUIRED' using errcode='42501';
  end if;
  if v_draft.curriculum_outcome_id is null or not exists (
    select 1 from public.scheme_of_work sow
    join public.curriculum_learning_outcomes co
      on co.id=sow.curriculum_outcome_id
    where sow.id=v_draft.scheme_id
      and sow.teacher_id=v_uid and sow.school_id=v_draft.school_id
      and sow.class_id=v_draft.class_id and sow.subject_id=v_draft.subject_id
      and sow.curriculum_outcome_id=v_draft.curriculum_outcome_id
      and co.status='verified'
  ) then
    raise exception 'UNSCHEDULED_CURRICULUM_NOT_VERIFIED';
  end if;
  if nullif(btrim(coalesce(v_draft.body,'')),'') is null or
    v_draft.body not like '%<objectives>%' or
    v_draft.body not like '%<introduction>%' or
    v_draft.body not like '%<development>%' or
    v_draft.body not like '%<assessmentHook>%' then
    raise exception 'UNSCHEDULED_LESSON_CONTENT_REQUIRED';
  end if;

  select * into v_plan from public.lesson_plans
  where prepared_draft_id=p_draft_id and taught_date=v_date
    and timetable_slot_id is null and teacher_id=v_uid
  for update;

  if not found then
    v_dow := extract(isodow from v_date)::integer;
    insert into public.lesson_plans(
      school_id,teacher_id,class_id,subject_id,timetable_slot_id,week_start,
      day_of_week,taught_date,title,topic,body,generated_by,duration_minutes,
      status,scheme_id,curriculum_id,strand_id,curriculum_outcome_id,prepared_draft_id
    ) values (
      v_draft.school_id,v_uid,v_draft.class_id,v_draft.subject_id,null,
      v_date-(v_dow-1),v_dow,v_date,
      coalesce(nullif(v_draft.title,''),nullif(v_draft.topic,''),'Prepared lesson'),
      v_draft.topic,v_draft.body,'manual',v_draft.duration_minutes,
      'draft',v_draft.scheme_id,v_draft.curriculum_id,v_draft.strand_id,
      v_draft.curriculum_outcome_id,p_draft_id
    ) returning * into v_plan;
  end if;

  select * into v_occ from public.teaching_occurrences
  where unscheduled_plan_id=v_plan.id for update;
  if not found then
    insert into public.teaching_occurrences(
      timetable_slot_id,unscheduled_plan_id,occurrence_date,school_id,
      teacher_id,class_id,subject_id,lifecycle,started_at,started_by
    ) values (
      null,v_plan.id,v_date,v_plan.school_id,v_uid,v_plan.class_id,
      v_plan.subject_id,'in_progress',clock_timestamp(),v_uid
    ) returning * into v_occ;
  elsif v_occ.lifecycle not in ('in_progress','completed') then
    raise exception 'UNSCHEDULED_LESSON_UNAVAILABLE';
  end if;

  perform public.bind_teaching_occurrence_outcome(v_occ.id,v_plan.id);
  return v_occ;
end;
$function$;

revoke all on function public.start_unscheduled_teaching(uuid)
  from public, anon;
grant execute on function public.start_unscheduled_teaching(uuid)
  to authenticated;

-- The existing occurrence row is completed only after a teacher explicitly
-- records what was taught, reflection, attendance unavailability and absence
-- of learner evidence. These facts never imply attendance or learner mastery.
create or replace function public.complete_unscheduled_teaching(
  p_occurrence_id uuid,
  p_coverage text,
  p_what_taught text,
  p_reflection text,
  p_attendance_reason text,
  p_evidence_reason text,
  p_next_steps text default null
) returns public.teaching_occurrences
language plpgsql security definer set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_occ public.teaching_occurrences%rowtype;
  v_plan public.lesson_plans%rowtype;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  select * into v_occ from public.teaching_occurrences
  where id=p_occurrence_id and teacher_id=v_uid
    and timetable_slot_id is null and unscheduled_plan_id is not null
  for update;
  if not found then raise exception 'UNSCHEDULED_OCCURRENCE_NOT_FOUND' using errcode='42501'; end if;
  if v_occ.lifecycle='completed' then return v_occ; end if;
  if v_occ.lifecycle<>'in_progress' then raise exception 'OCCURRENCE_NOT_STARTED'; end if;
  select * into v_plan from public.lesson_plans
  where id=v_occ.unscheduled_plan_id and teacher_id=v_uid
    and school_id=v_occ.school_id and class_id=v_occ.class_id
    and subject_id=v_occ.subject_id and taught_date=v_occ.occurrence_date
    and timetable_slot_id is null;
  if not found or not public.lesson_draft_authorized(v_plan.school_id,v_plan.class_id,v_plan.subject_id) then
    raise exception 'UNSCHEDULED_ASSIGNMENT_INVALID' using errcode='42501';
  end if;
  if p_coverage is null or p_coverage not in ('covered','partial','not_covered','postponed','reteach')
    or nullif(btrim(coalesce(p_what_taught,'')),'') is null
    or nullif(btrim(coalesce(p_reflection,'')),'') is null
    or nullif(btrim(coalesce(p_attendance_reason,'')),'') is null
    or nullif(btrim(coalesce(p_evidence_reason,'')),'') is null then
    raise exception 'UNSCHEDULED_REVIEW_INCOMPLETE';
  end if;
  update public.teaching_occurrences
  set lifecycle='completed', completed_at=clock_timestamp(),
      completion_review=jsonb_build_object(
        'coverage',p_coverage,
        'what_was_taught',btrim(p_what_taught),
        'reflection',btrim(p_reflection),
        'attendance_recorded',false,
        'attendance_unavailable_reason',btrim(p_attendance_reason),
        'learning_evidence_recorded',false,
        'learning_evidence_unavailable_reason',btrim(p_evidence_reason),
        'next_steps',nullif(btrim(coalesce(p_next_steps,'')),'')
      )
  where id=v_occ.id returning * into v_occ;
  return v_occ;
end;
$function$;

revoke all on function public.complete_unscheduled_teaching(uuid,text,text,text,text,text,text)
  from public, anon;
grant execute on function public.complete_unscheduled_teaching(uuid,text,text,text,text,text,text)
  to authenticated;

commit;
