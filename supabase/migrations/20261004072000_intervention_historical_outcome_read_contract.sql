create policy "curriculum_learning_outcomes_intervention_history_read"
on public.curriculum_learning_outcomes
for select
to authenticated
using (
  exists (
    select 1
    from public.assessment_interventions ai
    where ai.outcome_id = curriculum_learning_outcomes.id
      and ai.teacher_id = (select auth.uid())
  )
);
