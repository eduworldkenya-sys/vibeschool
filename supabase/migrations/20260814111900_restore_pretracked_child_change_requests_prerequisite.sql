-- Restore the production-pretracked child_change_requests table into repository history.
-- This is intentionally idempotent so production, where the table already exists, is unchanged.

begin;

create table if not exists public.child_change_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  parent_id uuid not null references auth.users(id),
  field text not null,
  old_value text,
  new_value text not null,
  reason text,
  status text default 'pending',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_child_change_requests_student
  on public.child_change_requests (student_id);

commit;
