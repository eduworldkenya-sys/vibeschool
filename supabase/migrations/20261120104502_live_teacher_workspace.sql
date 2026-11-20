BEGIN;
-- Private drafts and reusable presentations. The classroom RPC is the only client authority.
-- access: owner-only vibe_live.teacher_workspace
-- authorization-test: vibe_live.teacher_workspace; scripts/test-live-classroom-pilot.mjs verifies owner-scoped RPC, revision conflicts and direct role denial.
CREATE TABLE vibe_live.teacher_workspace (
 session_id uuid PRIMARY KEY REFERENCES vibe_live.sessions(id) ON DELETE CASCADE,
 revision integer NOT NULL CHECK(revision>0),
 draft jsonb NOT NULL CHECK(jsonb_typeof(draft)='object' AND pg_column_size(draft)<=240000),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- access: owner-only vibe_live.teacher_materials
-- authorization-test: vibe_live.teacher_materials; scripts/test-live-classroom-pilot.mjs verifies authenticated owner isolation, cross-teacher denial and direct role denial.
CREATE TABLE vibe_live.teacher_materials (
 id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(char_length(title) BETWEEN 1 AND 120),
 revision integer NOT NULL CHECK(revision>0),
 deck jsonb NOT NULL CHECK(jsonb_typeof(deck)='array' AND pg_column_size(deck)<=180000),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ON vibe_live.teacher_materials(owner_id,updated_at DESC);
ALTER TABLE vibe_live.teacher_workspace ENABLE ROW LEVEL SECURITY;
ALTER TABLE vibe_live.teacher_materials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vibe_live.teacher_workspace,vibe_live.teacher_materials FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION vibe_live.valid_draft_deck(p_deck jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $validator$
DECLARE s jsonb;
BEGIN
 IF jsonb_typeof(p_deck) IS DISTINCT FROM 'array' OR pg_column_size(p_deck)>180000 THEN RETURN false; END IF;
 IF jsonb_array_length(p_deck) NOT BETWEEN 1 AND 30 THEN RETURN false; END IF;
 FOR s IN SELECT value FROM jsonb_array_elements(p_deck) LOOP
  IF jsonb_typeof(s) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(s) AS keys(key) WHERE key NOT IN ('title','body','diagram','theme','layout','font','notes')) THEN RETURN false; END IF;
  IF jsonb_typeof(s->'title') IS DISTINCT FROM 'string' OR char_length(s->>'title')>120
   OR jsonb_typeof(s->'body') IS DISTINCT FROM 'string' OR char_length(s->>'body')>3878
   OR (s?'notes' AND (jsonb_typeof(s->'notes') IS DISTINCT FROM 'string' OR char_length(s->>'notes')>2000))
   OR (s?'diagram' AND coalesce(s->>'diagram','') NOT IN ('none','fraction-circle','fraction-bars','number-line','ruler','protractor','coordinate-grid','counters','base-ten','clock','money','solids','handwriting','music'))
   OR (s?'theme' AND coalesce(s->>'theme','') NOT IN ('paper','ocean','forest','night'))
   OR (s?'layout' AND coalesce(s->>'layout','') NOT IN ('wide','portrait'))
   OR (s?'font' AND coalesce(s->>'font','') NOT IN ('normal','large')) THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END;
$validator$;
CREATE FUNCTION vibe_live.valid_teacher_workspace(p_draft jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $validator$
DECLARE p jsonb; c jsonb; k text; val text;
BEGIN
 IF jsonb_typeof(p_draft) IS DISTINCT FROM 'object' OR pg_column_size(p_draft)>240000 THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_draft) AS keys(key) WHERE key NOT IN ('board','boardPages','boardPage','slides','slideIndex','mode','body','key','clock','composers')) THEN RETURN false; END IF;
 IF NOT vibe_live.valid_draft_deck(p_draft->'slides')
 OR jsonb_typeof(p_draft->'boardPages') IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_draft->'board') IS DISTINCT FROM 'string'
 OR coalesce(p_draft->>'slideIndex','') !~ '^[0-9]{1,2}$' OR coalesce(p_draft->>'boardPage','') !~ '^[0-9]{1,2}$'
 OR coalesce(p_draft->>'mode','') NOT IN ('teach','quiz','exercise','poll','clock','board')
 OR jsonb_typeof(p_draft->'body') IS DISTINCT FROM 'string' OR char_length(p_draft->>'body')>4000
 OR coalesce(p_draft->>'key','')<>'' OR coalesce(p_draft->>'clock','') !~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 OR jsonb_typeof(p_draft->'composers') IS DISTINCT FROM 'object' THEN RETURN false; END IF;
 IF jsonb_array_length(p_draft->'boardPages') NOT BETWEEN 1 AND 30
 OR (p_draft->>'boardPage')::integer NOT BETWEEN 0 AND jsonb_array_length(p_draft->'boardPages')-1
 OR (p_draft->>'slideIndex')::integer NOT BETWEEN 0 AND jsonb_array_length(p_draft->'slides')-1 THEN RETURN false; END IF;
 FOR p IN SELECT value FROM jsonb_array_elements((p_draft->'boardPages')||jsonb_build_array(p_draft->'board')) LOOP
  IF jsonb_typeof(p) IS DISTINCT FROM 'string' THEN RETURN false; END IF;
  val:=p#>>'{}';
  IF char_length(val)>3500 OR (val<>'' AND val !~ '^[0-9,;| ]+$' AND NOT vibe_live.valid_object_board(val)) THEN RETURN false; END IF;
 END LOOP;
 FOR k,c IN SELECT key,value FROM jsonb_each(p_draft->'composers') LOOP
  IF k NOT IN ('teach','quiz','exercise','poll','clock','board') OR jsonb_typeof(c) IS DISTINCT FROM 'object'
   OR jsonb_typeof(c->'body') IS DISTINCT FROM 'string' OR char_length(c->>'body')>4000 OR coalesce(c->>'key','')<>'' THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(c) AS keys(key) WHERE key NOT IN ('body','key')) THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END;
