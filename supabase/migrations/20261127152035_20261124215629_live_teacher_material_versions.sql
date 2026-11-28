BEGIN;
-- access: owner-only vibe_live.teacher_material_versions
-- authorization-test: vibe_live.teacher_material_versions; scripts/test-live-classroom-pilot.mjs verifies private history, bounded retention and direct access denial.
CREATE TABLE vibe_live.teacher_material_versions (
 material_id uuid NOT NULL REFERENCES vibe_live.teacher_materials(id) ON DELETE CASCADE,
 revision integer NOT NULL CHECK(revision>0),
 title text NOT NULL CHECK(char_length(title) BETWEEN 1 AND 120),
 deck jsonb NOT NULL CHECK(jsonb_typeof(deck)='array' AND pg_column_size(deck)<=180000),
 updated_at timestamptz NOT NULL,
 PRIMARY KEY(material_id,revision)
);
ALTER TABLE vibe_live.teacher_material_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vibe_live.teacher_material_versions FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION vibe_live.archive_teacher_material_version() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $archive$
BEGIN
 IF NEW.revision=OLD.revision THEN RETURN NEW; END IF;
 IF NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'live_invalid_revision'; END IF;
 INSERT INTO vibe_live.teacher_material_versions(material_id,revision,title,deck,updated_at)
 VALUES(OLD.id,OLD.revision,OLD.title,OLD.deck,OLD.updated_at);
 DELETE FROM vibe_live.teacher_material_versions WHERE material_id=NEW.id AND revision<NEW.revision-10;
 RETURN NEW;
END;
$archive$;
REVOKE ALL ON FUNCTION vibe_live.archive_teacher_material_version() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER archive_teacher_material_version AFTER UPDATE ON vibe_live.teacher_materials
 FOR EACH ROW EXECUTE FUNCTION vibe_live.archive_teacher_material_version();

-- Extend the existing owner-authorized materials command, not a new public API.
DO $migration$
DECLARE src text:=pg_get_functiondef('vibe_live.command(text,uuid,uuid,integer,jsonb)'::regprocedure); old text; new text;
BEGIN
 old:=$a$'materials_list','materials_get','materials_save','materials_delete'$a$;
 new:=old||$a$,'materials_versions','materials_version_get'$a$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>2 THEN RAISE EXCEPTION 'Unexpected materials action contract'; END IF;
 src:=replace(src,old,new);
 old:=$a$   if p_action='materials_get' then$a$;
 new:=$b$   if p_action in ('materials_versions','materials_version_get') then
     select * into material_row from vibe_live.teacher_materials where id=material_id and owner_id=caller;
     if not found then raise exception 'live_not_authorized' using errcode='42501'; end if;
     if p_action='materials_versions' then
       return jsonb_build_object('versions',(
         select jsonb_agg(jsonb_build_object('revision',v.revision,'title',v.title,'slideCount',jsonb_array_length(v.deck),'updatedAt',v.updated_at) order by v.revision desc)
         from (
           select material_row.revision as revision,material_row.title as title,material_row.deck as deck,material_row.updated_at as updated_at
           union all
           select h.revision,h.title,h.deck,h.updated_at from vibe_live.teacher_material_versions h where h.material_id=material_row.id
         ) v));
     end if;
     if coalesce(p_payload->>'revision','') !~ '^[1-9][0-9]{0,8}$' then raise exception 'live_invalid_revision'; end if;
     expected_revision:=(p_payload->>'revision')::integer;
     if expected_revision=material_row.revision then
       return jsonb_build_object('id',material_row.id,'title',material_row.title,'revision',material_row.revision,'slides',material_row.deck);
     end if;
     select jsonb_build_object('id',h.material_id,'title',h.title,'revision',h.revision,'slides',h.deck)
       into result from vibe_live.teacher_material_versions h where h.material_id=material_row.id and h.revision=expected_revision;
     if not found then raise exception 'live_material_version_unavailable'; end if;
     return result;
   end if;
   if p_action='materials_get' then$b$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected materials read contract'; END IF;
 EXECUTE replace(src,old,new);
END;
$migration$;
COMMIT;
