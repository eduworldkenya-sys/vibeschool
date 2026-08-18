-- Restore the finance-visibility permission that exists in production but was
-- absent from the reproducible blank migration chain. Parent Command Center R1
-- relies on this explicit link-level permission before exposing school finance.

alter table public.parent_student_links
  add column if not exists can_view_finance boolean not null default false;

comment on column public.parent_student_links.can_view_finance is
  'Explicit guardian permission to view school finance data for this linked learner.';
