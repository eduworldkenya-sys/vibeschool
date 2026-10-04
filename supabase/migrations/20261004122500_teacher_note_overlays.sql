begin;

create table if not exists public.teacher_note_overlays (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  school_id uuid null references public.schools(id) on delete cascade,
  source_chapter_id uuid not null references public.vibe_chapters(id) on delete cascade,
  source_derivative_id uuid null references public.content_derivatives(id) on delete set null,
  lesson_plan_id uuid null references public.lesson_plans(id) on delete cascade,
  occurrence_id uuid null references public.teaching_occurrences(id) on delete cascade,
  note_kind text not null check (note_kind in ('concept','lesson')),
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_note_overlays_kind_target_check check (
    (note_kind='concept' and lesson_plan_id is null)
    or (note_kind='lesson' and lesson_plan_id is not null)
  )
);

create unique index if not exists uq_teacher_note_overlays_concept
  on public.teacher_note_overlays(teacher_id, source_chapter_id)
  where note_kind='concept';

create unique index if not exists uq_teacher_note_overlays_lesson
  on public.teacher_note_overlays(teacher_id, lesson_plan_id)
  where note_kind='lesson';

create index if not exists idx_teacher_note_overlays_teacher_chapter
  on public.teacher_note_overlays(teacher_id, source_chapter_id, updated_at desc);

create index if not exists idx_teacher_note_overlays_lesson
  on public.teacher_note_overlays(lesson_plan_id)
  where lesson_plan_id is not null;

alter table public.teacher_note_overlays enable row level security;

revoke all on table public.teacher_note_overlays from public, anon;
grant select, insert, update, delete on table public.teacher_note_overlays to authenticated;

drop policy if exists teacher_note_overlays_select_own on public.teacher_note_overlays;
create policy teacher_note_overlays_select_own
on public.teacher_note_overlays
for select
to authenticated
using ((select auth.uid()) = teacher_id);

drop policy if exists teacher_note_overlays_insert_own on public.teacher_note_overlays;
create policy teacher_note_overlays_insert_own
on public.teacher_note_overlays
for insert
to authenticated
with check (
  (select auth.uid()) = teacher_id
  and (
    lesson_plan_id is null
    or exists (
      select 1
      from public.lesson_plans lp
      where lp.id = lesson_plan_id
        and lp.teacher_id = (select auth.uid())
    )
  )
  and (
    occurrence_id is null
    or exists (
      select 1
      from public.teaching_occurrences o
      where o.id = occurrence_id
        and o.teacher_id = (select auth.uid())
    )
  )
);

drop policy if exists teacher_note_overlays_update_own on public.teacher_note_overlays;
create policy teacher_note_overlays_update_own
on public.teacher_note_overlays
for update
to authenticated
using ((select auth.uid()) = teacher_id)
with check (
  (select auth.uid()) = teacher_id
  and (
    lesson_plan_id is null
    or exists (
      select 1
      from public.lesson_plans lp
      where lp.id = lesson_plan_id
        and lp.teacher_id = (select auth.uid())
    )
  )
  and (
    occurrence_id is null
    or exists (
      select 1
      from public.teaching_occurrences o
      where o.id = occurrence_id
        and o.teacher_id = (select auth.uid())
    )
  )
);

drop policy if exists teacher_note_overlays_delete_own on public.teacher_note_overlays;
create policy teacher_note_overlays_delete_own
on public.teacher_note_overlays
for delete
to authenticated
using ((select auth.uid()) = teacher_id);

comment on table public.teacher_note_overlays is
  'Private teacher-owned annotations layered over shared canonical teacher notes. Concept overlays follow the teacher across lessons using the same source chapter; lesson overlays belong to one exact lesson plan/occurrence. Never a curriculum or lesson authority.';

commit;
