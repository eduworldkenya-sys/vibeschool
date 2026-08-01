begin;

create table if not exists public.content_engine_authorities (
  domain text primary key,
  authoritative_table text not null,
  authority_role text not null,
  derived_tables text[] not null default '{}',
  notes text,
  updated_at timestamptz not null default now(),
  constraint content_engine_authorities_domain_nonempty check (btrim(domain) <> ''),
  constraint content_engine_authorities_table_nonempty check (btrim(authoritative_table) <> ''),
  constraint content_engine_authorities_role_nonempty check (btrim(authority_role) <> '')
);

alter table public.content_engine_authorities enable row level security;

revoke all on table public.content_engine_authorities from public, anon, authenticated;
grant select, insert, update, delete on table public.content_engine_authorities to service_role;

insert into public.content_engine_authorities(domain, authoritative_table, authority_role, derived_tables, notes)
values
  ('publication', 'public.vibe_publications', 'Authoritative publication identity, ownership and lifecycle', array['public.vibelearn_content'], 'VibeLearn textbook rows are discovery indexes, not lifecycle authority.'),
  ('chapter', 'public.vibe_chapters', 'Authoritative publication chapter and chapter-to-publication relationship', array['public.learning_resources','public.scheme_lesson_resource_links','public.vibe_chapter_assignments','public.vibe_reading_progress'], 'All downstream chapter references must resolve to this table and the same publication.'),
  ('discovery_index', 'public.vibelearn_content', 'Derived searchable discovery index', array[]::text[], 'Textbook rows must reconcile from vibe_publications and must not independently control publication status.'),
  ('learning_resource', 'public.learning_resources', 'Normalized educational resource registry', array['public.scheme_lesson_resource_links'], 'Represents reusable publications, chapters and content objects through one resource contract.'),
  ('scheme_resource', 'public.scheme_lesson_resource_links', 'Authoritative planning-time link between a scheme lesson and publication chapter', array['public.vibe_chapter_assignments'], 'Must preserve publication/chapter identity and teacher ownership.'),
  ('classroom_assignment', 'public.vibe_chapter_assignments', 'Authoritative class delivery of a publication chapter', array['public.vibe_reading_progress'], 'Assignments should derive from an approved scheme resource link where applicable.'),
  ('reading_progress', 'public.vibe_reading_progress', 'Authoritative viewer progress for a publication chapter', array[]::text[], 'A later phase will add assignment-specific progress authority.')
on conflict (domain) do update
set authoritative_table = excluded.authoritative_table,
    authority_role = excluded.authority_role,
    derived_tables = excluded.derived_tables,
    notes = excluded.notes,
    updated_at = now();

create or replace function public.content_engine_integrity_audit()
returns table (
  check_key text,
  severity text,
  issue_count bigint,
  detail text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select 'published_publication_missing_index', 'critical', count(*),
         'Published publication has no textbook discovery-index row'
  from public.vibe_publications p
  where p.status = 'published'
    and not exists (
      select 1 from public.vibelearn_content c
      where c.type = 'textbook' and c.vibe_publication_id = p.id
    )

  union all
  select 'duplicate_textbook_index', 'critical', count(*),
         'More than one textbook discovery-index row points to the same publication'
  from (
    select vibe_publication_id
    from public.vibelearn_content
    where type = 'textbook' and vibe_publication_id is not null
    group by vibe_publication_id
    having count(*) > 1
  ) d

  union all
  select 'orphan_textbook_index', 'critical', count(*),
         'Textbook discovery-index row has no matching publication'
  from public.vibelearn_content c
  where c.type = 'textbook'
    and c.vibe_publication_id is not null
    and not exists (select 1 from public.vibe_publications p where p.id = c.vibe_publication_id)

  union all
  select 'textbook_index_status_mismatch', 'high', count(*),
         'Textbook discovery status differs from authoritative publication status'
  from public.vibelearn_content c
  join public.vibe_publications p on p.id = c.vibe_publication_id
  where c.type = 'textbook' and c.status is distinct from p.status

  union all
  select 'textbook_index_noncanonical_url', 'high', count(*),
         'Textbook discovery URL is not the canonical publication reader URL'
  from public.vibelearn_content c
  where c.type = 'textbook'
    and c.vibe_publication_id is not null
    and c.url is distinct from ('/read/textbook/' || c.vibe_publication_id::text)

  union all
  select 'chapter_publication_mismatch_scheme_link', 'critical', count(*),
         'Scheme resource link chapter belongs to a different publication'
  from public.scheme_lesson_resource_links l
  join public.vibe_chapters ch on ch.id = l.chapter_id
  where ch.publication_id <> l.publication_id

  union all
  select 'chapter_publication_mismatch_assignment', 'critical', count(*),
         'Classroom assignment chapter belongs to a different publication'
  from public.vibe_chapter_assignments a
  join public.vibe_chapters ch on ch.id = a.chapter_id
  where ch.publication_id <> a.publication_id

  union all
  select 'chapter_publication_mismatch_progress', 'critical', count(*),
         'Reading-progress chapter belongs to a different publication'
  from public.vibe_reading_progress r
  join public.vibe_chapters ch on ch.id = r.chapter_id
  where ch.publication_id <> r.publication_id

  union all
  select 'duplicate_scheme_resource_link', 'high', count(*),
         'Duplicate scheme lesson/publication/chapter/resource-role links exist'
  from (
    select scheme_lesson_id, publication_id, chapter_id, resource_role
    from public.scheme_lesson_resource_links
    group by scheme_lesson_id, publication_id, chapter_id, resource_role
    having count(*) > 1
  ) d

  union all
  select 'invalid_scheme_page_range', 'high', count(*),
         'Scheme resource page range is incomplete, non-positive or reversed'
  from public.scheme_lesson_resource_links l
  where (l.page_start is null) <> (l.page_end is null)
     or coalesce(l.page_start, 1) < 1
     or coalesce(l.page_end, 1) < 1
     or (l.page_start is not null and l.page_end < l.page_start)

  union all
  select 'reading_progress_out_of_range', 'high', count(*),
         'Reading progress percentage is outside 0..100'
  from public.vibe_reading_progress r
  where r.progress_percent < 0 or r.progress_percent > 100

  union all
  select 'assignment_due_before_assigned', 'high', count(*),
         'Classroom assignment due date precedes assignment date'
  from public.vibe_chapter_assignments a
  where a.due_at is not null and a.due_at < a.assigned_at;
$$;

revoke all on function public.content_engine_integrity_audit() from public, anon, authenticated;
grant execute on function public.content_engine_integrity_audit() to service_role;

comment on table public.content_engine_authorities is
  'CE-001 authority registry for the Vibeschool Content Engine. This records ownership of lifecycle and derived data; it is not user-facing content.';
comment on function public.content_engine_integrity_audit() is
  'Read-only CE-001 integrity audit. A zero issue_count for every row is required before later Content Engine constraints are enforced.';

commit;
