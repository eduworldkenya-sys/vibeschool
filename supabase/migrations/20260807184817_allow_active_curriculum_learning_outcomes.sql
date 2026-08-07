-- Keep curriculum lifecycle values aligned with Twin mastery readers.
-- `active` means usable by deterministic learning engines without claiming official verification.
alter table public.curriculum_learning_outcomes
  drop constraint if exists curriculum_learning_outcomes_status_check;

alter table public.curriculum_learning_outcomes
  add constraint curriculum_learning_outcomes_status_check
  check (status = any (array['draft'::text, 'active'::text, 'verified'::text, 'rejected'::text, 'archived'::text]));
