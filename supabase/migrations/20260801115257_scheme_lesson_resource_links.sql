-- Migration: scheme_lesson_resource_links
-- Links scheme_of_work lesson rows to vibe_publications/vibe_chapters
-- for curriculum-aware textbook integration (planning layer).

-- Production already had this shared updated_at trigger helper before this
-- migration entered the tracked chain. Define it here when absent so a blank
-- rebuild has the same prerequisite without changing populated production.
create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.scheme_lesson_resource_links (
  id uuid primary key default gen_random_uuid(),
  scheme_lesson_id uuid not null references public.scheme_of_work(id) on delete cascade,
  publication_id uuid not null references public.vibe_publications(id) on delete restrict,
  chapter_id uuid not null references public.vibe_chapters(id) on delete restrict,
  resource_role text not null check (resource_role in ('teacher_reference','before_class','in_class','after_class','homework')),
  sequence integer not null default 1 check (sequence > 0),
  page_start integer,
  page_end integer,
  exercise_refs jsonb not null default '[]'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_scheme_resource_pages check (
    (page_start is null and page_end is null)
    or (page_start is not null and page_start > 0 and (page_end is null or page_end >= page_start))
  ),
  constraint chk_exercise_refs_array check (jsonb_typeof(exercise_refs) = 'array'),
  constraint uq_scheme_lesson_chapter_role unique (scheme_lesson_id, chapter_id, resource_role)
);

alter table public.scheme_lesson_resource_links enable row level security;

create index if not exists idx_scheme_resource_links_scheme on public.scheme_lesson_resource_links(scheme_lesson_id);
create index if not exists idx_scheme_resource_links_chapter on public.scheme_lesson_resource_links(chapter_id);
create index if not exists idx_scheme_resource_links_publication on public.scheme_lesson_resource_links(publication_id);

create or replace function public.chk_chapter_publication_match()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if (select publication_id from public.vibe_chapters where id = new.chapter_id) != new.publication_id then
    raise exception 'chapter_id % does not belong to publication_id %', new.chapter_id, new.publication_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_chk_chapter_publication_match on public.scheme_lesson_resource_links;
create trigger trg_chk_chapter_publication_match
  before insert or update on public.scheme_lesson_resource_links
  for each row execute function public.chk_chapter_publication_match();

drop trigger if exists trg_scheme_resource_links_updated_at on public.scheme_lesson_resource_links;
create trigger trg_scheme_resource_links_updated_at
  before update on public.scheme_lesson_resource_links
  for each row execute function public.fn_set_updated_at();

drop policy if exists scheme_link_teacher_own on public.scheme_lesson_resource_links;
create policy scheme_link_teacher_own
  on public.scheme_lesson_resource_links
  for all
  using (exists (select 1 from public.scheme_of_work sow where sow.id = scheme_lesson_resource_links.scheme_lesson_id and sow.teacher_id = (select auth.uid())))
  with check (exists (select 1 from public.scheme_of_work sow where sow.id = scheme_lesson_resource_links.scheme_lesson_id and sow.teacher_id = (select auth.uid())));

drop policy if exists scheme_link_admin on public.scheme_lesson_resource_links;
create policy scheme_link_admin
  on public.scheme_lesson_resource_links
  for all
  using (exists (select 1 from public.scheme_of_work sow where sow.id = scheme_lesson_resource_links.scheme_lesson_id and public.is_school_admin(sow.school_id)))
  with check (exists (select 1 from public.scheme_of_work sow where sow.id = scheme_lesson_resource_links.scheme_lesson_id and public.is_school_admin(sow.school_id)));

drop policy if exists scheme_link_member_read on public.scheme_lesson_resource_links;
create policy scheme_link_member_read
  on public.scheme_lesson_resource_links
  for select
  using (exists (select 1 from public.scheme_of_work sow join public.school_members sm on sm.school_id = sow.school_id where sow.id = scheme_lesson_resource_links.scheme_lesson_id and sm.profile_id = (select auth.uid())));
