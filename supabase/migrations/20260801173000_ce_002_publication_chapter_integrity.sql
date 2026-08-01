begin;

update public.vibe_publications p
set chapter_count = x.actual_count,
    updated_at = coalesce(p.updated_at, now())
from (
  select p2.id, count(c.id)::integer as actual_count
  from public.vibe_publications p2
  left join public.vibe_chapters c on c.publication_id = p2.id
  group by p2.id
) x
where p.id = x.id
  and coalesce(p.chapter_count, 0) is distinct from x.actual_count;

update public.vibe_publications
set published_at = coalesce(updated_at, created_at, now())
where status = 'published' and published_at is null;

update public.vibe_chapters
set published_at = coalesce(updated_at, created_at, now())
where status = 'published' and published_at is null;

update public.vibe_publications set status = 'draft' where status is null;
update public.vibe_publications set chapter_count = 0 where chapter_count is null;
update public.vibe_publications set created_at = now() where created_at is null;
update public.vibe_publications set updated_at = coalesce(created_at, now()) where updated_at is null;

update public.vibe_chapters set status = 'draft' where status is null;
update public.vibe_chapters set created_at = now() where created_at is null;
update public.vibe_chapters set updated_at = coalesce(created_at, now()) where updated_at is null;
update public.vibe_chapters set blocks = '[]'::jsonb where blocks is null;
update public.vibe_chapters set learning_outcomes = '{}'::text[] where learning_outcomes is null;
update public.vibe_chapters set word_count = 0 where word_count is null;
update public.vibe_chapters set reading_time_min = 0 where reading_time_min is null;

alter table public.vibe_publications
  alter column title set not null,
  alter column status set default 'draft',
  alter column status set not null,
  alter column chapter_count set default 0,
  alter column chapter_count set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.vibe_chapters
  alter column status set default 'draft',
  alter column status set not null,
  alter column blocks set default '[]'::jsonb,
  alter column blocks set not null,
  alter column learning_outcomes set default '{}'::text[],
  alter column learning_outcomes set not null,
  alter column word_count set default 0,
  alter column word_count set not null,
  alter column reading_time_min set default 0,
  alter column reading_time_min set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.vibe_publications
  drop constraint if exists vibe_publications_status_check,
  add constraint vibe_publications_status_check check (status in ('draft','published','unpublished','archived')),
  drop constraint if exists vibe_publications_format_check,
  add constraint vibe_publications_format_check check (format in ('ebook','vibepress','vibetextbook')),
  drop constraint if exists vibe_publications_title_nonempty,
  add constraint vibe_publications_title_nonempty check (btrim(title) <> ''),
  drop constraint if exists vibe_publications_chapter_count_nonnegative,
  add constraint vibe_publications_chapter_count_nonnegative check (chapter_count >= 0),
  drop constraint if exists vibe_publications_published_timestamp_check,
  add constraint vibe_publications_published_timestamp_check check (status <> 'published' or published_at is not null);

alter table public.vibe_chapters
  drop constraint if exists vibe_chapters_status_check,
  add constraint vibe_chapters_status_check check (status in ('draft','published','unpublished','archived')),
  drop constraint if exists vibe_chapters_alignment_status_check,
  add constraint vibe_chapters_alignment_status_check check (alignment_status in ('unclaimed','creator_claimed','verified','rejected')),
  drop constraint if exists vibe_chapters_number_positive,
  add constraint vibe_chapters_number_positive check (number > 0),
  drop constraint if exists vibe_chapters_word_count_nonnegative,
  add constraint vibe_chapters_word_count_nonnegative check (word_count >= 0),
  drop constraint if exists vibe_chapters_reading_time_nonnegative,
  add constraint vibe_chapters_reading_time_nonnegative check (reading_time_min >= 0),
  drop constraint if exists vibe_chapters_published_timestamp_check,
  add constraint vibe_chapters_published_timestamp_check check (status <> 'published' or published_at is not null),
  drop constraint if exists vibe_chapters_verified_metadata_check,
  add constraint vibe_chapters_verified_metadata_check check (alignment_status <> 'verified' or (verified_by is not null and verified_at is not null));

create unique index if not exists vibe_chapters_publication_number_uidx
  on public.vibe_chapters(publication_id, number);

create or replace function public.ce_set_publication_lifecycle_timestamps()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  if new.status = 'published' and (old.status is distinct from 'published' or new.published_at is null) then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;

create or replace function public.ce_set_chapter_lifecycle_timestamps()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  if new.status = 'published' and (old.status is distinct from 'published' or new.published_at is null) then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;

create or replace function public.ce_sync_publication_chapter_count()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare affected_publication uuid;
begin
  affected_publication := coalesce(new.publication_id, old.publication_id);
  if tg_op = 'UPDATE' and old.publication_id is distinct from new.publication_id then
    update public.vibe_publications p
    set chapter_count = (select count(*)::integer from public.vibe_chapters c where c.publication_id = old.publication_id),
        updated_at = now()
    where p.id = old.publication_id;
  end if;
  update public.vibe_publications p
  set chapter_count = (select count(*)::integer from public.vibe_chapters c where c.publication_id = affected_publication),
      updated_at = now()
  where p.id = affected_publication;
  return coalesce(new, old);
end;
$$;

revoke all on function public.ce_sync_publication_chapter_count() from public, anon, authenticated;
grant execute on function public.ce_sync_publication_chapter_count() to service_role;

create or replace function public.ce_validate_chapter_publication_state()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare parent_status text;
begin
  select status into parent_status from public.vibe_publications where id = new.publication_id;
  if parent_status is null then raise exception 'Publication % does not exist', new.publication_id; end if;
  if new.status = 'published' and parent_status <> 'published' then
    raise exception 'A chapter cannot be published while its publication status is %', parent_status;
  end if;
  return new;
end;
$$;

drop trigger if exists ce_publication_lifecycle_timestamps on public.vibe_publications;
create trigger ce_publication_lifecycle_timestamps before update on public.vibe_publications
for each row execute function public.ce_set_publication_lifecycle_timestamps();

drop trigger if exists ce_chapter_lifecycle_timestamps on public.vibe_chapters;
create trigger ce_chapter_lifecycle_timestamps before update on public.vibe_chapters
for each row execute function public.ce_set_chapter_lifecycle_timestamps();

drop trigger if exists ce_validate_chapter_publication_state on public.vibe_chapters;
create trigger ce_validate_chapter_publication_state before insert or update of publication_id, status on public.vibe_chapters
for each row execute function public.ce_validate_chapter_publication_state();

drop trigger if exists ce_sync_publication_chapter_count on public.vibe_chapters;
create trigger ce_sync_publication_chapter_count after insert or delete or update of publication_id on public.vibe_chapters
for each row execute function public.ce_sync_publication_chapter_count();

comment on function public.ce_sync_publication_chapter_count() is
  'CE-002 keeps vibe_publications.chapter_count derived from authoritative vibe_chapters rows.';

commit;