$validator$;
REVOKE ALL ON FUNCTION vibe_live.valid_draft_deck(jsonb),vibe_live.valid_teacher_workspace(jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- These private actions extend the one canonical room command. No roles,
-- session membership rules or published prompt authorization are relaxed.
DO $migration$
DECLARE src text:=pg_get_functiondef('vibe_live.command(text,uuid,uuid,integer,jsonb)'::regprocedure); old text; new text;
BEGIN
 old:='kind text; body text; key_text text; target uuid; result jsonb;';
 new:=old||' workspace_row vibe_live.teacher_workspace%rowtype; material_row vibe_live.teacher_materials%rowtype; expected_revision integer; material_id uuid; material_title text;';
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected draft declaration'; END IF;
 src:=replace(src,old,new);
 old:=$a$'lower','ask','note','reply'$a$;
 new:=old||$a$,'workspace_get','workspace_save','materials_list','materials_get','materials_save','materials_delete'$a$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected action whitelist'; END IF;
 src:=replace(src,old,new);
 old:='pg_column_size(p_payload)>28000';
 new:=$a$pg_column_size(p_payload)>case when p_action='workspace_save' then 245000 when p_action='materials_save' then 185000 else 28000 end$a$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected payload ceiling'; END IF;
 src:=replace(src,old,new);
 old:=$a$ if p_action='groups' then$a$;
 new:=$b$
 if p_action in ('materials_list','materials_get','materials_save','materials_delete') then
   if not exists(select 1 from public.profiles p where p.id=caller and (p.role::text='teacher' or vibe_live.host_allowed(caller,'homeschool',null,null,null))) then raise exception 'live_not_authorized' using errcode='42501'; end if;
   if p_action='materials_list' then
     return jsonb_build_object('materials',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'revision',m.revision,'slideCount',jsonb_array_length(m.deck),'updatedAt',m.updated_at) order by m.updated_at desc,m.id) from vibe_live.teacher_materials m where m.owner_id=caller),'[]'::jsonb));
   end if;
   material_id:=nullif(p_payload->>'id','')::uuid;
   if material_id is null then raise exception 'live_invalid_material'; end if;
   if p_action='materials_get' then
     select * into material_row from vibe_live.teacher_materials where id=material_id and owner_id=caller;
     if not found then raise exception 'live_not_authorized' using errcode='42501'; end if;
     return jsonb_build_object('id',material_row.id,'title',material_row.title,'revision',material_row.revision,'slides',material_row.deck);
   end if;
   perform 1 from public.profiles where id=caller for update;
   select * into material_row from vibe_live.teacher_materials where id=material_id for update;
   if found and material_row.owner_id<>caller then raise exception 'live_not_authorized' using errcode='42501'; end if;
   if coalesce(p_payload->>'revision','') !~ '^[0-9]{1,9}$' then raise exception 'live_invalid_revision'; end if;
   expected_revision:=(p_payload->>'revision')::integer;
   if expected_revision<>coalesce(material_row.revision,0) then raise exception 'live_material_conflict'; end if;
   if p_action='materials_delete' then
     if material_row.id is null then raise exception 'live_not_authorized' using errcode='42501'; end if;
     delete from vibe_live.teacher_materials where id=material_id and owner_id=caller;
     return jsonb_build_object('deleted',true);
   end if;
   material_title:=btrim(coalesce(p_payload->>'title',''));
   if char_length(material_title) not between 1 and 120 or not vibe_live.valid_draft_deck(p_payload->'slides') then raise exception 'live_invalid_material'; end if;
   if material_row.id is null and (select count(*) from vibe_live.teacher_materials where owner_id=caller)>=40 then raise exception 'live_material_limit'; end if;
   insert into vibe_live.teacher_materials(id,owner_id,title,revision,deck) values(material_id,caller,material_title,expected_revision+1,p_payload->'slides')
     on conflict(id) do update set title=excluded.title,revision=excluded.revision,deck=excluded.deck,updated_at=clock_timestamp()
     where vibe_live.teacher_materials.owner_id=caller returning * into material_row;
   if not found then raise exception 'live_not_authorized' using errcode='42501'; end if;
   return jsonb_build_object('id',material_row.id,'title',material_row.title,'revision',material_row.revision,'slides',material_row.deck);
 end if;
 if p_action='groups' then$b$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected material entry'; END IF;
 src:=replace(src,old,new);
 old:=$a$'end','ack','reply') and not is_teacher$a$;
 new:=$a$'end','ack','reply','workspace_get','workspace_save') and not is_teacher$a$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected workspace role gate'; END IF;
 src:=replace(src,old,new);
 old:=$a$ if p_action='publish' then
   if room.status<>$a$;
 new:=$b$
 if p_action in ('workspace_get','workspace_save') then
   select * into workspace_row from vibe_live.teacher_workspace where session_id=room.id;
   if p_action='workspace_get' then return jsonb_build_object('revision',coalesce(workspace_row.revision,0),'draft',workspace_row.draft); end if;
   if coalesce(p_payload->>'revision','') !~ '^[0-9]{1,9}$' then raise exception 'live_invalid_revision'; end if;
   expected_revision:=(p_payload->>'revision')::integer;
   if expected_revision<>coalesce(workspace_row.revision,0) then raise exception 'live_workspace_conflict'; end if;
   if not vibe_live.valid_teacher_workspace(p_payload->'draft') then raise exception 'live_invalid_workspace'; end if;
   insert into vibe_live.teacher_workspace(session_id,revision,draft) values(room.id,expected_revision+1,p_payload->'draft')
     on conflict(session_id) do update set revision=excluded.revision,draft=excluded.draft,updated_at=clock_timestamp() returning * into workspace_row;
   return jsonb_build_object('revision',workspace_row.revision,'draft',workspace_row.draft);
 end if;
 if p_action='publish' then
   if room.status<>$b$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected workspace action'; END IF;
 src:=replace(src,old,new);
 EXECUTE src;
END;
$migration$;
COMMIT;
