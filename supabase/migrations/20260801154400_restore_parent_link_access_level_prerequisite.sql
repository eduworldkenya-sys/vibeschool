-- L0 recovery prerequisite.
-- Evidence: production public.parent_student_links contains access_level text
-- with default 'full', while no tracked repository migration creates the column
-- before CE-016 references it. Restore only the proven schema prerequisite so a
-- blank replay can reproduce the state expected by the tracked hardening migration.
-- Production is not modified by this recovery migration while it remains on the
-- isolated L0 branch.

begin;

alter table public.parent_student_links
  add column if not exists access_level text default 'full';

commit;
