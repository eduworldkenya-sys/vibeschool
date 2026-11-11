begin;

-- Unscheduled lesson preparation may cite an active, not-yet-verified
-- curriculum outcome. This is NOT approval to mark the draft Ready to Teach.
-- Active outcomes remain distinguishable from verified ones in the UI.
create or replace function public.lesson_draft_validate_scope()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_scheme record;
  v_outcome uuid;
begin
  if not public.lesson_draft_authorized(new.school_id,new.class_id,new.subject_id)
     or new.teacher_id is distinct from auth.uid() then
    raise exception 'DRAFT_ASSIGNMENT_REQUIRED' using errcode = '42501';
  end if;
  if new.scheme_id is not null then
    if new.class_id is null then
      raise exception 'DRAFT_SCHEME_CLASS_REQUIRED';
    end if;
    select school_id,teacher_id,class_id,subject_id,curriculum_id,
           sub_strand_id,curriculum_outcome_id
    into v_scheme from public.scheme_of_work where id = new.scheme_id;
    if not found or v_scheme.school_id is distinct from new.school_id
       or v_scheme.teacher_id is distinct from new.teacher_id
       or v_scheme.class_id is distinct from new.class_id
       or v_scheme.subject_id is distinct from new.subject_id then
      raise exception 'DRAFT_SCHEME_MISMATCH';
    end if;
    v_outcome := v_scheme.curriculum_outcome_id;
    if v_outcome is null or (new.curriculum_outcome_id is not null
                            and new.curriculum_outcome_id <> v_outcome) then
      raise exception 'DRAFT_SCHEME_OUTCOME_REQUIRED';
    end if;
    new.curriculum_outcome_id := v_outcome;
    new.curriculum_id := v_scheme.curriculum_id;
    new.strand_id := v_scheme.sub_strand_id;
  end if;
  if new.curriculum_outcome_id is not null then
    if not exists (
      select 1 from public.curriculum_learning_outcomes co
      where co.id = new.curriculum_outcome_id
        and co.status in ('active', 'verified')
        and (new.curriculum_id is null or co.curriculum_id = new.curriculum_id)
    ) then
      raise exception 'DRAFT_OUTCOME_MISMATCH';
    end if;
  end if;
  if new.status = 'ready' and (
    new.curriculum_outcome_id is null or
    not exists (
      select 1 from public.curriculum_learning_outcomes co
      where co.id = new.curriculum_outcome_id
        and co.status = 'verified'
        and (new.curriculum_id is null or co.curriculum_id = new.curriculum_id)
    )
  ) then
    raise exception 'DRAFT_OUTCOME_REQUIRED_FOR_READY';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

revoke all on function public.lesson_draft_validate_scope() from public, anon, authenticated;

-- A teacher can only keep one non-archived prepared draft per exact Scheme row.
-- This prevents duplicate plans on repeated Prepare clicks and simultaneous saves.
create unique index if not exists lesson_plan_drafts_one_open_per_scheme
  on public.lesson_plan_drafts(teacher_id, scheme_id)
  where scheme_id is not null and status <> 'archived';

