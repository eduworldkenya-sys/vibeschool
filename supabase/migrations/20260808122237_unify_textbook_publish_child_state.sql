create or replace function public.publish_textbook(p_publication_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_pub public.vibe_publications%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_pub from public.vibe_publications where id = p_publication_id for update;
  if not found then raise exception 'Publication not found'; end if;
  if v_pub.author_id <> v_uid then raise exception 'Not publication owner'; end if;
  update public.vibe_publications set status='published', published_at=coalesce(published_at,now()), updated_at=now() where id=p_publication_id;
  update public.vibe_chapters set status='published', updated_at=now() where publication_id=p_publication_id and status not in ('archived');
  update public.content_blocks set status='published', updated_at=now() where publication_id=p_publication_id and status not in ('archived');
  return jsonb_build_object('ok',true,'publication_id',p_publication_id,'status','published');
end;
$$;
