begin;

create or replace function
public.teacher_os_bind_outcome_lineage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scheme public.scheme_of_work%rowtype;
  v_unique_outcome uuid;
begin
  if new.scheme_id is null then
    return new;
  end if;

  select * into v_scheme
  from public.scheme_of_work
  where id = new.scheme_id;

  if not found then
    raise exception 'scheme_item_not_found';
  end if;

  if v_scheme.school_id is distinct from new.school_id
     or v_scheme.class_id is distinct from new.class_id
     or v_scheme.subject_id is distinct from new.subject_id
     or v_scheme.teacher_id is distinct from new.teacher_id
  then
    raise exception 'lesson_plan_scheme_identity_mismatch';
  end if;

  -- Prefer a single explicit primary outcome.
  -- Multiple linked outcomes require a selected outcome ID.
  if new.curriculum_outcome_id is null then
    new.curriculum_outcome_id :=
      v_scheme.curriculum_outcome_id;

    if new.curriculum_outcome_id is null then
      select min(slo.curriculum_outcome_id)
      into v_unique_outcome
      from public.scheme_lesson_outcomes slo
      where slo.scheme_lesson_id = v_scheme.id
      having count(*) = 1;

      new.curriculum_outcome_id := v_unique_outcome;
    end if;
  end if;

  -- Unresolved records remain drafts.
  -- Starting teaching still requires a valid outcome.
  if new.curriculum_outcome_id is null then
    return new;
  end if;

  if new.curriculum_outcome_id
       is distinct from v_scheme.curriculum_outcome_id
     and not exists (
       select 1
       from public.scheme_lesson_outcomes slo
       where slo.scheme_lesson_id = v_scheme.id
         and slo.curriculum_outcome_id =
           new.curriculum_outcome_id
     )
  then
    raise exception 'lesson_plan_outcome_mismatch';
  end if;

  -- Do not accept an outcome from a different sub-strand.
  if v_scheme.sub_strand_id is not null
     and not exists (
       select 1
       from public.curriculum_learning_outcomes clo
       where clo.id = new.curriculum_outcome_id
         and clo.sub_strand_id = v_scheme.sub_strand_id
     )
  then
    raise exception 'lesson_plan_substrand_mismatch';
  end if;

  return new;
end;
$$;

revoke all on function
  public.teacher_os_bind_outcome_lineage()
  from public, anon, authenticated;


