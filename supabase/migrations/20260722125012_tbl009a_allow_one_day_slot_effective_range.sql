-- TBL-009A companion: chk_effective_range required effective_until to be
-- STRICTLY after effective_from, which forbids a slot effective for
-- exactly one day. The recovery model depends on one-day slots
-- (effective_from = effective_until = recovery date), and a single-day
-- effective window is semantically legitimate everywhere else too (the
-- exclusion constraints already use inclusive daterange bounds and every
-- canonical read filters with <= / >=). Relax to >=.
-- Discovered during TBL-009A live verification; no existing row violates
-- either form.

alter table public.timetable_slots
  drop constraint chk_effective_range;

alter table public.timetable_slots
  add constraint chk_effective_range
  check (effective_until is null or effective_until >= effective_from);
