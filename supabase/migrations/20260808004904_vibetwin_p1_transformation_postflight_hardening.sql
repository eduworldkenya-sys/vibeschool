-- P1 postflight: index nullable publication lineage and optimize own-row RLS auth evaluation.
-- Live Supabase ledger: 20260808004904

create index if not exists student_learning_transformations_publication_idx
  on public.student_learning_transformations(publication_id)
  where publication_id is not null;

drop policy if exists student_learning_transformations_select_own on public.student_learning_transformations;
create policy student_learning_transformations_select_own
  on public.student_learning_transformations
  for select to authenticated
  using (exists (
    select 1 from public.students s
    where s.id = student_learning_transformations.student_id
      and s.profile_id = (select auth.uid())
      and s.deleted_at is null
  ));

drop policy if exists student_learning_transformation_events_select_own on public.student_learning_transformation_events;
create policy student_learning_transformation_events_select_own
  on public.student_learning_transformation_events
  for select to authenticated
  using (exists (
    select 1 from public.students s
    where s.id = student_learning_transformation_events.student_id
      and s.profile_id = (select auth.uid())
      and s.deleted_at is null
  ));
