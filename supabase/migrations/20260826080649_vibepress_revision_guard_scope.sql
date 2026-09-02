-- Scope the live immutability guards introduced by the governed-revision migration
-- to VibePress only. Other publication formats keep their existing lifecycle rules.

create or replace function public.vibepress_assert_live_publication_immutable()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if old.format = 'vibepress'
     and old.status = 'published'
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
  if old.format = 'vibepress'
     and old.status = 'published'
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
declare
  v_publication_id uuid;
  v_format text;
  v_parent_status text;
begin
  v_publication_id := case when tg_op = 'DELETE' then old.publication_id else new.publication_id end;

  select p.format, p.status
    into v_format, v_parent_status
  from public.vibe_publications p
  where p.id = v_publication_id;

  if v_format <> 'vibepress' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if v_parent_status = 'published'
       and coalesce(current_setting('vibepress.revision_release', true), '') <> 'on'
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
  v_publication_id uuid;
  v_format text;
  v_parent_status text;
begin
  v_publication_id := case when tg_op = 'DELETE' then old.publication_id else new.publication_id end;

  select p.format, p.status
    into v_format, v_parent_status
  from public.vibe_publications p
  where p.id = v_publication_id;

  if v_format <> 'vibepress' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if v_parent_status = 'published'
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
