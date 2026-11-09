-- Personal learner planner, independent of class, school, and teacher relationships.
create table if not exists public.student_personal_planner (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 1 and 160),
 notes text not null default '' check (char_length(notes) <= 2000),
 kind text not null default 'task' check (kind in ('task','study')),
 starts_at timestamptz,
 due_at timestamptz,
 duration_minutes integer check (duration_minutes between 5 and 600),
 repeat_rule text not null default 'none' check (repeat_rule in ('none','daily','weekly')),
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint planner_study_start check (kind <> 'study' or starts_at is not null),
 constraint planner_due_after_start check (starts_at is null or due_at is null or due_at >= starts_at)
);
create index if not exists student_personal_planner_owner_dates on public.student_personal_planner (owner_user_id, starts_at, due_at);
alter table public.student_personal_planner enable row level security;
revoke all on public.student_personal_planner from anon;
grant select,insert,update,delete on public.student_personal_planner to authenticated;
drop policy if exists student_planner_select on public.student_personal_planner;
drop policy if exists student_planner_insert on public.student_personal_planner;
drop policy if exists student_planner_update on public.student_personal_planner;
drop policy if exists student_planner_delete on public.student_personal_planner;
create policy student_planner_select on public.student_personal_planner for select to authenticated using ((select auth.uid()) = owner_user_id);
create policy student_planner_insert on public.student_personal_planner for insert to authenticated with check ((select auth.uid()) = owner_user_id);
create policy student_planner_update on public.student_personal_planner for update to authenticated using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id);
create policy student_planner_delete on public.student_personal_planner for delete to authenticated using ((select auth.uid()) = owner_user_id);
