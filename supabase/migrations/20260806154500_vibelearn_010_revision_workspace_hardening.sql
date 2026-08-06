create index if not exists student_practice_attempts_question_idx
  on public.student_practice_attempts(exam_question_id);
create index if not exists student_mistake_notebook_question_idx
  on public.student_mistake_notebook(exam_question_id);

drop policy if exists student_revision_plan_own on public.student_revision_plan_items;
drop policy if exists student_practice_attempts_own on public.student_practice_attempts;
drop policy if exists student_mistakes_own on public.student_mistake_notebook;
drop policy if exists student_topic_notes_own on public.student_topic_notes;

create policy student_revision_plan_select_own
  on public.student_revision_plan_items
  for select to authenticated
  using (student_id = (select auth.uid()));

create policy student_practice_attempts_select_own
  on public.student_practice_attempts
  for select to authenticated
  using (student_id = (select auth.uid()));

create policy student_mistakes_select_own
  on public.student_mistake_notebook
  for select to authenticated
  using (student_id = (select auth.uid()));

create policy student_topic_notes_select_own
  on public.student_topic_notes
  for select to authenticated
  using (student_id = (select auth.uid()));
