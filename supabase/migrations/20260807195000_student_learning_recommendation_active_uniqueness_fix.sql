alter table public.student_learning_recommendations
  drop constraint if exists student_learning_recommendati_student_id_recommendation_typ_key;

create unique index if not exists student_learning_recommendations_active_unique
  on public.student_learning_recommendations(student_id,recommendation_type,outcome_id)
  where status='active';
