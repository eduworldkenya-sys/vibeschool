create or replace function public.publish_publication(p_publication_id uuid)
returns table(publication_id uuid, operation text)
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_author_id uuid;
  v_format text;
  v_title text;
  v_subject text;
  v_grade text;
  v_pricing jsonb;
  v_now timestamptz := now();
begin
  select author_id, format, title, cbc_subject, cbc_grade, pricing
    into v_author_id, v_format, v_title, v_subject, v_grade, v_pricing
  from public.vibe_publications
  where id = p_publication_id
  for update;

  if not found then raise exception 'Publication % not found', p_publication_id; end if;
  if v_format not in ('vibetextbook','ebook') then raise exception 'Publication format % is not supported by Content Studio lifecycle', v_format; end if;
  if (select auth.uid()) is distinct from v_author_id then raise exception 'Not authorized to publish publication %', p_publication_id; end if;
  if nullif(btrim(v_title), '') is null then raise exception 'Title is required before publishing'; end if;
  if v_format = 'vibetextbook' and nullif(btrim(v_subject), '') is null then raise exception 'CBC subject is required before publishing'; end if;
  if v_format = 'vibetextbook' and nullif(btrim(v_grade), '') is null then raise exception 'CBC grade is required before publishing'; end if;
  if not exists (select 1 from public.vibe_chapters where publication_id = p_publication_id) then raise exception 'At least one chapter is required before publishing'; end if;

  update public.vibe_publications
  set status='published', published_at=coalesce(published_at,v_now), updated_at=v_now
  where id=p_publication_id;

  update public.vibe_chapters
  set status = case
        when coalesce(v_pricing->>'type','free') in ('paid','school_license') then 'locked'
        when coalesce(v_pricing->>'type','free') = 'freemium'
          and number > greatest(coalesce((v_pricing->>'freeChapters')::integer, 0), 0) then 'locked'
        else 'published'
      end,
      published_at = case
        when coalesce(v_pricing->>'type','free') in ('paid','school_license') then published_at
        when coalesce(v_pricing->>'type','free') = 'freemium'
          and number > greatest(coalesce((v_pricing->>'freeChapters')::integer, 0), 0) then published_at
        else coalesce(published_at,v_now)
      end,
      updated_at=v_now
  where publication_id=p_publication_id and status='draft';

  update public.content_blocks cb
  set status = case when vc.status = 'published' then 'published' else 'draft' end,
      updated_at = v_now
  from public.vibe_chapters vc
  where cb.chapter_id = vc.id
    and vc.publication_id = p_publication_id
    and cb.status is distinct from case when vc.status = 'published' then 'published' else 'draft' end;

  perform public.ce_capture_publication_revision(p_publication_id, 'publish');

  if v_format = 'vibetextbook' then
    perform public.sync_vibelearn_textbook_index(p_publication_id);
  end if;

  return query select p_publication_id, 'published'::text;
end;
$function$;

create or replace function public.unpublish_publication(p_publication_id uuid)
returns table(publication_id uuid, operation text)
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_author_id uuid;
  v_format text;
  v_now timestamptz := now();
begin
  select author_id, format into v_author_id, v_format
  from public.vibe_publications
  where id = p_publication_id
  for update;

  if not found then raise exception 'Publication % not found', p_publication_id; end if;
  if v_format not in ('vibetextbook','ebook') then raise exception 'Publication format % is not supported by Content Studio lifecycle', v_format; end if;
  if (select auth.uid()) is distinct from v_author_id then raise exception 'Not authorized to unpublish publication %', p_publication_id; end if;

  perform public.ce_capture_publication_revision(p_publication_id, 'before_unpublish');

  update public.vibe_chapters
  set status='draft', updated_at=v_now
  where publication_id=p_publication_id and status in ('published','locked');

  update public.content_blocks
  set status='draft', updated_at=v_now
  where publication_id=p_publication_id and status <> 'draft';

  update public.vibe_publications
  set status='unpublished', updated_at=v_now
  where id=p_publication_id;

  if v_format='vibetextbook' then
    perform public.sync_vibelearn_textbook_index(p_publication_id);
  end if;

  return query select p_publication_id, 'unpublished'::text;
end;
$function$;
