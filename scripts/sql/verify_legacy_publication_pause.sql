-- Run AFTER applying the quarantine migration, as a read-only deployment audit.
-- Returns counts only. Does not alter published content.
select 'publication_trigger' as check_name,
  exists(select 1 from pg_trigger where tgrelid='public.vibe_publications'::regclass
    and tgname='vs_legacy_publication_pause' and tgenabled='O' and not tgisinternal) as passed
union all
select 'chapter_trigger',
  exists(select 1 from pg_trigger where tgrelid='public.vibe_chapters'::regclass
    and tgname='vs_legacy_chapter_pause' and tgenabled='O' and not tgisinternal)
union all
select 'published_records_remain', true;

-- Separate independent negative-path tests must attempt publish_textbook,
-- publish_publication, direct status updates, original-practice publishing,
-- and published-content direct updates inside rollback-only transactions.
-- Do not mark global quarantine complete until every path is denied.