-- Atomic attachment of an existing lesson plan to a
-- saved Scheme item and a selected canonical outcome.
create or replace function
public.attach_scheme_to_dated_lesson(
  p_plan_id uuid,
  p_scheme_id uuid,
  p_outcome_id uuid
)
returns table (
  plan_id uuid,
  scheme_id uuid,
  curriculum_outcome_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.lesson_plans%rowtype;
  v_scheme public.scheme_of_work%rowtype;
  v_term uuid;
  v_week integer;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select * into v_plan
  from public.lesson_plans
  where id = p_plan_id
    and teacher_id = auth.uid()
  for update;

  if not found then
    raise exception 'lesson_plan_not_owned';
  end if;

  if v_plan.timetable_slot_id is null
     or v_plan.taught_date is null
  then
    raise exception 'dated_occurrence_required';
  end if;

  -- Dated plans must resolve to this teacher's exact existing slot,
  -- not merely to an arbitrary slot UUID stored on a plan.
  if not exists (
    select 1
    from public.timetable_slots ts
    where ts.id = v_plan.timetable_slot_id
      and ts.school_id = v_plan.school_id
      and ts.teacher_id = auth.uid()
      and ts.class_id = v_plan.class_id
      and ts.subject_id = v_plan.subject_id
      and ts.day_of_week = extract(isodow from v_plan.taught_date)::integer
      and ts.effective_from <= v_plan.taught_date
      and (ts.effective_until is null or ts.effective_until >= v_plan.taught_date)
  ) then
    raise exception 'dated_occurrence_slot_mismatch';
  end if;

  if not exists (
    select 1
    from public.teacher_classes tc
    where tc.teacher_id = auth.uid()
      and tc.school_id = v_plan.school_id
      and tc.class_id = v_plan.class_id
      and tc.subject_id = v_plan.subject_id
  ) then
    raise exception 'teacher_assignment_required';
  end if;

  select * into v_scheme
  from public.scheme_of_work sw
  where sw.id = p_scheme_id
    and sw.teacher_id = auth.uid()
    and sw.school_id = v_plan.school_id
    and sw.class_id = v_plan.class_id
    and sw.subject_id = v_plan.subject_id;

  if not found then
    raise exception 'scheme_item_not_found';
  end if;

  select iw.term_id, iw.week_number
  into v_term, v_week
  from public.resolve_instructional_week_for_date(
    v_plan.school_id,
    v_plan.taught_date
  ) iw;

  if v_term is null
     or v_scheme.academic_term_id is distinct from v_term
     or v_scheme.week is distinct from v_week
  then
    raise exception 'scheme_occurrence_week_mismatch';
  end if;

  if p_outcome_id is null then
    raise exception 'curriculum_outcome_required';
  end if;

  if p_outcome_id
       is distinct from v_scheme.curriculum_outcome_id
     and not exists (
       select 1
       from public.scheme_lesson_outcomes slo
       where slo.scheme_lesson_id = p_scheme_id
         and slo.curriculum_outcome_id = p_outcome_id
     )
  then
    raise exception 'scheme_outcome_mismatch';
  end if;

  if not exists (
    select 1
    from public.curriculum_learning_outcomes clo
    where clo.id = p_outcome_id
      and clo.status in ('active', 'verified')
      and (
        v_scheme.sub_strand_id is null
        or clo.sub_strand_id = v_scheme.sub_strand_id
      )
  ) then
    raise exception 'outcome_identity_unverified';
  end if;

  -- In-progress and completed teaching keeps its original Scheme
  -- and outcome even when the occurrence-outcome junction is empty.
  if exists (
    select 1 from public.teaching_occurrences o
    where o.timetable_slot_id = v_plan.timetable_slot_id
      and o.occurrence_date = v_plan.taught_date
      and o.lifecycle in ('in_progress','completed')
  ) and (
    v_plan.scheme_id is distinct from p_scheme_id
    or v_plan.curriculum_outcome_id is distinct from p_outcome_id
  ) then
    raise exception 'occurrence_outcome_immutable';
  end if;

  -- Never change an outcome already pinned to an
  -- in-progress or completed teaching occurrence.
  if exists (
    select 1
    from public.teaching_occurrences o
    where o.timetable_slot_id = v_plan.timetable_slot_id
      and o.occurrence_date = v_plan.taught_date
      and o.lifecycle in ('in_progress', 'completed')
      and exists (
        select 1
        from public.teaching_occurrence_outcomes too
        where too.teaching_occurrence_id = o.id
          and too.curriculum_outcome_id <> p_outcome_id
      )
  ) then
    raise exception 'occurrence_outcome_immutable';
  end if;

  update public.lesson_plans lp
  set
    scheme_id = p_scheme_id,
    curriculum_outcome_id = p_outcome_id
  where lp.id = v_plan.id;

  return query
  select v_plan.id, p_scheme_id, p_outcome_id;
end;
$$;

revoke all on function
  public.attach_scheme_to_dated_lesson(uuid, uuid, uuid)
  from public, anon;

grant execute on function
  public.attach_scheme_to_dated_lesson(uuid, uuid, uuid)
  to authenticated;

create or replace function
public.preview_timetable_slot_inventory(
  p_school_id uuid
)
returns table (
  slot_id uuid,
  effective_from date,
  effective_until date,
  linked_plans bigint,
  linked_occurrences bigint,
  completed_lessons bigint,
  linked_evidence bigint,
  linked_tasks bigint,
  review_status text
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if auth.uid() is null
     or not public.is_school_admin(p_school_id)
  then
    raise exception 'SCHOOL_ADMIN_REQUIRED';
  end if;

  return query
  select
    ts.id,
    ts.effective_from,
    ts.effective_until,
    (
      select count(*)
      from public.lesson_plans lp
      where lp.timetable_slot_id = ts.id
    ),
    (
      select count(*)
      from public.teaching_occurrences o
      where o.timetable_slot_id = ts.id
    ),
    (
      select count(*)
      from public.teaching_occurrences o
      where o.timetable_slot_id = ts.id
        and o.lifecycle = 'completed'
    ),
    (
      select count(*)
      from public.lesson_evidence e
      join public.teaching_occurrences o
        on o.id = e.teaching_occurrence_id
      where o.timetable_slot_id = ts.id
    ),
    (
      select count(*)
      from public.learning_tasks t
      join public.teaching_occurrences o
        on o.id = t.teaching_occurrence_id
      where o.timetable_slot_id = ts.id
    ),
    case
      when exists (
        select 1 from public.teaching_occurrences o
        where o.timetable_slot_id = ts.id
      )
      or exists (
        select 1 from public.lesson_plans lp
        where lp.timetable_slot_id = ts.id
      )
      then 'PRESERVE_LINKED_HISTORY'
      else 'REVIEW_UNLINKED_SLOT'
    end
  from public.timetable_slots ts
  where ts.school_id = p_school_id
  order by ts.effective_from, ts.id;
end;
$$;

revoke all on function
  public.preview_timetable_slot_inventory(uuid)
  from public, anon;

grant execute on function
  public.preview_timetable_slot_inventory(uuid)
  to authenticated;

commit;
