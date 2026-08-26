-- Governed VibePress revision lifecycle.
-- Published content is immutable to authenticated writers at the database boundary.
-- A revision is a private draft clone; the existing governed publication lifecycle
-- reviews/releases that draft, then this migration atomically swaps the approved
-- revision back onto the stable live publication id and retains revision history.
-- authorization-test: authenticated owners may create revisions only for their own
-- published VibePress publication; direct revision-table writes remain denied.

alter table public.publication_revisions
  add column if not exists working_publication_id uuid references public.vibe_publications(id) on delete set null,
  add column if not exists state text not null default 'released',
  add column if not exists base_published_at timestamptz,
  add column if not exists released_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'publication_revisions_state_check'
      and conrelid = 'public.publication_revisions'::regclass
  ) then
    alter table public.publication_revisions
      add constraint publication_revisions_state_check
      check (state in ('draft','released','superseded','abandoned'));
  end if;
end $$;

create unique index if not exists publication_revisions_working_publication_uidx
  on public.publication_revisions (working_publication_id)
  where working_publication_id is not null;

create unique index if not exists publication_revisions_one_open_revision_uidx
  on public.publication_revisions (publication_id)
  where state = 'draft';

-- Fail closed for already-live rows. Initial draft -> published transitions remain
-- allowed so the governed publication lifecycle can complete. Internal revision
-- release uses a transaction-local guard set only by the database trigger below.
create or replace function public.vibepress_assert_live_publication_immutable()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if old.status = 'published'
     and coalesce(current_setting('vibepress.revision_release', true), '') <> 'on'
     and auth.uid() is not null then
    raise exception 'VIBEPRESS_LIVE_PUBLICATION_IMMUTABLE: create a governed revision';
  end if;
  return new;
end;
$$;

create or replace function public.vibepress_assert_live_publication_delete_immutable()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if old.status = 'published'
     and coalesce(current_setting('vibepress.revision_release', true), '') <> 'on'
     and auth.uid() is not null then
    raise exception 'VIBEPRESS_LIVE_PUBLICATION_IMMUTABLE: create a governed revision';
  end if;
  return old;
end;
$$;

create or replace function public.vibepress_assert_live_chapter_immutable()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if exists (
      select 1 from public.vibe_publications p
      where p.id = new.publication_id and p.status = 'published'
    ) and coalesce(current_setting('vibepress.revision_release', true), '') <> 'on'
      and auth.uid() is not null then
      raise exception 'VIBEPRESS_LIVE_CHAPTER_IMMUTABLE: create a governed revision';
    end if;
    return new;
  end if;

  if old.status = 'published'
     and coalesce(current_setting('vibepress.revision_release', true), '') <> 'on'
     and auth.uid() is not null then
    raise exception 'VIBEPRESS_LIVE_CHAPTER_IMMUTABLE: create a governed revision';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.vibepress_assert_live_block_immutable()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  if tg_op = 'INSERT' then
    if new.chapter_id is not null then
      select c.status into v_status from public.vibe_chapters c where c.id = new.chapter_id;
    end if;
    if v_status = 'published'
       and coalesce(current_setting('vibepress.revision_release', true), '') <> 'on'
       and auth.uid() is not null then
      raise exception 'VIBEPRESS_LIVE_BLOCK_IMMUTABLE: create a governed revision';
    end if;
    return new;
  end if;

  if old.status = 'published'
     and coalesce(current_setting('vibepress.revision_release', true), '') <> 'on'
     and auth.uid() is not null then
    raise exception 'VIBEPRESS_LIVE_BLOCK_IMMUTABLE: create a governed revision';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists vibepress_live_publication_update_guard on public.vibe_publications;
create trigger vibepress_live_publication_update_guard
before update on public.vibe_publications
for each row execute function public.vibepress_assert_live_publication_immutable();

drop trigger if exists vibepress_live_publication_delete_guard on public.vibe_publications;
create trigger vibepress_live_publication_delete_guard
before delete on public.vibe_publications
for each row execute function public.vibepress_assert_live_publication_delete_immutable();

drop trigger if exists vibepress_live_chapter_guard on public.vibe_chapters;
create trigger vibepress_live_chapter_guard
before insert or update or delete on public.vibe_chapters
for each row execute function public.vibepress_assert_live_chapter_immutable();

drop trigger if exists vibepress_live_block_guard on public.content_blocks;
create trigger vibepress_live_block_guard
before insert or update or delete on public.content_blocks
for each row execute function public.vibepress_assert_live_block_immutable();