-- Reuse the existing guarded, idempotent attachment RPC and immutable
-- prepared_draft_id lineage. Active sources may attach as DRAFT; readiness
-- still requires a separately verified outcome and complete teaching content.
create or replace function public.attach_lesson_plan_draft_to_occurrence(
  p_draft_id uuid,
  p_timetable_slot_id uuid,
  p_taught_date date
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_draft public.lesson_plan_drafts%rowtype;
  v_slot public.timetable_slots%rowtype;
  v_existing uuid;
  v_existing_draft uuid;
  v_plan_id uuid;
  v_dow integer;
  v_constraint text;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;
  if p_taught_date is null then
    raise exception 'INVALID_TAUGHT_DATE';
  end if;

  select * into v_draft
  from public.lesson_plan_drafts
  where id = p_draft_id and teacher_id = v_uid
  for update;
  if not found then
    raise exception 'DRAFT_NOT_FOUND' using errcode = '42501';
  end if;
  if v_draft.status = 'archived' then
    raise exception 'DRAFT_ARCHIVED';
  end if;

  select * into v_slot
  from public.timetable_slots
  where id = p_timetable_slot_id and teacher_id = v_uid;
  if not found then
    raise exception 'SLOT_NOT_FOUND' using errcode = '42501';
  end if;

  if v_draft.school_id is distinct from v_slot.school_id
    or v_draft.subject_id is distinct from v_slot.subject_id
    or (v_draft.class_id is not null and v_draft.class_id is distinct from v_slot.class_id)
    or not public.lesson_draft_authorized(v_slot.school_id, v_slot.class_id, v_slot.subject_id) then
    raise exception 'DRAFT_SCHEDULE_SCOPE_MISMATCH' using errcode = '42501';
  end if;

  v_dow := extract(isodow from p_taught_date)::integer;
  if v_dow <> v_slot.day_of_week
    or (v_slot.effective_from is not null and p_taught_date < v_slot.effective_from)
    or (v_slot.effective_until is not null and p_taught_date > v_slot.effective_until) then
    raise exception 'DRAFT_OCCURRENCE_MISMATCH';
  end if;

  -- A once-verified learning outcome can subsequently be revoked. Do not
  -- transfer stale canonical authority into a new lesson plan.
  if v_draft.curriculum_outcome_id is not null
    and not exists (
      select 1 from public.curriculum_learning_outcomes o
      where o.id = v_draft.curriculum_outcome_id and o.status in ('active', 'verified')
    ) then
    raise exception 'DRAFT_CURRICULUM_REVIEW_REQUIRED';
  end if;

  -- Scheme references must stay in their saved instructional term/week.
  -- Neither manual attachment nor an automatic one may move Week 2 to Week 11.
  if v_draft.scheme_id is not null and not exists (
    select 1
    from public.scheme_of_work s
    join public.term_weeks tw
      on tw.term_id = s.academic_term_id
      and tw.week_number = s.week
    where s.id = v_draft.scheme_id
      and s.teacher_id = v_uid
      and s.school_id = v_slot.school_id
      and s.class_id = v_slot.class_id
      and s.subject_id = v_slot.subject_id
      and s.curriculum_outcome_id = v_draft.curriculum_outcome_id
      and (tw.school_id = v_slot.school_id or tw.school_id is null)
      and p_taught_date between tw.start_date and tw.end_date
  ) then
    raise exception 'DRAFT_SCHEME_OCCURRENCE_WEEK_MISMATCH';
  end if;

  select lp.id, lp.prepared_draft_id into v_existing, v_existing_draft
  from public.lesson_plans lp
  where lp.timetable_slot_id = p_timetable_slot_id and lp.taught_date = p_taught_date
  limit 1 for update;

  if v_existing is not null then
    if v_existing_draft = p_draft_id then
      return v_existing;
    end if;
    raise exception 'OCCURRENCE_ALREADY_HAS_DIFFERENT_PLAN';
  end if;

  insert into public.lesson_plans (
    school_id, teacher_id, class_id, subject_id, timetable_slot_id,
    week_start, day_of_week, taught_date, title, topic, body,
    generated_by, duration_minutes, status, scheme_id, curriculum_id,
    strand_id, curriculum_outcome_id, prepared_draft_id
  ) values (
    v_slot.school_id, v_uid, v_slot.class_id, v_slot.subject_id, v_slot.id,
    p_taught_date - (v_dow - 1), v_slot.day_of_week, p_taught_date,
    coalesce(nullif(v_draft.title,''), nullif(v_draft.topic,''), 'Prepared lesson'),
    v_draft.topic, v_draft.body, 'manual', v_draft.duration_minutes,
    'draft', v_draft.scheme_id, v_draft.curriculum_id,
    v_draft.strand_id, v_draft.curriculum_outcome_id, v_draft.id
  ) returning id into v_plan_id;

  return v_plan_id;
exception when unique_violation then
  -- Concurrent attachment attempts must not overwrite another teacher's work.
  get stacked diagnostics v_constraint = constraint_name;
  if v_constraint = 'lesson_plans_slot_taught_date_key' then
    select lp.id, lp.prepared_draft_id into v_existing, v_existing_draft
    from public.lesson_plans lp
    where lp.timetable_slot_id = p_timetable_slot_id and lp.taught_date = p_taught_date;
    if v_existing is not null and v_existing_draft = p_draft_id then
      return v_existing;
    end if;
    raise exception 'OCCURRENCE_ALREADY_HAS_DIFFERENT_PLAN';
  end if;
  raise;
end;
$function$;

revoke all on function public.attach_lesson_plan_draft_to_occurrence(uuid,uuid,date)
  from public, anon, authenticated;
grant execute on function public.attach_lesson_plan_draft_to_occurrence(uuid,uuid,date)
  to authenticated;

commit;
