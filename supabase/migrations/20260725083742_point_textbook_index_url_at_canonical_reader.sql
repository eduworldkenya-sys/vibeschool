-- The canonical textbook reader now lives at /read/textbook/[publicationId]
-- (role-neutral, not under /global or /teacher). Point both sync functions
-- and the existing indexed rows at it instead of the old
-- /global/read/publication/[id] workaround path. getContentDestination()
-- ignores url for type='textbook' going forward and uses
-- vibe_publication_id instead — this update is for data hygiene / any
-- caller that hasn't been migrated to the helper yet, not a behavior change.

create or replace function public.sync_vibelearn_textbook_index(p_publication_id uuid)
returns table(content_id uuid, operation text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pub         record;
  v_school_id   uuid;
  v_subject_id  uuid;
  v_status      text;
  v_existing_id uuid;
  v_result_id   uuid;
  v_op          text;
begin
  select p.author_id, p.format, p.title, p.description, p.status,
         p.cbc_subject, p.tags, p.cover_url
  into v_pub
  from public.vibe_publications p
  where p.id = p_publication_id;

  if not found then
    raise exception 'Publication % not found', p_publication_id;
  end if;

  if v_pub.format <> 'vibetextbook' then
    raise exception 'Publication % is format %, not vibetextbook — this sync only bridges textbooks', p_publication_id, v_pub.format;
  end if;

  if auth.uid() is distinct from v_pub.author_id then
    raise exception 'Not authorized to sync publication %', p_publication_id;
  end if;

  select coalesce(sm.school_id, tp.school_id)
  into v_school_id
  from (select 1) as _dummy
  left join public.school_members sm on sm.profile_id = v_pub.author_id
  left join public.teacher_profiles tp on tp.profile_id = v_pub.author_id
  limit 1;

  select s.id into v_subject_id
  from public.subjects s
  where lower(s.name) = lower(coalesce(v_pub.cbc_subject, ''))
  limit 2;

  if (
    select count(*)
    from public.subjects s
    where lower(s.name) = lower(coalesce(v_pub.cbc_subject,''))
  ) <> 1 then
    v_subject_id := null;
  end if;

  v_status := case when v_pub.status = 'published' then 'live' else 'draft' end;

  select id into v_existing_id
  from public.vibelearn_content
  where vibe_publication_id = p_publication_id;

  insert into public.vibelearn_content (
    title, description, subject_id, type, url, thumbnail_url,
    tags, source, submitted_by, school_id, status, vibe_publication_id
  )
  values (
    coalesce(v_pub.title, 'Untitled Textbook'),
    v_pub.description,
    v_subject_id,
    'textbook',
    '/read/textbook/' || p_publication_id::text,
    nullif(v_pub.cover_url, ''),
    coalesce(v_pub.tags, '{}'),
    'vibetextbook',
    v_pub.author_id,
    v_school_id,
    v_status,
    p_publication_id
  )
  on conflict (vibe_publication_id) where vibe_publication_id is not null do update
    set title         = excluded.title,
        description   = excluded.description,
        subject_id    = excluded.subject_id,
        thumbnail_url = excluded.thumbnail_url,
        tags           = excluded.tags,
        source         = excluded.source,
        school_id      = excluded.school_id,
        status         = excluded.status,
        url            = excluded.url,
        updated_at     = now()
  returning id into v_result_id;

  v_op := case when v_existing_id is null then 'inserted' else 'updated' end;

  return query select v_result_id, v_op;
end;
$$;

create or replace function public.admin_reconcile_vibelearn_textbook_index(p_publication_id uuid)
returns table(content_id uuid, operation text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pub         record;
  v_school_id   uuid;
  v_subject_id  uuid;
  v_status      text;
  v_existing_id uuid;
  v_result_id   uuid;
  v_op          text;
begin
  select p.author_id, p.format, p.title, p.description, p.status,
         p.cbc_subject, p.tags, p.cover_url
  into v_pub
  from public.vibe_publications p
  where p.id = p_publication_id;

  if not found then
    raise exception 'Publication % not found', p_publication_id;
  end if;

  if v_pub.format <> 'vibetextbook' then
    raise exception 'Publication % is format %, not vibetextbook', p_publication_id, v_pub.format;
  end if;

  select coalesce(sm.school_id, tp.school_id)
  into v_school_id
  from (select 1) as _dummy
  left join public.school_members sm on sm.profile_id = v_pub.author_id
  left join public.teacher_profiles tp on tp.profile_id = v_pub.author_id
  limit 1;

  select s.id into v_subject_id
  from public.subjects s
  where lower(s.name) = lower(coalesce(v_pub.cbc_subject, ''))
  limit 2;

  if (
    select count(*)
    from public.subjects s
    where lower(s.name) = lower(coalesce(v_pub.cbc_subject,''))
  ) <> 1 then
    v_subject_id := null;
  end if;

  v_status := case when v_pub.status = 'published' then 'live' else 'draft' end;

  select id into v_existing_id
  from public.vibelearn_content
  where vibe_publication_id = p_publication_id;

  insert into public.vibelearn_content (
    title, description, subject_id, type, url, thumbnail_url,
    tags, source, submitted_by, school_id, status, vibe_publication_id
  )
  values (
    coalesce(v_pub.title, 'Untitled Textbook'),
    v_pub.description,
    v_subject_id,
    'textbook',
    '/read/textbook/' || p_publication_id::text,
    nullif(v_pub.cover_url, ''),
    coalesce(v_pub.tags, '{}'),
    'vibetextbook',
    v_pub.author_id,
    v_school_id,
    v_status,
    p_publication_id
  )
  on conflict (vibe_publication_id) where vibe_publication_id is not null do update
    set title         = excluded.title,
        description   = excluded.description,
        subject_id    = excluded.subject_id,
        thumbnail_url = excluded.thumbnail_url,
        tags           = excluded.tags,
        source         = excluded.source,
        school_id      = excluded.school_id,
        status         = excluded.status,
        url            = excluded.url,
        updated_at     = now()
  returning id into v_result_id;

  v_op := case when v_existing_id is null then 'inserted' else 'updated' end;

  return query select v_result_id, v_op;
end;
$$;

-- Update the 5 already-indexed rows to the canonical path.
update public.vibelearn_content
set url = '/read/textbook/' || vibe_publication_id::text,
    updated_at = now()
where type = 'textbook'
  and vibe_publication_id is not null;
