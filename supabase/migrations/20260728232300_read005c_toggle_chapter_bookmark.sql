drop function if exists public.toggle_chapter_bookmark(uuid);
create function public.toggle_chapter_bookmark(p_chapter_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public', 'auth' as $function$
declare
  v_viewer_id uuid := auth.uid();
  v_chapter public.vibe_chapters%rowtype;
  v_deleted_count integer;
begin
  if v_viewer_id is null then return jsonb_build_object('ok',false,'reason','auth_required','bookmarked',false); end if;
  select * into v_chapter from public.vibe_chapters where id=p_chapter_id;
  if not found then return jsonb_build_object('ok',false,'reason','chapter_not_found','bookmarked',false); end if;
  if not public.can_viewer_read_chapter(p_chapter_id,v_viewer_id) then return jsonb_build_object('ok',false,'reason','not_entitled','bookmarked',false); end if;
  delete from public.vibe_workspace_items where viewer_id=v_viewer_id and chapter_id=p_chapter_id and item_type='bookmark';
  get diagnostics v_deleted_count = row_count;
  if v_deleted_count > 0 then return jsonb_build_object('ok',true,'reason',null,'bookmarked',false,'chapter_id',p_chapter_id); end if;
  insert into public.vibe_workspace_items(viewer_id,item_type,publication_id,chapter_id,payload)
  values(v_viewer_id,'bookmark',v_chapter.publication_id,p_chapter_id,'{}'::jsonb)
  on conflict (viewer_id,chapter_id) where item_type='bookmark' do nothing;
  return jsonb_build_object('ok',true,'reason',null,'bookmarked',true,'chapter_id',p_chapter_id);
end;
$function$;
revoke all on function public.toggle_chapter_bookmark(uuid) from public, anon;
grant execute on function public.toggle_chapter_bookmark(uuid) to authenticated, service_role;
