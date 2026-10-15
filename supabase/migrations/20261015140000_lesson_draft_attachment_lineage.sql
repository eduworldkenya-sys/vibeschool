begin;
-- authorization-test: public.lesson_plans prepared_draft_id links only to the author's same-school, same-class, same-subject draft by an authorized attachment RPC.
-- authorization-test: public.attach_lesson_plan_draft_to_occurrence rejects attempts to silently replace a different canonical lesson plan.
-- Forward-only production repair: an existing dated plan is not proof that
-- the teacher's selected prepared draft was actually attached.
alter table public.lesson_plans
  add column if not exists prepared_draft_id uuid
    references public.lesson_plan_drafts(id) on delete set null;
create index if not exists lesson_plans_prepared_draft_idx
  on public.lesson_plans(prepared_draft_id)
  where prepared_draft_id is not null;

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
      where o.id = v_draft.curriculum_outcome_id and o.status = 'verified'
    ) then
    raise exception 'DRAFT_CURRICULUM_REVIEW_REQUIRED';
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
select pg_notify('pgrst', 'reload schema');
commit;
