-- Reader annotations must anchor to canonical content-block IDs and offsets.
-- This extends the existing governed study RPC without changing entitlement authority.

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
  v_block_id text;
  v_start integer;
  v_end integer;
begin
  if v_viewer is null then return jsonb_build_object('ok', false, 'reason', 'auth_required'); end if;
  if p_item_type not in ('highlight','note','definition','vocabulary','formula') then return jsonb_build_object('ok', false, 'reason', 'invalid_item_type'); end if;

  select publication_id into v_publication_id from public.vibe_chapters where id = p_chapter_id;
  if v_publication_id is null then return jsonb_build_object('ok', false, 'reason', 'chapter_not_found'); end if;
  if not public.can_viewer_read_chapter(p_chapter_id, v_viewer) then return jsonb_build_object('ok', false, 'reason', 'not_entitled'); end if;
  if jsonb_typeof(v_payload) <> 'object' then return jsonb_build_object('ok', false, 'reason', 'invalid_payload'); end if;

  v_text := btrim(coalesce(v_payload->>'text', ''));
  if v_text = '' or length(v_text) > 5000 then return jsonb_build_object('ok', false, 'reason', 'invalid_text'); end if;

  v_block_id := nullif(left(btrim(coalesce(v_payload->>'block_id','')), 160), '');
  begin v_start := (v_payload->>'start_offset')::integer; exception when others then v_start := null; end;
  begin v_end := (v_payload->>'end_offset')::integer; exception when others then v_end := null; end;
  if v_start is not null and v_start < 0 then v_start := null; end if;
  if v_end is not null and (v_start is null or v_end <= v_start or v_end > 1000000) then v_end := null; end if;

  if p_item_type = 'highlight' then
    if length(v_text) > 2000 then return jsonb_build_object('ok', false, 'reason', 'highlight_too_long'); end if;
    v_payload := jsonb_strip_nulls(jsonb_build_object(
      'text', v_text,
      'color', case when v_payload->>'color' in ('yellow','green','blue','pink') then v_payload->>'color' else 'yellow' end,
      'context', left(btrim(coalesce(v_payload->>'context','')), 500),
      'block_id', v_block_id,
      'start_offset', v_start,
      'end_offset', v_end,
      'anchor_version', case when v_block_id is not null and v_start is not null and v_end is not null then 1 else null end
    ));
  elsif p_item_type = 'note' then
    v_payload := jsonb_strip_nulls(jsonb_build_object(
      'text', v_text,
      'quote', left(btrim(coalesce(v_payload->>'quote','')), 2000),
      'block_id', v_block_id,
      'start_offset', v_start,
      'end_offset', v_end,
      'anchor_version', case when v_block_id is not null and v_start is not null and v_end is not null then 1 else null end
    ));
  else
    v_payload := jsonb_build_object('text', v_text, 'meaning', left(btrim(coalesce(v_payload->>'meaning','')), 5000));
  end if;

  if p_item_id is null then
    insert into public.vibe_workspace_items(viewer_id,item_type,publication_id,chapter_id,payload)
    values(v_viewer,p_item_type,v_publication_id,p_chapter_id,v_payload) returning id into v_id;
  else
    update public.vibe_workspace_items set payload = v_payload, updated_at = now()
    where id = p_item_id and viewer_id = v_viewer and item_type = p_item_type
      and chapter_id = p_chapter_id and publication_id = v_publication_id returning id into v_id;
    if v_id is null then return jsonb_build_object('ok', false, 'reason', 'item_not_found'); end if;
  end if;

  return jsonb_build_object('ok', true, 'item_id', v_id);
end;
$$;

revoke all on function public.upsert_study_workspace_item(text,uuid,jsonb,uuid) from public, anon;
grant execute on function public.upsert_study_workspace_item(text,uuid,jsonb,uuid) to authenticated;
