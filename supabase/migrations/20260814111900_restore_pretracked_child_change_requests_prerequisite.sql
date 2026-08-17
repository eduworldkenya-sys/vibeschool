-- Restore the production-pretracked child_change_requests table into repository history.
-- This is intentionally idempotent and declares its own fail-closed security contract.

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

alter table public.child_change_requests enable row level security;

revoke all privileges on table public.child_change_requests from public, anon, authenticated;
grant select, insert on table public.child_change_requests to authenticated;

drop policy if exists "parent owns change requests" on public.child_change_requests;
drop policy if exists "parents read own learner correction requests" on public.child_change_requests;
drop policy if exists "parents create linked learner correction requests" on public.child_change_requests;

create policy "parents read own learner correction requests"
on public.child_change_requests
for select
to authenticated
using (
  parent_id = auth.uid()
  and exists (
    select 1
    from public.parent_student_links psl
    where psl.parent_id = auth.uid()
      and psl.student_id = child_change_requests.student_id
  )
);

create policy "parents create linked learner correction requests"
on public.child_change_requests
for insert
to authenticated
with check (
  parent_id = auth.uid()
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and review_note is null
  and field in ('name', 'admission_number', 'date_of_birth', 'gender')
  and exists (
    select 1
    from public.parent_student_links psl
    where psl.parent_id = auth.uid()
      and psl.student_id = child_change_requests.student_id
  )
);

-- authorization-test: public.child_change_requests denies anon; authenticated parents
-- may only SELECT/INSERT requests for learners linked to auth.uid(); no UPDATE or
-- DELETE grant exists and reviewer-owned fields must be null on INSERT.

commit;
