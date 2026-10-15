begin;
-- authorization-test: public.lesson_plan_drafts authenticated teachers cannot mark custom, Scheme-less topics Ready; existing draft records remain editable.
-- Forward-only hardening after the production table restoration.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.lesson_plan_drafts'::regclass
      and conname='lesson_draft_ready_scheme_outcome_check'
  ) then
    alter table public.lesson_plan_drafts
      add constraint lesson_draft_ready_scheme_outcome_check
      check (status <> 'ready' or (scheme_id is not null and curriculum_outcome_id is not null))
      not valid;
  end if;
end $$;
alter table public.lesson_plan_drafts
  validate constraint lesson_draft_ready_scheme_outcome_check;
drop policy if exists lesson_plan_drafts_teacher_select on public.lesson_plan_drafts;
drop policy if exists lesson_plan_drafts_teacher_insert on public.lesson_plan_drafts;
drop policy if exists lesson_plan_drafts_teacher_update on public.lesson_plan_drafts;
drop policy if exists lesson_plan_drafts_teacher_delete on public.lesson_plan_drafts;
select pg_notify('pgrst','reload schema');
commit;
