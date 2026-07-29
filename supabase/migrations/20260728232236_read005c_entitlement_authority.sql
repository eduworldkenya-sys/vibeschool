drop function if exists public.can_viewer_read_chapter(uuid, uuid);
create function public.can_viewer_read_chapter(p_chapter_id uuid, p_viewer_id uuid)
returns boolean language plpgsql stable security definer set search_path to 'public', 'auth' as $function$
declare
  v_chapter public.vibe_chapters%rowtype;
  v_publication public.vibe_publications%rowtype;
  v_viewer_is_author boolean;
  v_pricing_type text;
  v_free_chapter_count integer;
begin
  select * into v_chapter from public.vibe_chapters where id = p_chapter_id;
  if not found then return false; end if;
  select * into v_publication from public.vibe_publications where id = v_chapter.publication_id;
  if not found then return false; end if;
  if v_publication.format <> 'vibetextbook' then return false; end if;
  v_viewer_is_author := p_viewer_id is not null and p_viewer_id = v_publication.author_id;
  if v_publication.status <> 'published' and not v_viewer_is_author then return false; end if;
  if v_viewer_is_author then return true; end if;
  v_pricing_type := coalesce(v_publication.pricing->>'type', 'free');
  v_free_chapter_count := case when jsonb_typeof(v_publication.pricing->'freeChapters') = 'number' then greatest(0,(v_publication.pricing->>'freeChapters')::integer) else 0 end;
  return case
    when v_pricing_type in ('free','donation') and v_chapter.status in ('published','locked') then true
    when v_pricing_type='freemium' and v_chapter.status in ('published','locked') and v_chapter.number <= v_free_chapter_count then true
    else false end;
end;
$function$;
revoke all on function public.can_viewer_read_chapter(uuid, uuid) from public, anon, authenticated;
grant execute on function public.can_viewer_read_chapter(uuid, uuid) to service_role;
