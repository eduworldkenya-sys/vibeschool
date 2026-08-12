-- TBL-011 reproducible-baseline prerequisite.
--
-- public.parent_messages predates the tracked migration chain. This base
-- definition is derived from the live production catalog with the later
-- LP-002A2B additions (lesson_plan_id, delivery_purpose and their constraints/
-- indexes) deliberately excluded so 20260804064246 remains their owner.

create table if not exists public.parent_messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  channel text not null default 'sms',
  subject text,
  body text not null,
  generated_by text not null default 'manual',
  sent_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  constraint parent_messages_body_check check (length(trim(body)) > 0)
);

create index if not exists idx_parent_messages_school
  on public.parent_messages (school_id);
create index if not exists idx_parent_messages_teacher
  on public.parent_messages (teacher_id);
create index if not exists idx_parent_messages_student
  on public.parent_messages (student_id);

alter table public.parent_messages enable row level security;

-- Reconstruct the established access contract for the pretracked table.
drop policy if exists pol_parent_messages_insert on public.parent_messages;
create policy pol_parent_messages_insert
  on public.parent_messages
  for insert
  with check (teacher_id = auth.uid());

drop policy if exists pol_parent_messages_select on public.parent_messages;
create policy pol_parent_messages_select
  on public.parent_messages
  for select
  using (
    teacher_id = auth.uid()
    or exists (
      select 1
      from public.parent_student_links psl
      where psl.student_id = parent_messages.student_id
        and psl.parent_id = auth.uid()
    )
    or exists (
      select 1
      from public.school_members sm
      where sm.school_id = parent_messages.school_id
        and sm.profile_id = auth.uid()
        and sm.role::text in ('owner', 'admin')
    )
  );
