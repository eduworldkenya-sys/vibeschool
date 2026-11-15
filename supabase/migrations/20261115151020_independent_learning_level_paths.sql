-- Extend only the existing independent learner's *learning preference* values.
-- The verified identity, school-linking restrictions, and self-owned pathway RLS
-- remain unchanged. Post-secondary selections receive no school enrolment.
alter table public.independent_learner_identities
  drop constraint if exists independent_grade_label_valid;
alter table public.independent_learner_identities
  add constraint independent_grade_label_valid
  check (grade_label is null or grade_label in (
    'PP1','PP2',
    'Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6',
    'Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12',
    'Form 1','Form 2','Form 3','Form 4',
    'College','University','Professional Studies'
  ));
