-- Fix 14A: harden lesson_plans into a proper occurrence identity.
-- Verified: 2/2 rows backfillable via week_start + (day_of_week - 1),
-- ISO isodow convention confirmed (week_start is always Monday, isodow=1),
-- zero duplicate (timetable_slot_id, taught_date) pairs, zero null timetable_slot_id.

begin;

-- Defensive check: every row missing taught_date must be backfillable.
do $$
begin
  if exists (
    select 1
    from public.lesson_plans
    where taught_date is null
      and (
        week_start is null
        or day_of_week is null
        or day_of_week not between 1 and 7
      )
  ) then
    raise exception 'Cannot backfill taught_date for all lesson plans';
  end if;
end $$;

update public.lesson_plans
set taught_date = week_start + (day_of_week - 1)
where taught_date is null;

-- Defensive check: no duplicate occurrence identities before constraining.
do $$
begin
  if exists (
    select 1
    from public.lesson_plans
    group by timetable_slot_id, taught_date
    having count(*) > 1
  ) then
    raise exception 'Duplicate lesson occurrence identities detected';
  end if;
end $$;

alter table public.lesson_plans
  alter column taught_date set not null;

alter table public.lesson_plans
  alter column timetable_slot_id set not null;

alter table public.lesson_plans
  add constraint lesson_plans_slot_taught_date_key
  unique (timetable_slot_id, taught_date);

commit;
