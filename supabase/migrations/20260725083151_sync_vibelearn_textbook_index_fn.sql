-- Server-side sync: mirrors a vibetextbook publication into the
-- vibelearn_content marketplace index, keyed by vibe_publication_id.
-- Called via supabase.rpc('sync_vibelearn_textbook_index', { p_publication_id }).
--
-- SECURITY DEFINER so it can write vibelearn_content on the teacher's
-- behalf, but it re-derives every field from vibe_publications itself
-- and checks auth.uid() = author_id — the caller cannot pass in title,
-- subject, status, earnings, or any other field directly. This is the
-- "trusted server boundary" the client-side hook was missing.
--
-- Known simplification: vibelearn_content.status only allows
-- ('draft','live') today. A vibe_publications 'archived' textbook maps
-- to 'draft' here (removed from Discover) rather than a distinct
-- 'archived' state — the lifecycle table calls for a real 'archived'
-- status; that needs its own check-constraint migration, not bundled
-- into this one.
--
-- Known simplification: cbc_subject on vibe_publications is a free-text
-- label ('mathematics'); vibelearn_content.subject_id is a uuid FK. This
-- resolves by case-insensitive name match against public.subjects and
-- leaves subject_id null on no/ambiguous match, rather than guessing.
-- This is the same kind of name-bridge fragility already tracked and
-- fixed once before for timetable subjects (TBL-010) — flagging so it
-- doesn't quietly reintroduce that pattern here.

create or replace function public.sync_vibelearn_textbook_index(p_publication_id uuid)
returns table(content_id uuid, operation text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pub            record;
  v_school_id       uuid;
  v_subject_id      uuid;
  v_status          text;
  v_existing_id     uuid;
  v_result_id       uuid;
  v_op              text;
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

  -- Derive school_id from the author's membership (same coalesce order
  -- used elsewhere in the app: school_members, then teacher_profiles).
  select coalesce(sm.school_id, tp.school_id)
  into v_school_id
  from (select 1) as _dummy
  left join public.school_members sm on sm.profile_id = v_pub.author_id
  left join public.teacher_profiles tp on tp.profile_id = v_pub.author_id
  limit 1;

  -- Best-effort subject name -> subjects.id resolution. Null on no/ambiguous match.
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
    '/global/read/publication/' || p_publication_id::text,
    nullif(v_pub.cover_url, ''),
    coalesce(v_pub.tags, '{}'),
    'vibetextbook',
    v_pub.author_id,
    v_school_id,
    v_status,
    p_publication_id
  )
  on conflict (vibe_publication_id) do update
    set title         = excluded.title,
        description   = excluded.description,
        subject_id    = excluded.subject_id,
        thumbnail_url = excluded.thumbnail_url,
        tags           = excluded.tags,
        source         = excluded.source,
        school_id      = excluded.school_id,
        status         = excluded.status,
        updated_at     = now()
  returning id into v_result_id;

  v_op := case when v_existing_id is null then 'inserted' else 'updated' end;

  return query select v_result_id, v_op;
end;
$$;

grant execute on function public.sync_vibelearn_textbook_index(uuid) to authenticated;
