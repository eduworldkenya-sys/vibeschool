-- VibeSchool legacy publication quarantine: owner-requested reversible stop.
-- Applies to canonical publication status transitions, including direct RPC or SQL writes.
-- Retains public SELECT and all existing published rows. Does not purge content.
-- Replacement activation is not implemented and is intentionally absent here.
-- Rollback only with explicit authorized release:
--   drop trigger if exists vs_legacy_publication_pause on public.vibe_publications;
--   drop trigger if exists vs_legacy_chapter_pause on public.vibe_chapters;
--   drop function if exists public.vs_guard_legacy_publication_transition();
-- Independent authorization is required before executing rollback.
create or replace function public.vs_guard_legacy_publication_transition()
returns trigger language plpgsql security invoker set search_path=public,pg_temp
as $vs_pause$
begin
  -- A publication cannot become or cease to be learner-visible through legacy
  -- status mutation while replacement publishing is not commissioned.
  if tg_op = 'INSERT' then
    if new.status in ('published','locked') then
      raise exception 'PUBLISHING_PAUSED: legacy publication changes are temporarily disabled'
        using errcode='42501';
    end if;
  elsif old.status is distinct from new.status
        and (old.status in ('published','locked') or new.status in ('published','locked')) then
    raise exception 'PUBLISHING_PAUSED: legacy publication changes are temporarily disabled'
      using errcode='42501';
  end if;
  return new;
end;
$vs_pause$;

revoke all on function public.vs_guard_legacy_publication_transition() from public,anon,authenticated;
drop trigger if exists vs_legacy_publication_pause on public.vibe_publications;
create trigger vs_legacy_publication_pause
before insert or update of status on public.vibe_publications
for each row execute function public.vs_guard_legacy_publication_transition();

drop trigger if exists vs_legacy_chapter_pause on public.vibe_chapters;
create trigger vs_legacy_chapter_pause
before insert or update of status on public.vibe_chapters
for each row execute function public.vs_guard_legacy_publication_transition();

comment on function public.vs_guard_legacy_publication_transition() is
'Temporary fail-closed legacy publication lifecycle pause. Does not authorize replacement publishing. Owner-approved reversible quarantine; retain learner reading.';

-- Static assertions: ensure both guards remain attached.
do $$
begin
 if not exists (select 1 from pg_trigger
    where tgrelid='public.vibe_publications'::regclass
      and tgname='vs_legacy_publication_pause' and not tgisinternal)
    or not exists (select 1 from pg_trigger
    where tgrelid='public.vibe_chapters'::regclass
      and tgname='vs_legacy_chapter_pause' and not tgisinternal)
 then raise exception 'LEGACY_PUBLISHING_PAUSE_INSTALL_FAILED'; end if;
end $$;
