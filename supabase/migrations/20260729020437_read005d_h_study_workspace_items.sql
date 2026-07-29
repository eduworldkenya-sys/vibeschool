alter table public.vibe_workspace_items
  drop constraint if exists vwi_study_scope_check;

alter table public.vibe_workspace_items
  add constraint vwi_study_scope_check check (
    item_type not in ('highlight','note','definition','vocabulary','formula')
    or (chapter_id is not null and publication_id is not null)
  );

create index if not exists vwi_study_items_updated_idx
  on public.vibe_workspace_items (viewer_id, item_type, updated_at desc)
  where item_type in ('highlight','note','definition','vocabulary','formula');

create or replace function public.upsert_study_workspace_item(
  p_item_type text,
  p_chapter_id uuid,
  p_payload jsonb,
  p_item_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_viewer uuid := auth.uid();
  v_publication_id uuid;
  v_id uuid;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_text text;
begin
  if v_viewer is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_required');
  end if;

  if p_item_type not in ('highlight','note','definition','vocabulary','formula') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_item_type');
  end if;

  select publication_id into v_publication_id
  from public.vibe_chapters
  where id = p_chapter_id;

  if v_publication_id is null then
    return jsonb_build_object('ok', false, 'reason', 'chapter_not_found');
  end if;

  if not public.can_viewer_read_chapter(p_chapter_id, v_viewer) then
    return jsonb_build_object('ok', false, 'reason', 'not_entitled');
  end if;

  if jsonb_typeof(v_payload) <> 'object' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;

  v_text := btrim(coalesce(v_payload->>'text', ''));
  if v_text = '' or length(v_text) > 5000 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_text');
  end if;

  if p_item_type = 'highlight' then
    if length(v_text) > 2000 then
      return jsonb_build_object('ok', false, 'reason', 'highlight_too_long');
    end if;
    v_payload := jsonb_build_object(
      'text', v_text,
      'color', case when v_payload->>'color' in ('yellow','green','blue','pink') then v_payload->>'color' else 'yellow' end,
      'context', left(btrim(coalesce(v_payload->>'context','')), 500)
    );
  elsif p_item_type = 'note' then
    v_payload := jsonb_build_object('text', v_text);
  else
    v_payload := jsonb_build_object(
      'text', v_text,
      'meaning', left(btrim(coalesce(v_payload->>'meaning','')), 5000)
    );
  end if;

  if p_item_id is null then
    insert into public.vibe_workspace_items(viewer_id,item_type,publication_id,chapter_id,payload)
    values(v_viewer,p_item_type,v_publication_id,p_chapter_id,v_payload)
    returning id into v_id;
  else
    update public.vibe_workspace_items
    set payload = v_payload,
        updated_at = now()
    where id = p_item_id
      and viewer_id = v_viewer
      and item_type = p_item_type
      and chapter_id = p_chapter_id
      and publication_id = v_publication_id
    returning id into v_id;

    if v_id is null then
      return jsonb_build_object('ok', false, 'reason', 'item_not_found');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'item_id', v_id);
end;
$$;

create or replace function public.delete_study_workspace_item(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_viewer uuid := auth.uid();
  v_deleted uuid;
begin
  if v_viewer is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_required');
  end if;

  delete from public.vibe_workspace_items
  where id = p_item_id
    and viewer_id = v_viewer
    and item_type in ('highlight','note','definition','vocabulary','formula')
  returning id into v_deleted;

  return jsonb_build_object(
    'ok', v_deleted is not null,
    'reason', case when v_deleted is null then 'item_not_found' else null end
  );
end;
$$;

create or replace function public.get_my_study_workspace_items(p_item_type text default null)
returns table(
  item_id uuid,
  item_type text,
  chapter_id uuid,
  publication_id uuid,
  chapter_title text,
  chapter_number integer,
  publication_title text,
  cover_url text,
  cbc_grade text,
  cbc_subject text,
  payload jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    w.id,
    w.item_type,
    c.id,
    p.id,
    c.title,
    c.number,
    p.title,
    p.cover_url,
    p.cbc_grade,
    p.cbc_subject,
    w.payload,
    w.created_at,
    w.updated_at
  from public.vibe_workspace_items w
  join public.vibe_chapters c
    on c.id = w.chapter_id
   and c.publication_id = w.publication_id
  join public.vibe_publications p
    on p.id = c.publication_id
  where w.viewer_id = auth.uid()
    and w.item_type in ('highlight','note','definition','vocabulary','formula')
    and (p_item_type is null or w.item_type = p_item_type)
    and public.can_viewer_read_chapter(c.id, auth.uid())
  order by w.updated_at desc, w.created_at desc;
$$;

revoke all on function public.upsert_study_workspace_item(text,uuid,jsonb,uuid) from public, anon;
revoke all on function public.delete_study_workspace_item(uuid) from public, anon;
revoke all on function public.get_my_study_workspace_items(text) from public, anon;
grant execute on function public.upsert_study_workspace_item(text,uuid,jsonb,uuid) to authenticated;
grant execute on function public.delete_study_workspace_item(uuid) to authenticated;
grant execute on function public.get_my_study_workspace_items(text) to authenticated;
