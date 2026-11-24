-- Synchronized presenter viewport for the existing canonical Live session.
-- Teacher-only RPC publishes *position metadata*, never lesson text or files.
-- Joined learners retain local control; client auto-follow is optional.
BEGIN;
ALTER TABLE vibe_live.sessions
  ADD COLUMN presented_prompt_id uuid REFERENCES vibe_live.prompts(id) ON DELETE RESTRICT,
  ADD COLUMN presented_scroll_ratio numeric(7,6) NOT NULL DEFAULT 0
    CHECK (presented_scroll_ratio BETWEEN 0 AND 1),
  ADD COLUMN presented_seq bigint NOT NULL DEFAULT 0
    CHECK (presented_seq >= 0);

DO $migration$
DECLARE
  src text := pg_get_functiondef('vibe_live.command(text,uuid,uuid,integer,jsonb)'::regprocedure);
  old text; replacement text;
BEGIN
  IF position('presented_scroll_ratio' in src)>0
    THEN RAISE EXCEPTION 'Presenter synchronization already installed: reconcile drift'; END IF;

  old := $anchor$'wait_decide')
 or p_payload is null$anchor$;
  replacement := $anchor$'wait_decide','present')
 or p_payload is null$anchor$;
  IF (length(src)-length(replace(src,old,'')))/length(old)<>1
    THEN RAISE EXCEPTION 'Unexpected Live action whitelist'; END IF;
  src:=replace(src,old,replacement);

  old := $anchor$'wait_list','wait_decide') and not is_teacher$anchor$;
  replacement := $anchor$'wait_list','wait_decide','present') and not is_teacher$anchor$;
  IF (length(src)-length(replace(src,old,'')))/length(old)<>1
    THEN RAISE EXCEPTION 'Unexpected Live teacher authority gate'; END IF;
  src:=replace(src,old,replacement);

  old := $anchor$ if p_action='publish' then$anchor$;
  replacement := $block$
  if p_action='present' then
    -- Authorization, current host eligibility and room row lock were checked
    -- above. A learner cannot invoke this action by setting host=true.
    if room.status<>'active' or room.expires_at<=now() then
      raise exception 'live_paused'; end if;
    if coalesce(p_payload->>'promptId','') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(p_payload->>'ratio','') !~
        '^(0([.][0-9]{1,6})?|1([.]0{1,6})?)$'
      then raise exception 'live_invalid_presentation' using errcode='22023'; end if;
    if coalesce(p_payload->>'currentPromptId','') is distinct from
       coalesce(room.current_prompt::text,'') then
      -- An older in-flight scroll must never override a newly published page.
      return jsonb_build_object('ignored',true);
    end if;
    if not exists(
      select 1 from vibe_live.prompts q
      where q.id=(p_payload->>'promptId')::uuid and q.session_id=room.id
    ) then raise exception 'live_invalid_presentation' using errcode='22023'; end if;
    update vibe_live.sessions set
      presented_prompt_id=(p_payload->>'promptId')::uuid,
      presented_scroll_ratio=(p_payload->>'ratio')::numeric,
      presented_seq=presented_seq+1
    where id=room.id returning * into room;
    return jsonb_build_object('presentedPromptId',room.presented_prompt_id,
      'presentedScrollRatio',room.presented_scroll_ratio,
      'presentedSeq',room.presented_seq);
  end if;
 $block$;
  IF (length(src)-length(replace(src,old,'')))/length(old)<>1
    THEN RAISE EXCEPTION 'Unexpected Live publish action anchor'; END IF;
  src:=replace(src,old,replacement||old);

  old := $anchor$set current_prompt=prompt.id,version=version+1 where id=room.id$anchor$;
  replacement := $anchor$set current_prompt=prompt.id,
      presented_prompt_id=prompt.id,presented_scroll_ratio=0,
      presented_seq=presented_seq+1,version=version+1 where id=room.id$anchor$;
  IF (length(src)-length(replace(src,old,'')))/length(old)<>1
    THEN RAISE EXCEPTION 'Unexpected canonical lesson publish update'; END IF;
  src:=replace(src,old,replacement);

  old := ' return result;';
  replacement := $block$
  result := result || jsonb_build_object(
    'presentedPromptId',coalesce(room.presented_prompt_id,room.current_prompt),
    'presentedScrollRatio',room.presented_scroll_ratio,
    'presentedSeq',room.presented_seq);
  return result;$block$;
  IF (length(src)-length(replace(src,old,'')))/length(old)<>1
    THEN RAISE EXCEPTION 'Unexpected canonical room snapshot projection'; END IF;
  src:=replace(src,old,replacement);
  EXECUTE src;
END;
$migration$;
COMMIT;
