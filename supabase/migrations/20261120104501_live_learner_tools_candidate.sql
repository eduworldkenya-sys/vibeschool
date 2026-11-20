-- Candidate after lesson history. Preserve canonical authorization.
BEGIN;
ALTER TABLE vibe_live.participants ADD COLUMN hand_ack_at timestamptz;
-- access: owner-only vibe_live.learner_notes
-- authorization-test: vibe_live.learner_notes; scripts/test-live-classroom-pilot.mjs and scripts/test-live-lesson-history-staging.mjs exercise direct denial and learner isolation.
CREATE TABLE vibe_live.learner_notes (
 session_id uuid NOT NULL, student_id uuid NOT NULL,
 body text NOT NULL CHECK(char_length(body)<=8000),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(session_id,student_id),
 FOREIGN KEY(session_id,student_id) REFERENCES vibe_live.participants(session_id,student_id) ON DELETE CASCADE
);
-- access: owner-only vibe_live.learner_questions
-- authorization-test: vibe_live.learner_questions; scripts/test-live-classroom-pilot.mjs and scripts/test-live-lesson-history-staging.mjs exercise direct denial and scoped teacher replies.
CREATE TABLE vibe_live.learner_questions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid NOT NULL,student_id uuid NOT NULL,
 request_id uuid NOT NULL,body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 1000),
 reply text CHECK(char_length(reply) BETWEEN 1 AND 1000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),replied_at timestamptz,
 UNIQUE(session_id,student_id,request_id),
 FOREIGN KEY(session_id,student_id) REFERENCES vibe_live.participants(session_id,student_id) ON DELETE CASCADE
);
ALTER TABLE vibe_live.learner_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vibe_live.learner_questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vibe_live.learner_notes,vibe_live.learner_questions FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX ON vibe_live.learner_questions(session_id,created_at,id);
DO $migration$
DECLARE
 src text:=pg_get_functiondef('vibe_live.command(text,uuid,uuid,integer,jsonb)'::regprocedure);
 old text; new text;
BEGIN
 IF position('lesson_position' in src)=0 OR position('learner_questions' in src)>0 THEN
  RAISE EXCEPTION 'Unexpected command version';
 END IF;
 old:=$a$'list','groups','start','get','join','publish','pause','resume','reveal','end','answer','help','ack'$a$;
 new:=old||$a$,'lower','ask','note','reply'$a$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected actions'; END IF;
 src:=replace(src,old,new);
 old:=$a$if p_action in ('publish','pause','resume','reveal','end','ack') and not is_teacher then$a$;
 new:=$a$if p_action in ('publish','pause','resume','reveal','end','ack','reply') and not is_teacher then$a$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected teacher gate'; END IF;
 src:=replace(src,old,new);
 old:=$a$if p_action in ('join','answer','help') and (learner is null or is_teacher) then$a$;
 new:=$a$if p_action in ('join','answer','help','lower','ask','note') and (learner is null or is_teacher) then$a$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected learner gate'; END IF;
 src:=replace(src,old,new);
 old:=$a$elsif p_action='help' then
   update vibe_live.participants set needs_help=true where session_id=room.id and student_id=learner;
 elsif p_action='ack' then
   target := (p_payload->>'studentId')::uuid;
   update vibe_live.participants set needs_help=false where session_id=room.id and student_id=target;$a$;
 new:=$b$elsif p_action='help' then
   update vibe_live.participants set needs_help=true,hand_ack_at=null where session_id=room.id and student_id=learner and not needs_help;
 elsif p_action='lower' then
   update vibe_live.participants set needs_help=false,hand_ack_at=null where session_id=room.id and student_id=learner;
 elsif p_action='ack' then
   target := (p_payload->>'studentId')::uuid;
   update vibe_live.participants set needs_help=false,hand_ack_at=clock_timestamp()
    where session_id=room.id and student_id=target and needs_help
      and vibe_live.can_join(target,room.teacher_id,room.mode,room.class_id,room.school_id,room.group_id);
 elsif p_action='note' then
   body:=coalesce(p_payload->>'body','');
   if char_length(body)>8000 then raise exception 'live_note_too_long'; end if;
   insert into vibe_live.learner_notes(session_id,student_id,body) values(room.id,learner,body)
     on conflict(session_id,student_id) do update set body=excluded.body,updated_at=clock_timestamp();
 elsif p_action='ask' then
   body:=btrim(coalesce(p_payload->>'body',''));
   target:=nullif(p_payload->>'requestId','')::uuid;
   if target is null or char_length(body) not between 1 and 1000 then raise exception 'live_invalid_question'; end if;
   if exists(select 1 from vibe_live.learner_questions q where q.session_id=room.id and q.student_id=learner and q.request_id=target and q.body<>btrim(coalesce(p_payload->>'body',''))) then
     raise exception 'live_request_id_reused';
   end if;
   if not exists(select 1 from vibe_live.learner_questions q where q.session_id=room.id and q.student_id=learner and q.request_id=target) then
     if (select count(*) from vibe_live.learner_questions where session_id=room.id and student_id=learner)>=20
       or (select count(*) from vibe_live.learner_questions where session_id=room.id)>=500 then raise exception 'live_question_limit'; end if;
     insert into vibe_live.learner_questions(session_id,student_id,request_id,body) values(room.id,learner,target,body);
   end if;
 elsif p_action='reply' then
   target:=nullif(p_payload->>'questionId','')::uuid;
   body:=btrim(coalesce(p_payload->>'body',''));
   if target is null or char_length(body) not between 1 and 1000 then raise exception 'live_invalid_reply'; end if;
   update vibe_live.learner_questions q set reply=btrim(coalesce(p_payload->>'body','')),replied_at=clock_timestamp()
     where q.session_id=room.id and q.id=target
       and vibe_live.can_join(q.student_id,room.teacher_id,room.mode,room.class_id,room.school_id,room.group_id);
   if not found then raise exception 'live_not_authorized' using errcode='42501'; end if;$b$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected help block'; END IF;
 src:=replace(src,old,new);
 old:=' return result;';
 new:=$b$
 if is_teacher then
   result:=result||jsonb_build_object('questions',coalesce((
      select jsonb_agg(jsonb_build_object('id',q.id,'body',q.body,'reply',q.reply,'name',s.name) order by q.created_at,q.id)
      from vibe_live.learner_questions q join public.students s on s.id=q.student_id and s.deleted_at is null
      where q.session_id=room.id and vibe_live.can_join(q.student_id,room.teacher_id,room.mode,room.class_id,room.school_id,room.group_id)
   ),'[]'::jsonb));
 else
   result:=result||jsonb_build_object(
     'handAckAt',(select hand_ack_at from vibe_live.participants where session_id=room.id and student_id=learner),
     'ownNote',coalesce((select n.body from vibe_live.learner_notes n where n.session_id=room.id and n.student_id=learner),''),
     'questions',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'body',q.body,'reply',q.reply) order by q.created_at,q.id)
       from vibe_live.learner_questions q where q.session_id=room.id and q.student_id=learner),'[]'::jsonb));
 end if;
 return result;$b$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected response anchor'; END IF;
 src:=replace(src,old,new);
 EXECUTE src;
END;
$migration$;
COMMIT;
