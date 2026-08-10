create or replace function public.publish_textbook(p_publication_id uuid)
returns table(content_id uuid, operation text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_author_id uuid;
  v_format    text;
begin
  select author_id, format into v_author_id, v_format
  from public.vibe_publications
  where id = p_publication_id;

  if not found then
    raise exception 'Publication % not found', p_publication_id;
  end if;

  if v_format <> 'vibetextbook' then
    raise exception 'Publication % is format %, not vibetextbook', p_publication_id, v_format;
  end if;

  if auth.uid() is distinct from v_author_id then
    raise exception 'Not authorized to publish publication %', p_publication_id;
  end if;

  update public.vibe_publications
  set status = 'published',
      published_at = coalesce(published_at, now()),
      updated_at = now()
  where id = p_publication_id;

  return query select * from public.sync_vibelearn_textbook_index(p_publication_id);
end;
$function$;

grant execute on function public.publish_textbook(uuid) to authenticated;


create or replace function public.unpublish_textbook(p_publication_id uuid)
returns table(content_id uuid, operation text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_author_id uuid;
  v_format    text;
begin
  select author_id, format into v_author_id, v_format
  from public.vibe_publications
  where id = p_publication_id;

  if not found then
    raise exception 'Publication % not found', p_publication_id;
  end if;

  if v_format <> 'vibetextbook' then
    raise exception 'Publication % is format %, not vibetextbook', p_publication_id, v_format;
  end if;

  if auth.uid() is distinct from v_author_id then
    raise exception 'Not authorized to unpublish publication %', p_publication_id;
  end if;

  update public.vibe_publications
  set status = 'draft',
      updated_at = now()
  where id = p_publication_id;

  return query select * from public.sync_vibelearn_textbook_index(p_publication_id);
end;
$function$;

grant execute on function public.unpublish_textbook(uuid) to authenticated;


create or replace function public.remove_textbook_from_vibelearn(p_publication_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_author_id uuid;
  v_format    text;
begin
  select author_id, format into v_author_id, v_format
  from public.vibe_publications
  where id = p_publication_id;

  if not found then
    raise exception 'Publication % not found', p_publication_id;
  end if;

  if v_format <> 'vibetextbook' then
    raise exception 'Publication % is format %, not vibetextbook', p_publication_id, v_format;
  end if;

  if auth.uid() is distinct from v_author_id then
    raise exception 'Not authorized to modify publication %', p_publication_id;
  end if;

  delete from public.vibelearn_content
  where vibe_publication_id = p_publication_id;
end;
$function$;

grant execute on function public.remove_textbook_from_vibelearn(uuid) to authenticated;

-- Historical owner-authorized reconciliation entry point. CE-006 replaces
-- this implementation with the canonical internal/public split.
create or replace function public.reconcile_textbook_index(p_publication_id uuid)
returns table(content_id uuid, operation text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_author_id uuid;
begin
  select author_id into v_author_id
  from public.vibe_publications
  where id = p_publication_id;

  if not found then
    raise exception 'Publication % not found', p_publication_id;
  end if;
  if auth.uid() is distinct from v_author_id then
    raise exception 'Not authorized to reconcile publication %', p_publication_id;
  end if;

  return query
  select * from public.sync_vibelearn_textbook_index(p_publication_id);
end;
$function$;

grant execute on function public.reconcile_textbook_index(uuid) to authenticated;

comment on function public.publish_textbook(uuid) is
'Sets vibe_publications.status = published and reconciles the vibelearn_content index. The only sanctioned way to publish a bridged textbook.';
comment on function public.unpublish_textbook(uuid) is
'Sets vibe_publications.status = draft (author-only, matches get_vibetextbook_reader access rule) and reconciles the index. The only sanctioned way to unpublish a bridged textbook.';
comment on function public.remove_textbook_from_vibelearn(uuid) is
'Deletes ONLY the vibelearn_content index row. Does not touch vibe_publications or vibe_chapters. This is what the teacher-facing "Delete" button on a textbook row must call — it delists, it does not delete the textbook.';
