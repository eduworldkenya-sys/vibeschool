-- Restricted independent learner grade preference. Not a school enrollment or student-role grant.
alter table public.independent_learner_identities
  add column if not exists grade_label text;
alter table public.independent_learner_identities
  drop constraint if exists independent_grade_label_valid;
alter table public.independent_learner_identities
  add constraint independent_grade_label_valid
  check (grade_label is null or grade_label in (
    'Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6',
    'Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12',
    'Form 1','Form 2','Form 3','Form 4'
  ));
-- Preserve RLS/revoked public grants. Updates occur through authenticated
-- server actions after checking the user's verified identity.
