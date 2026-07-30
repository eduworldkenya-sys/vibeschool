create table if not exists public.vibe_chapter_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  school_id uuid not null references public.schools(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete cascade,
  publication_id uuid not null references public.vibe_publications(id) on delete cascade,
  chapter_id uuid not null references public.vibe_chapters(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  due_at timestamptz null,
  status text not null default 'assigned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vibe_chapter_assignments_status_check check (status in ('assigned','cancelled')),
  constraint vibe_chapter_assignments_due_check check (due_at is null or due_at >= assigned_at),
  constraint vibe_chapter_assignments_unique_active unique nulls not distinct (teacher_id,class_id,chapter_id,due_at)
);

create index if not exists vibe_chapter_assignments_class_idx
  on public.vibe_chapter_assignments (class_id,status,due_at);
create index if not exists vibe_chapter_assignments_teacher_idx
  on public.vibe_chapter_assignments (teacher_id,assigned_at desc);
create index if not exists vibe_chapter_assignments_chapter_idx
  on public.vibe_chapter_assignments (chapter_id);

create or replace function public.set_vibe_chapter_assignment_updated_at()
returns trigger language plpgsql security invoker set search_path=public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_vibe_chapter_assignment_updated_at on public.vibe_chapter_assignments;
create trigger set_vibe_chapter_assignment_updated_at
before update on public.vibe_chapter_assignments
for each row execute function public.set_vibe_chapter_assignment_updated_at();

alter table public.vibe_chapter_assignments enable row level security;

drop policy if exists vibe_chapter_assignments_teacher_select on public.vibe_chapter_assignments;
create policy vibe_chapter_assignments_teacher_select
on public.vibe_chapter_assignments
for select to authenticated
using (teacher_id = auth.uid());

drop policy if exists vibe_chapter_assignments_linked_learner_select on public.vibe_chapter_assignments;
create policy vibe_chapter_assignments_linked_learner_select
on public.vibe_chapter_assignments
for select to authenticated
using (
  status='assigned'
  and exists (
    select 1
    from public.student_classes sc
    join public.students s on s.id=sc.student_id
    where sc.class_id=vibe_chapter_assignments.class_id
      and sc.school_id=vibe_chapter_assignments.school_id
      and sc.is_current=true
      and sc.left_at is null
      and s.profile_id=auth.uid()
      and s.deleted_at is null
  )
);

revoke all on table public.vibe_chapter_assignments from public,anon,authenticated;
grant select on table public.vibe_chapter_assignments to authenticated;
grant all on table public.vibe_chapter_assignments to service_role;

revoke all on function public.set_vibe_chapter_assignment_updated_at() from public,anon,authenticated;
grant execute on function public.set_vibe_chapter_assignment_updated_at() to service_role;

comment on table public.vibe_chapter_assignments is
'Canonical READ-008 classroom assignment authority. Teacher ownership uses profiles.id/auth.uid(); learner visibility resolves student_classes.student_id through students.profile_id without fabricating identities.';
