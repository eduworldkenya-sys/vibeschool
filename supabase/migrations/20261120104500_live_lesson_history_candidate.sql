-- Migration candidate for #1836. Apply in a disposable/staging database first.
-- Extends the existing authorized classroom command; does not expose private tables.
BEGIN;

ALTER TABLE vibe_live.prompts ADD COLUMN IF NOT EXISTS lesson_position integer;
ALTER TABLE vibe_live.prompts ADD COLUMN IF NOT EXISTS request_id uuid;

-- Existing timestamps are the best available history for old sessions. UUID is
-- a deterministic tie-breaker, not proof of actual order for tied timestamps.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY session_id ORDER BY created_at, id)::integer AS pos
  FROM vibe_live.prompts
)
UPDATE vibe_live.prompts p SET lesson_position = ranked.pos
FROM ranked WHERE p.id = ranked.id AND p.lesson_position IS NULL;

ALTER TABLE vibe_live.prompts ALTER COLUMN lesson_position SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS vibe_live_prompt_position_uq
  ON vibe_live.prompts(session_id, lesson_position);
CREATE UNIQUE INDEX IF NOT EXISTS vibe_live_prompt_request_uq
  ON vibe_live.prompts(session_id, request_id) WHERE request_id IS NOT NULL;

-- Fail closed if the canonical RPC has changed. Preserve all existing authorization,
-- security-definer settings, return types and grants rather than replacing them from memory.
DO $migration$
DECLARE
  src text := pg_get_functiondef('vibe_live.command(text,uuid,uuid,integer,jsonb)'::regprocedure);
  old text;
  replacement text;
BEGIN
  IF position('lesson_position' in src) > 0 THEN
    RAISE EXCEPTION 'History already implemented or canonical command changed';
  END IF;

  old := 'kind text; body text; key_text text; target uuid; result jsonb;';
  replacement := old || ' publish_request uuid; prior_prompt vibe_live.prompts%rowtype;';
  IF (length(src)-length(replace(src,old,''))) / length(old) <> 1 THEN
    RAISE EXCEPTION 'Unexpected declaration in canonical classroom command';
  END IF;
  src := replace(src,old,replacement);

  -- Duplicate publish is a read-only success only after the original authorization
  -- and room lock have been applied. It cannot be used to submit different content.
  old := $anchor$ if p_action in ('publish','pause','resume','reveal','end') and p_version is distinct from room.version then$anchor$;
  replacement := $body$
 if p_action='publish' and nullif(p_payload->>'requestId','') is not null then
   publish_request := (p_payload->>'requestId')::uuid;
   select * into prior_prompt from vibe_live.prompts
     where session_id=room.id and request_id=publish_request;
   if found then
     if prior_prompt.kind is distinct from p_payload->>'kind'
       or prior_prompt.body is distinct from btrim(coalesce(p_payload->>'body',''))
       or prior_prompt.answer_key is distinct from nullif(btrim(coalesce(p_payload->>'answerKey','')),'') then
       raise exception 'live_request_id_reused' using errcode='22023';
     end if;
     p_action := 'get';
   end if;
 end if;
 if p_action in ('publish','pause','resume','reveal','end') and p_version is distinct from room.version then$body$;
  IF (length(src)-length(replace(src,old,''))) / length(old) <> 1 THEN
    RAISE EXCEPTION 'Unexpected optimistic-lock contract';
  END IF;
  src := replace(src,old,replacement);

  old := $anchor$insert into vibe_live.prompts(session_id,kind,body,answer_key) values(room.id,kind,body,key_text) returning * into prompt;$anchor$;
  replacement := $body$insert into vibe_live.prompts(session_id,kind,body,answer_key,lesson_position,request_id)
   values(room.id,kind,body,key_text,
     (select coalesce(max(q.lesson_position),0)+1 from vibe_live.prompts q where q.session_id=room.id),
     publish_request) returning * into prompt;$body$;
  IF (length(src)-length(replace(src,old,''))) / length(old) <> 1 THEN
    RAISE EXCEPTION 'Unexpected publish contract';
  END IF;
  src := replace(src,old,replacement);

  -- The existing command verifies teacher authority or learner participation
  -- before reaching this point. No other learner's responses are added.
  old := ' return result;';
  replacement := $body$
 result := result || jsonb_build_object('history', coalesce((
   select jsonb_agg(jsonb_build_object(
     'id',q.id,'kind',q.kind,'body',q.body,'revealed',q.revealed,
     'answerKey',case when is_teacher or q.revealed then q.answer_key else null end,
     'position',q.lesson_position,'createdAt',q.created_at
   ) order by q.lesson_position)
   from vibe_live.prompts q where q.session_id=room.id
 ), '[]'::jsonb));
 return result;$body$;
  IF (length(src)-length(replace(src,old,''))) / length(old) <> 1 THEN
    RAISE EXCEPTION 'Unexpected response contract';
  END IF;
  src := replace(src,old,replacement);
  EXECUTE src;
END;
$migration$;
COMMIT;