create or replace function public.vibepress_create_revision(p_publication_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_source public.vibe_publications%rowtype;
  v_working_id uuid := gen_random_uuid();
  v_revision_number integer;
  v_snapshot jsonb;
begin
  if v_actor is null then
    raise exception 'VIBEPRESS_REVISION_AUTH_REQUIRED';
  end if;

  select * into v_source
  from public.vibe_publications
  where id = p_publication_id
  for share;

  if not found or v_source.author_id <> v_actor then
    raise exception 'VIBEPRESS_REVISION_NOT_OWNER';
  end if;
  if v_source.format <> 'vibepress' then
    raise exception 'VIBEPRESS_REVISION_FORMAT_REQUIRED';
  end if;
  if v_source.status <> 'published' then
    raise exception 'VIBEPRESS_REVISION_SOURCE_NOT_PUBLISHED';
  end if;
  if exists (
    select 1 from public.publication_revisions r
    where r.publication_id = p_publication_id and r.state = 'draft'
  ) then
    select r.working_publication_id into v_working_id
    from public.publication_revisions r
    where r.publication_id = p_publication_id and r.state = 'draft'
    order by r.revision_number desc limit 1;
    return v_working_id;
  end if;

  select coalesce(max(revision_number), 0) + 1
    into v_revision_number
  from public.publication_revisions
  where publication_id = p_publication_id;

  select jsonb_build_object(
    'publication', to_jsonb(v_source),
    'chapters', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.number)
      from public.vibe_chapters c
      where c.publication_id = p_publication_id
    ), '[]'::jsonb)
  ) into v_snapshot;

  insert into public.vibe_publications (
    id, author_id, format, title, subtitle, cover_url, description, genre, tags,
    language, status, pricing, chapter_count, total_reads, cbc_subject, cbc_grade,
    cbc_aligned, series_name, series_number, publication_name, issue_number,
    published_at, total_vibes, earnings_ksh, curriculum_framework
  ) values (
    v_working_id, v_source.author_id, v_source.format, v_source.title,
    v_source.subtitle, v_source.cover_url, v_source.description, v_source.genre,
    v_source.tags, v_source.language, 'draft', v_source.pricing,
    v_source.chapter_count, 0, v_source.cbc_subject, v_source.cbc_grade,
    v_source.cbc_aligned, v_source.series_name, v_source.series_number,
    v_source.publication_name, v_source.issue_number, null, 0, 0,
    v_source.curriculum_framework
  );

  insert into public.vibe_chapters (
    publication_id, title, number, blocks, status, word_count, reading_time_min,
    learning_outcomes, cbc_strand, published_at, sub_strand_id, curriculum_id,
    curriculum_content_id, content_pack_version, alignment_status,
    verified_by, verified_at, verification_notes
  )
  select
    v_working_id, c.title, c.number, c.blocks, 'draft', c.word_count,
    c.reading_time_min, c.learning_outcomes, c.cbc_strand, null,
    c.sub_strand_id, c.curriculum_id, c.curriculum_content_id,
    c.content_pack_version,
    case when c.alignment_status = 'verified' then 'creator_claimed' else c.alignment_status end,
    null, null,
    case when c.alignment_status = 'verified'
      then 'Revision created from previously verified live content; re-verification required after edits.'
      else c.verification_notes end
  from public.vibe_chapters c
  where c.publication_id = p_publication_id
  order by c.number;

  insert into public.publication_revisions (
    publication_id, revision_number, snapshot, created_by, reason,
    working_publication_id, state, base_published_at
  ) values (
    p_publication_id, v_revision_number, v_snapshot, v_actor,
    'Governed VibePress revision', v_working_id, 'draft', v_source.published_at
  );

  return v_working_id;
end;
$$;

revoke all on function public.vibepress_create_revision(uuid) from public, anon;
grant execute on function public.vibepress_create_revision(uuid) to authenticated;

-- When the existing governed release lifecycle publishes an approved working copy,
-- atomically replace the stable live publication contents and archive the temporary
-- working copy. The public live publication id therefore never changes.
create or replace function public.vibepress_apply_released_revision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_revision public.publication_revisions%rowtype;
  v_now timestamptz := now();
begin
  if old.status = 'published' or new.status <> 'published' then
    return new;
  end if;

  select * into v_revision
  from public.publication_revisions r
  where r.working_publication_id = new.id
    and r.state = 'draft'
  for update;

  if not found then
    return new;
  end if;

  perform set_config('vibepress.revision_release', 'on', true);

  -- Replace mutable editorial fields on the stable source row while preserving
  -- identity, readership counters and the original author.
  update public.vibe_publications live
  set title = new.title,
      subtitle = new.subtitle,
      cover_url = new.cover_url,
      description = new.description,
      genre = new.genre,
      tags = new.tags,
      language = new.language,
      pricing = new.pricing,
      chapter_count = new.chapter_count,
      cbc_subject = new.cbc_subject,
      cbc_grade = new.cbc_grade,
      cbc_aligned = new.cbc_aligned,
      series_name = new.series_name,
      series_number = new.series_number,
      publication_name = new.publication_name,
      issue_number = new.issue_number,
      curriculum_framework = new.curriculum_framework,
      status = 'published',
      published_at = v_now,
      updated_at = v_now
  where live.id = v_revision.publication_id;

  delete from public.vibe_chapters
  where publication_id = v_revision.publication_id;

  insert into public.vibe_chapters (
    publication_id, title, number, blocks, status, word_count, reading_time_min,
    learning_outcomes, cbc_strand, published_at, sub_strand_id, curriculum_id,
    curriculum_content_id, content_pack_version, alignment_status,
    verified_by, verified_at, verification_notes
  )
  select
    v_revision.publication_id, c.title, c.number, c.blocks, 'published',
    c.word_count, c.reading_time_min, c.learning_outcomes, c.cbc_strand,
    v_now, c.sub_strand_id, c.curriculum_id, c.curriculum_content_id,
    c.content_pack_version, c.alignment_status, c.verified_by, c.verified_at,
    c.verification_notes
  from public.vibe_chapters c
  where c.publication_id = new.id
  order by c.number;

  update public.publication_revisions
  set state = 'released',
      released_at = v_now,
      snapshot = snapshot || jsonb_build_object(
        'released_working_publication_id', new.id,
        'released_at', v_now
      )
  where id = v_revision.id;

  update public.vibe_publications
  set status = 'archived', updated_at = v_now
  where id = new.id;

  return new;
end;
$$;

revoke all on function public.vibepress_apply_released_revision() from public, anon, authenticated;

drop trigger if exists vibepress_apply_released_revision on public.vibe_publications;
create trigger vibepress_apply_released_revision
after update of status on public.vibe_publications
for each row
when (old.status is distinct from new.status and new.status = 'published')
execute function public.vibepress_apply_released_revision();
