begin;
alter table public.vibe_chapter_assignments alter column resource_id set not null;
commit;
