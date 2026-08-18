begin;

-- Learner and relationship identity data is private. Deny anonymous reads at the
-- privilege layer as well as through RLS so failures are closed before policy evaluation.
revoke select on table public.students from anon;
revoke select on table public.parent_student_links from anon;

comment on table public.students is
  'Canonical learner identity. Anonymous access is denied; authenticated access remains RLS-scoped.';
comment on table public.parent_student_links is
  'Private parent-to-learner relationship evidence. Anonymous access is denied; authenticated access remains RLS-scoped.';

commit;
