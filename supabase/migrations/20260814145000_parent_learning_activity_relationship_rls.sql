begin;

drop policy if exists exercises_parent_read on public.exercises;
drop policy if exists exercise_submissions_parent_read on public.exercise_submissions;
drop policy if exists projects_parent_read on public.projects;
drop policy if exists project_submissions_parent_read on public.project_submissions;

create policy exercises_parent_current_link on public.exercises for select to authenticated
using (exists (select 1 from public.parent_student_links psl join public.student_classes sc on sc.student_id=psl.student_id where psl.parent_id=auth.uid() and sc.class_id=exercises.class_id and sc.is_current=true and coalesce(psl.access_level,'full') <> 'none'));

create policy exercise_submissions_parent_current_link on public.exercise_submissions for select to authenticated
using (exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=exercise_submissions.student_id and coalesce(psl.access_level,'full') <> 'none'));

create policy projects_parent_current_link on public.projects for select to authenticated
using (exists (select 1 from public.parent_student_links psl join public.student_classes sc on sc.student_id=psl.student_id where psl.parent_id=auth.uid() and sc.class_id=projects.class_id and sc.is_current=true and coalesce(psl.access_level,'full') <> 'none'));

create policy project_submissions_parent_current_link on public.project_submissions for select to authenticated
using (exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=project_submissions.student_id and coalesce(psl.access_level,'full') <> 'none'));

commit;
