-- VibeSchool Originals — reuse canonical per-chapter progress storage.
-- Deliberately separate fiction write authorization from can_viewer_read_chapter(),
-- which is scoped to canonical VibeTextbook commerce and must remain unchanged.
-- No new progress table, no new identity type, no textbook-policy regression.
create or replace function public.record_story_reading_progress(
  publication_id_input uuid,
  chapter_id_input uuid,
  progress_percent_input integer,
  position_input jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_viewer uuid := auth.uid();
  v_publication public.vibe_publications%rowtype;
  v_chapter public.vibe_chapters%rowtype;
  v_input_percent integer;
  v_old_percent integer;
  v_new_percent integer;
  v_old_position jsonb;
  v_new_position jsonb;
  v_block_id text;
  v_final_block text;
begin
  if v_viewer is null then
    return jsonb_build_object('ok',false,'reason','auth_required');
  end if;
  if publication_id_input is null or chapter_id_input is null
      or progress_percent_input is null or progress_percent_input not between 0 and 100
      or jsonb_typeof(position_input) is distinct from 'object' then
    return jsonb_build_object('ok',false,'reason','invalid_input');
  end if;
  v_input_percent := progress_percent_input;
  v_block_id := nullif(btrim(position_input->>'block_id'),'');
  if v_block_id is null
      or jsonb_typeof(position_input->'scroll_percent') is distinct from 'number'
      or (position_input->>'scroll_percent')::numeric <> v_input_percent then
    return jsonb_build_object('ok',false,'reason','invalid_position');
  end if;

  select * into v_publication from public.vibe_publications
    where id=publication_id_input and status='published';
  if not found
      or v_publication.format not in ('ebook','vibechronicles')
      or not (v_publication.format='vibechronicles'
         or coalesce(nullif(btrim(v_publication.series_name),''),'') <> ''
         or lower(coalesce(v_publication.genre,'')) in ('fiction','children','romance','thriller','fantasy','mystery','adventure'))
      or coalesce(v_publication.pricing->>'type','') <> 'free' then
    return jsonb_build_object('ok',false,'reason','not_entitled');
  end if;

  select * into v_chapter from public.vibe_chapters
    where id=chapter_id_input and publication_id=publication_id_input and status='published';
  if not found then
    return jsonb_build_object('ok',false,'reason','chapter_not_found');
  end if;
  if not exists (
    select 1 from jsonb_array_elements(
      case when jsonb_typeof(v_chapter.blocks)='array' then v_chapter.blocks else '[]'::jsonb end
    ) b where b->>'id'=v_block_id
  ) then
    return jsonb_build_object('ok',false,'reason','block_not_found');
  end if;
  if v_input_percent>=90 then
    select b->>'id' into v_final_block
    from jsonb_array_elements(
      case when jsonb_typeof(v_chapter.blocks)='array' then v_chapter.blocks else '[]'::jsonb end
    ) with ordinality x(b,ord)
    where nullif(b->>'id','') is not null
    order by ord desc limit 1;
    if v_final_block is distinct from v_block_id then
      return jsonb_build_object('ok',false,'reason','completion_evidence_required');
    end if;
  end if;

  select progress_percent,reading_position into v_old_percent,v_old_position
    from public.vibe_reading_progress
    where viewer_id=v_viewer and publication_id=publication_id_input and chapter_id=chapter_id_input;
  v_new_percent := greatest(coalesce(v_old_percent,0),v_input_percent);
  v_new_position := case when v_old_percent is null or v_input_percent>=v_old_percent
    then position_input else v_old_position end;

  insert into public.vibe_reading_progress as rp (
    viewer_id,publication_id,chapter_id,progress_percent,reading_position,
    started_at,last_read_at,completed_at,updated_at
  ) values (
    v_viewer,publication_id_input,chapter_id_input,v_new_percent,v_new_position,
    now(),now(),case when v_new_percent>=90 then now() else null end,now()
  )
  on conflict (viewer_id,publication_id,chapter_id) do update set
    progress_percent=v_new_percent,
    reading_position=v_new_position,
    last_read_at=now(),
    completed_at=case when v_new_percent>=90 then coalesce(rp.completed_at,now()) else rp.completed_at end,
    updated_at=now();

  return jsonb_build_object('ok',true,'progress_percent',v_new_percent);
end;
$function$;

revoke all on function public.record_story_reading_progress(uuid,uuid,integer,jsonb)
  from public,anon,authenticated;
grant execute on function public.record_story_reading_progress(uuid,uuid,integer,jsonb)
  to authenticated;
comment on function public.record_story_reading_progress(uuid,uuid,integer,jsonb) is
  'Fiction-only authenticated progress write into canonical vibe_reading_progress, with published/free/paragraph and completion checks. No caller-supplied viewer identity.';
