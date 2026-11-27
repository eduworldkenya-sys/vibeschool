-- Test candidate ONLY. Generate a numbered Supabase migration with the CLI
-- after isolated SQL tests and review; this file is not a deployed migration.
BEGIN;
DO $candidate$
DECLARE
 src text := pg_get_functiondef('vibe_live.command(text,uuid,uuid,integer,jsonb)'::regprocedure);
 anchor text; replacement text;
BEGIN
 anchor := $a$if p_action is null or p_action not in ($a$;
 IF (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 THEN
   RAISE EXCEPTION 'Unexpected live action whitelist'; END IF;
 src:=replace(src,anchor,anchor||$a$'slide_update',$a$);
 anchor := $a$ elsif p_action in ('pause','resume','end') then$a$;
 IF (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 THEN
   RAISE EXCEPTION 'Unexpected live action dispatch'; END IF;
 replacement := $body$
 elsif p_action='slide_update' then
   -- Existing session authorization and row lock run before this dispatch.
   -- Retain a second explicit teacher-only guard at the mutation boundary.
   if not is_teacher then raise exception 'live_teacher_required' using errcode='42501'; end if;
   if room.status<>'active' then raise exception 'live_paused'; end if;
   if p_version is distinct from room.version then raise exception 'live_stale_version'; end if;
   select * into prompt from vibe_live.prompts q
    where q.id=room.current_prompt and q.session_id=room.id;
   if not found or prompt.kind<>'teach' or prompt.answer_key is not null
      or p_payload->>'promptId' is distinct from prompt.id::text
      or p_payload->>'expectedBody' is distinct from prompt.body
      then raise exception 'live_slide_conflict'; end if;
   body:=p_payload->>'body';
   if jsonb_typeof(p_payload->'body') is distinct from 'string'
      or char_length(body) not between 9 and 4000
      or left(body,8)<>'VSLIDE1:' or left(prompt.body,8)<>'VSLIDE1:'
      then raise exception 'live_invalid_slide' using errcode='22023'; end if;
   declare
    before_slide jsonb; after_slide jsonb;
    before_content text; after_content text;
   begin
    begin
     before_slide:=substr(prompt.body,9)::jsonb;
     after_slide:=substr(body,9)::jsonb;
    exception when invalid_text_representation then
     raise exception 'live_invalid_slide' using errcode='22023';
    end;
    if jsonb_typeof(before_slide) is distinct from 'object'
       or jsonb_typeof(after_slide) is distinct from 'object'
       then raise exception 'live_invalid_slide' using errcode='22023'; end if;
    if not (after_slide ?& array['title','body','diagram','theme','layout','font','number','total'])
       or exists(select 1 from jsonb_object_keys(after_slide) k(key)
                 where k.key not in ('title','body','diagram','theme','layout','font','number','total'))
       or jsonb_typeof(after_slide->'title') is distinct from 'string'
       or jsonb_typeof(after_slide->'body') is distinct from 'string'
       or char_length(after_slide->>'title')>120
       or char_length(after_slide->>'body')>3878
       or coalesce(after_slide->>'diagram','') not in ('none','fraction-circle','fraction-bars','number-line','ruler','protractor','coordinate-grid','counters','base-ten','clock','money','solids','handwriting','music')
       or coalesce(after_slide->>'theme','') not in ('paper','ocean','forest','night')
       or coalesce(after_slide->>'layout','') not in ('wide','portrait')
       or coalesce(after_slide->>'font','') not in ('normal','large')
       or jsonb_typeof(after_slide->'number') is distinct from 'number'
       or jsonb_typeof(after_slide->'total') is distinct from 'number'
       or coalesce(after_slide->>'number','') !~ '^([1-9]|[12][0-9]|30)$'
       or coalesce(after_slide->>'total','') !~ '^([1-9]|[12][0-9]|30)$'
       or after_slide->'number' is distinct from before_slide->'number'
       or after_slide->'total' is distinct from before_slide->'total'
       then raise exception 'live_invalid_slide' using errcode='22023'; end if;
    if (after_slide->>'number')::integer>(after_slide->>'total')::integer
       or (btrim(after_slide->>'title')='' and btrim(after_slide->>'body')='' and after_slide->>'diagram'='none')
       then raise exception 'live_invalid_slide' using errcode='22023'; end if;
    before_content:=before_slide->>'body'; after_content:=after_slide->>'body';
    -- Restrict this first candidate to text and legacy static diagrams.
    -- Structured object validation must be proven before enabling that path.
    if before_content is null or before_content ~ '^VSLIDE[A-Z0-9]*:'
       or after_content ~ '^VSLIDE[A-Z0-9]*:'
       then raise exception 'live_slide_format_not_supported' using errcode='22023'; end if;
   end;
   if body is distinct from prompt.body then
    update vibe_live.prompts q set body=p_payload->>'body'
      where q.id=prompt.id and q.session_id=room.id;
    update vibe_live.sessions set version=version+1
      where id=room.id returning * into room;
   end if;
 $body$;
 src:=replace(src,anchor,replacement||anchor);
 EXECUTE src;
END;
$candidate$;
COMMIT;
