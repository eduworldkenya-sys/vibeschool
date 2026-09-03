begin;

-- Final P0 truth convergence for the Lesson Plan production spine.
-- Goals:
--   1) deterministically repair legacy same-week occurrence-date drift where
--      timetable authority and stored week identity already agree;
--   2) fail closed if any ambiguous occurrence mismatch remains;
--   3) make status/publication semantics structural and tamper resistant.

-- Repair only rows where school/teacher/class/subject identity already agrees
-- with the timetable slot and the canonical date can be derived from week_start
-- + authoritative slot weekday. The NOT EXISTS guard prevents unique-key
-- collisions; anything ambiguous is rejected by the assertion below.
update public.lesson_plans lp
set taught_date = lp.week_start + (ts.day_of_week - 1),
    day_of_week = ts.day_of_week,
    updated_at = now()
from public.timetable_slots ts
where ts.id = lp.timetable_slot_id
  and lp.school_id is not distinct from ts.school_id
  and lp.teacher_id is not distinct from ts.teacher_id
  and lp.class_id is not distinct from ts.class_id
  and lp.subject_id is not distinct from ts.subject_id
  and lp.week_start = date_trunc('week', lp.week_start::timestamp)::date
  and extract(isodow from lp.taught_date)::integer <> ts.day_of_week
  and lp.taught_date >= lp.week_start
  and lp.taught_date < lp.week_start + 7
  and (lp.week_start + (ts.day_of_week - 1)) >= ts.effective_from
  and (
    ts.effective_until is null
    or (lp.week_start + (ts.day_of_week - 1)) <= ts.effective_until
  )
  and not exists (
    select 1
    from public.lesson_plans conflict
    where conflict.timetable_slot_id = lp.timetable_slot_id
      and conflict.taught_date = lp.week_start + (ts.day_of_week - 1)
      and conflict.id <> lp.id
  );

-- Never silently certify a database that still contains impossible lesson-plan
-- occurrence identity. A migration failure is safer than preserving ambiguous
-- production truth.
do $$
begin
  if exists (
    select 1
    from public.lesson_plans lp
    join public.timetable_slots ts on ts.id = lp.timetable_slot_id
    where lp.school_id is distinct from ts.school_id
       or lp.teacher_id is distinct from ts.teacher_id
       or lp.class_id is distinct from ts.class_id
       or lp.subject_id is distinct from ts.subject_id
       or lp.day_of_week is distinct from ts.day_of_week
       or extract(isodow from lp.taught_date)::integer <> ts.day_of_week
       or lp.taught_date < ts.effective_from
       or (ts.effective_until is not null and lp.taught_date > ts.effective_until)
       or lp.week_start is distinct from date_trunc('week', lp.taught_date::timestamp)::date
  ) then
    raise exception 'lesson_plan_historical_occurrence_mismatch_requires_manual_reconciliation';
  end if;
end;
$$;

-- The application has exactly three supported plan states. Keep the database
-- contract aligned with the TypeScript contract so alternate callers cannot
-- invent lifecycle states.
alter table public.lesson_plans
  drop constraint if exists lesson_plans_status_check;

alter table public.lesson_plans
  add constraint lesson_plans_status_check
  check (status in ('draft', 'published', 'shared_to_parents'))
  not valid;

alter table public.lesson_plans
  validate constraint lesson_plans_status_check;

-- Publication is controlled by status transitions, never by direct writes to
-- published_at. This makes published_at a durable derived fact rather than a
-- client-controlled visibility switch.
create or replace function public.lesson_plan_normalize_publication_state()
returns trigger
language plpgsql
set search_path = 'public', 'pg_temp'
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'draft' then
      new.published_at := null;
    elsif new.status = 'published' then
      new.published_at := now();
    elsif new.status = 'shared_to_parents' then
      -- A newly parent-shared plan has not automatically been learner-published.
      new.published_at := null;
    end if;
    return new;
  end if;

  if new.status = 'draft' then
    new.published_at := null;
  elsif new.status = 'published' then
    -- Preserve the first learner-publication time when already published;
    -- otherwise record the exact transition into learner visibility.
    new.published_at := coalesce(old.published_at, now());
  elsif new.status = 'shared_to_parents' then
    -- Parent sharing must preserve, not manufacture, learner publication.
    new.published_at := old.published_at;
  end if;

  return new;
end;
$$;

revoke all on function public.lesson_plan_normalize_publication_state() from public;
revoke all on function public.lesson_plan_normalize_publication_state() from anon;
revoke all on function public.lesson_plan_normalize_publication_state() from authenticated;

drop trigger if exists trg_lesson_plan_normalize_publication_state on public.lesson_plans;
create trigger trg_lesson_plan_normalize_publication_state
before insert or update of status, published_at
on public.lesson_plans
for each row
execute function public.lesson_plan_normalize_publication_state();

-- Structural consistency for the states whose publication semantics are
-- unambiguous. shared_to_parents intentionally permits either value because a
-- teacher may share before or after learner publication.
alter table public.lesson_plans
  drop constraint if exists lesson_plans_publication_state_check;

alter table public.lesson_plans
  add constraint lesson_plans_publication_state_check
  check (
    (status = 'draft' and published_at is null)
    or (status = 'published' and published_at is not null)
    or status = 'shared_to_parents'
  )
  not valid;

alter table public.lesson_plans
  validate constraint lesson_plans_publication_state_check;

commit;
