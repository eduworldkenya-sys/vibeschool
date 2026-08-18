-- Restore VibeLearn learner-state tables that pre-existed in production but
-- were missing from tracked migration history. These are prerequisites for
-- 20260818130509_student_one_vibelearn_identity_authority.sql.

create table if not exists public.vibelearn_saved (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  content_id uuid references public.vibelearn_content(id) on delete cascade,
  saved_at timestamptz default now(),
  unique (student_id, content_id)
);

create table if not exists public.vibelearn_completed (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  content_id uuid references public.vibelearn_content(id) on delete cascade,
  completed_at timestamptz default now(),
  unique (student_id, content_id)
);

create table if not exists public.vibelearn_points (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  action text not null check (action in ('complete_ebook','complete_epage','submit_content','content_viewed','daily_streak')),
  points integer not null,
  content_id uuid references public.vibelearn_content(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.vibelearn_streaks (
  student_id uuid primary key references public.students(id) on delete cascade,
  current_streak integer default 0,
  longest_streak integer default 0,
  last_active_date date,
  updated_at timestamptz default now()
);

create index if not exists idx_vibelearn_saved_student on public.vibelearn_saved(student_id);
create index if not exists idx_vibelearn_completed_student on public.vibelearn_completed(student_id);
create index if not exists idx_vlpoints_student on public.vibelearn_points(student_id);

alter table public.vibelearn_saved enable row level security;
alter table public.vibelearn_completed enable row level security;
alter table public.vibelearn_points enable row level security;
alter table public.vibelearn_streaks enable row level security;

revoke all on public.vibelearn_saved from anon;
revoke all on public.vibelearn_completed from anon;
revoke all on public.vibelearn_points from anon;
revoke all on public.vibelearn_streaks from anon;

grant select, insert, update, delete on public.vibelearn_saved to authenticated;
grant select, insert on public.vibelearn_completed to authenticated;
grant select on public.vibelearn_points to authenticated;
grant select on public.vibelearn_streaks to authenticated;

-- Preserve the production owner boundary immediately when these restored
-- prerequisite tables are created. The following migration intentionally
-- replaces the saved/completed policies with the stronger Student = 1 form.
create policy vibelearn_saved_owner on public.vibelearn_saved
for all to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = vibelearn_saved.student_id
      and s.profile_id = (select auth.uid())
      and s.deleted_at is null
  )
)
with check (
  exists (
    select 1 from public.students s
    where s.id = vibelearn_saved.student_id
      and s.profile_id = (select auth.uid())
      and s.deleted_at is null
  )
);

create policy vibelearn_completed_read_own on public.vibelearn_completed
for select to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = vibelearn_completed.student_id
      and s.profile_id = (select auth.uid())
      and s.deleted_at is null
  )
);

create policy vibelearn_completed_write_own on public.vibelearn_completed
for insert to authenticated
with check (
  exists (
    select 1 from public.students s
    where s.id = vibelearn_completed.student_id
      and s.profile_id = (select auth.uid())
      and s.deleted_at is null
  )
);

create policy vibelearn_points_read_own on public.vibelearn_points
for select to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = vibelearn_points.student_id
      and s.profile_id = (select auth.uid())
  )
);

create policy vibelearn_streaks_read_own on public.vibelearn_streaks
for select to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = vibelearn_streaks.student_id
      and s.profile_id = (select auth.uid())
  )
);

-- authorization-test: public.vibelearn_saved
-- authenticated learner can access only rows whose canonical students.id maps
-- back to the current auth profile; anon has no table privileges.
-- authorization-test: public.vibelearn_completed
-- authenticated learner can read/insert only their canonical learner rows.
-- authorization-test: public.vibelearn_points
-- authenticated learner has read-only access to their canonical learner rows;
-- direct point mutation remains unavailable.
-- authorization-test: public.vibelearn_streaks
-- authenticated learner has read-only access to their canonical learner row;
-- direct streak mutation remains unavailable.
