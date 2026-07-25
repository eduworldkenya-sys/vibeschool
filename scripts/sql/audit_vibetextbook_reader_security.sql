-- ============================================================================
-- VIBETEXTBOOK READER SECURITY AUDIT
-- Run this in Supabase SQL Editor before applying the hardening migration.
-- Read-only: this file does not modify the database.
-- ============================================================================

-- 1. Relevant columns
select
  table_schema,
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'vibe_publications',
    'vibe_chapters',
    'vibe_publication_views',
    'vibelearn_content'
  )
order by table_name, ordinal_position;

-- 2. Constraints and foreign-key delete behavior
select
  con.conname as constraint_name,
  con.contype as constraint_type,
  rel.relname as table_name,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel
  on rel.oid = con.conrelid
join pg_namespace nsp
  on nsp.oid = rel.relnamespace
where nsp.nspname = 'public'
  and rel.relname in (
    'vibe_publications',
    'vibe_chapters',
    'vibe_publication_views',
    'vibelearn_content'
  )
order by rel.relname, con.conname;

-- 3. Indexes
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'vibe_publications',
    'vibe_chapters',
    'vibe_publication_views',
    'vibelearn_content'
  )
order by tablename, indexname;

-- 4. RLS enabled state
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n
  on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'vibe_publications',
    'vibe_chapters',
    'vibe_publication_views',
    'vibelearn_content'
  )
order by c.relname;

-- 5. RLS policies
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'vibe_publications',
    'vibe_chapters',
    'vibe_publication_views',
    'vibelearn_content'
  )
order by tablename, policyname;

-- 6. Functions used by the reader
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'increment_publication_reads',
    'get_vibetextbook_reader'
  )
order by p.proname;

-- 7. Triggers
select
  event_object_schema,
  event_object_table,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in (
    'vibe_publications',
    'vibe_chapters',
    'vibe_publication_views',
    'vibelearn_content'
  )
order by event_object_table, trigger_name;

-- 8. Publication and chapter commercial-state audit
select
  p.id,
  p.title,
  p.format,
  p.status as publication_status,
  p.pricing,
  p.author_id,
  count(c.id) as chapter_count,
  count(*) filter (where c.status = 'published') as published_chapters,
  count(*) filter (where c.status = 'locked') as locked_chapters,
  count(*) filter (where c.status = 'draft') as draft_chapters
from public.vibe_publications p
left join public.vibe_chapters c
  on c.publication_id = p.id
where p.format = 'vibetextbook'
group by
  p.id,
  p.title,
  p.format,
  p.status,
  p.pricing,
  p.author_id
order by p.created_at;

-- 9. Find potentially exposed paid publications whose chapters are marked
-- published instead of locked.
select
  p.id as publication_id,
  p.title,
  p.pricing,
  c.id as chapter_id,
  c.number,
  c.title as chapter_title,
  c.status
from public.vibe_publications p
join public.vibe_chapters c
  on c.publication_id = p.id
where p.format = 'vibetextbook'
  and p.status = 'published'
  and coalesce(p.pricing->>'type', 'free') in ('paid', 'school_license')
  and c.status = 'published'
order by p.title, c.number;

-- 10. Current indexed textbook destinations
select
  id,
  title,
  type,
  url,
  vibe_publication_id,
  status,
  view_count,
  earnings_ksh
from public.vibelearn_content
where type = 'textbook'
   or vibe_publication_id is not null
order by created_at;
