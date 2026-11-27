-- Test candidate ONLY. Generate a numbered Supabase migration with the CLI
-- after isolated SQL tests and review; this file is not a deployed migration.
BEGIN;
-- Candidate only: reuse canonical board validation for geometry and text.
CREATE FUNCTION vibe_live.valid_slide_demo_candidate(d jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $demo$
DECLARE bounds jsonb; av integer; bv integer;
BEGIN
 IF jsonb_typeof(d) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
 IF NOT (d ?& array['kind','a','b'])
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(d) k(key) WHERE k.key NOT IN ('kind','a','b'))
 OR jsonb_typeof(d->'kind') IS DISTINCT FROM 'string'
 OR jsonb_typeof(d->'a') IS DISTINCT FROM 'number'
 OR jsonb_typeof(d->'b') IS DISTINCT FROM 'number'
 OR (d->>'a') !~ '^-?[0-9]{1,5}$' OR (d->>'b') !~ '^-?[0-9]{1,5}$' THEN RETURN false; END IF;
 bounds:='{"counter-groups":[0,24,0,24],"base-ten-blocks":[0,9,0,9],"times-array":[1,10,1,10],"equal-groups":[0,36,1,9],"percent-grid":[0,100,0,0],"rectangle-area":[1,12,1,8],"triangle-area":[1,12,1,8],"regular-polygon":[3,12,0,359],"bar-comparison":[0,20,0,20],"linear-graph":[-4,4,-4,4],"clock-elapsed":[0,1439,0,720],"fraction-equivalence":[1,5,1,5],"change-calculator":[0,500,0,500],"mass-scale":[0,100,0,100],"volume-cylinder":[0,100,0,0],"thermometer":[-20,50,0,0],"water-states":[-20,120,0,0],"shadow-length":[1,10,15,90],"magnification":[5,20,4,40],"buoyancy":[200,1600,700,1300],"ohms-law":[0,24,1,24],"electrical-power":[0,24,0,10],"ideal-pulley":[0,200,1,4],"pendulum-period":[10,150,0,15],"average-speed":[0,120,1,60],"compass-bearing":[0,359,0,0],"population-density":[0,5000,1,100],"rainfall-total":[0,300,0,300],"budget-balance":[0,10000,0,10000],"business-profit":[0,10000,0,10000],"unit-price":[0,1000,1,24],"lap-distance":[50,400,1,20],"rhythm-beats":[1,16,30,220],"irrigation-water":[1,20,1,10],"clock":[1,12,0,59],"fraction-circle":[0,12,1,12],"fraction-bars":[0,12,1,12],"number-line":[-10,10,-10,10],"ruler":[0,10,0,10],"coordinate-grid":[-4,4,-4,4],"protractor":[0,180,0,0],"electric-circuit":[0,1,1,3],"lever-balance":[1,10,1,10],"map-scale":[1,12,1,10]}'::jsonb->(d->>'kind');
 IF bounds IS NULL THEN RETURN false; END IF;
 av:=(d->>'a')::integer; bv:=(d->>'b')::integer;
 RETURN av BETWEEN (bounds->>0)::integer AND (bounds->>1)::integer
 AND bv BETWEEN (bounds->>2)::integer AND (bounds->>3)::integer
 AND (d->>'kind' NOT IN ('fraction-circle','fraction-bars') OR av<=bv);
END;
$demo$;
REVOKE ALL ON FUNCTION vibe_live.valid_slide_demo_candidate(jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION vibe_live.valid_editable_slide_content_candidate(p_body text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $content$
DECLARE d jsonb; o jsonb; normalized jsonb:='[]'::jsonb; seen text[]:=ARRAY[]::text[];
BEGIN
 IF p_body IS NULL OR char_length(p_body)>3878 THEN RETURN false; END IF;
 IF left(p_body,length('VSLIDEVIS1:'))='VSLIDEVIS1:' THEN
  IF left(substr(p_body,length('VSLIDEVIS1:')+1),8)<>'VBOARD1:' OR char_length(substr(p_body,length('VSLIDEVIS1:')+1))>3500 THEN RETURN false; END IF;
  d:=substr(p_body,length('VSLIDEVIS1:VBOARD1:')+1)::jsonb;
  IF jsonb_typeof(d) IS DISTINCT FROM 'object' OR jsonb_typeof(d->'objects') IS DISTINCT FROM 'array'
    OR d->'page' IS DISTINCT FROM '1'::jsonb OR d->'total' IS DISTINCT FROM '1'::jsonb THEN RETURN false; END IF;
  IF jsonb_array_length(d->'objects')>40 THEN RETURN false; END IF;
  FOR o IN SELECT value FROM jsonb_array_elements(d->'objects') LOOP
   IF jsonb_typeof(o) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
   IF o?'demo' THEN
    IF o->>'kind' IS DISTINCT FROM 'diagram' OR o?'diagram' OR NOT vibe_live.valid_slide_demo_candidate(o->'demo') THEN RETURN false; END IF;
    o:=(o-'demo')||jsonb_build_object('diagram','ruler');
   END IF;
   normalized:=normalized||jsonb_build_array(o);
  END LOOP;
  RETURN vibe_live.valid_object_board('VBOARD1:'||jsonb_set(d,'{objects}',normalized)::text);
 ELSIF left(p_body,length('VSLIDEDEMO1:'))='VSLIDEDEMO1:' THEN
  RETURN char_length(p_body)<=200 AND vibe_live.valid_slide_demo_candidate(substr(p_body,length('VSLIDEDEMO1:')+1)::jsonb);
 ELSIF left(p_body,length('VSLIDEMULTIDEMO1:'))='VSLIDEMULTIDEMO1:' THEN
  IF char_length(p_body)>2000 THEN RETURN false; END IF;
  d:=substr(p_body,length('VSLIDEMULTIDEMO1:')+1)::jsonb;
  IF jsonb_typeof(d) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(d) NOT BETWEEN 1 AND 4 THEN RETURN false; END IF;
  FOR o IN SELECT value FROM jsonb_array_elements(d) LOOP
   IF jsonb_typeof(o) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
   IF NOT (o ?& array['id','demo']) OR EXISTS(SELECT 1 FROM jsonb_object_keys(o) k(key) WHERE k.key NOT IN ('id','demo'))
    OR jsonb_typeof(o->'id') IS DISTINCT FROM 'string' OR (o->>'id') !~ '^[A-Za-z0-9-]{1,40}$'
    OR (o->>'id')=ANY(seen) OR NOT vibe_live.valid_slide_demo_candidate(o->'demo') THEN RETURN false; END IF;
   seen:=array_append(seen,o->>'id');
  END LOOP;
  RETURN true;
 END IF;
 RETURN p_body !~ '^VSLIDE[A-Z0-9]*:';
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END;
$content$;
REVOKE ALL ON FUNCTION vibe_live.valid_editable_slide_content_candidate(text) FROM PUBLIC,anon,authenticated,service_role;

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
    if not vibe_live.valid_editable_slide_content_candidate(before_content)
       or not vibe_live.valid_editable_slide_content_candidate(after_content)
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
