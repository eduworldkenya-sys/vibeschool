drop function if exists public.get_my_bookmarks();
create function public.get_my_bookmarks()
returns table(chapter_id uuid, publication_id uuid, chapter_title text, chapter_number integer, publication_title text, cover_url text, cbc_grade text, cbc_subject text, bookmarked_at timestamptz)
language sql stable security definer set search_path to 'public', 'auth' as $function$
  select c.id,p.id,c.title,c.number,p.title,p.cover_url,p.cbc_grade,p.cbc_subject,workspace.created_at
  from public.vibe_workspace_items workspace
  join public.vibe_chapters c on c.id=workspace.chapter_id and c.publication_id=workspace.publication_id
  join public.vibe_publications p on p.id=c.publication_id
  where workspace.viewer_id=auth.uid() and workspace.item_type='bookmark'
    and public.can_viewer_read_chapter(c.id,auth.uid())
  order by workspace.created_at desc;
$function$;
revoke all on function public.get_my_bookmarks() from public, anon;
grant execute on function public.get_my_bookmarks() to authenticated, service_role;
