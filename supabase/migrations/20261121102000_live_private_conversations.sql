-- Canonical teacher/learner one-to-one text conversation inside an admitted Live session.
-- access: owner-only vibe_live.private_messages; no client role has table grants.
-- authorization-test: vibe_live.private_messages; scripts/test-live-classroom-pilot.mjs exercises joined learners,
-- nonparticipants, cross-teacher denial, revocation, read receipts and direct access denial.
BEGIN;

CREATE TABLE vibe_live.private_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES vibe_live.sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id),
  sender_role text NOT NULL CHECK (sender_role IN ('teacher','learner')),
  request_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(session_id,student_id,sender_role,request_id)
);
CREATE INDEX private_messages_thread ON vibe_live.private_messages(session_id,student_id,created_at,id);
ALTER TABLE vibe_live.private_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vibe_live.private_messages FROM PUBLIC,anon,authenticated,service_role;

DO $migration$
DECLARE
  src text := pg_get_functiondef('vibe_live.command(text,uuid,uuid,integer,jsonb)'::regprocedure);
  old text;
  replacement text;
BEGIN
  IF position('dm_send' in src)>0 THEN RAISE EXCEPTION 'Live private chat already exists: reconcile before migration'; END IF;

  old := 'result jsonb;';
  replacement := old||' dm_student uuid; dm_request uuid; dm_sender text; dm_prior vibe_live.private_messages%rowtype;';
  IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected Live command declarations'; END IF;
  src := replace(src,old,replacement);

  old := '''materials_delete'')'||E'\n or p_payload is null';
  replacement := '''materials_delete'',''dm_send'',''dm_list'',''dm_read'')'||E'\n or p_payload is null';
  IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected Live command actions'; END IF;
  src := replace(src,old,replacement);

  old := 'if p_action=''get'' then';
  replacement := 'if p_action in (''get'',''dm_list'') then';
  IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected Live read locks'; END IF;
  src := replace(src,old,replacement);

  old := 'if p_action not in (''get'',''start'') and';
  replacement := 'if p_action not in (''get'',''start'',''dm_list'',''dm_read'') and';
  IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected Live closed-session gate'; END IF;
  src := replace(src,old,replacement);

  -- The old Ask/Reply format remains, but replying a second time cannot overwrite a record.
  old := 'where q.session_id=room.id and q.id=target';
  replacement := 'where q.session_id=room.id and q.id=target and q.reply is null';
  IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected private reply gate'; END IF;
  src := replace(src,old,replacement);

  old := ' if p_action=''publish'' then';
  IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected Live action entry'; END IF;
  replacement := $chat$
 if p_action in ('dm_list','dm_send','dm_read') then
   -- The participant's student identity is resolved by auth.uid() for learners.
   -- Teachers must name an actual joined, currently entitled student in this room.
   if is_teacher then
     if coalesce(p_payload->>'studentId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       then raise exception 'live_invalid_recipient'; end if;
     dm_student:=(p_payload->>'studentId')::uuid;
     if not exists(
       select 1 from vibe_live.participants p where p.session_id=room.id and p.student_id=dm_student
     ) or not vibe_live.can_join(dm_student,room.teacher_id,room.mode,room.class_id,room.school_id,room.group_id)
       then raise exception 'live_not_authorized' using errcode='42501'; end if;
     dm_sender:='teacher';
   else
     if learner is null or p_payload ? 'studentId' then raise exception 'live_not_authorized' using errcode='42501'; end if;
     dm_student:=learner;
     dm_sender:='learner';
   end if;

   if p_action='dm_send' then
     if room.status<>'active' or room.expires_at<=now() then raise exception 'live_message_closed'; end if;
     body:=btrim(coalesce(p_payload->>'body',''));
     if char_length(body) not between 1 and 1000 or
        coalesce(p_payload->>'requestId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}
       then raise exception 'live_invalid_message'; end if;
     dm_request:=(p_payload->>'requestId')::uuid;
     select * into dm_prior from vibe_live.private_messages m
       where m.session_id=room.id and m.student_id=dm_student and m.sender_role=dm_sender and m.request_id=dm_request;
     if found then
       if dm_prior.body<>body then raise exception 'live_request_id_reused'; end if;
     else
       if (select count(*) from vibe_live.private_messages m where m.session_id=room.id and m.student_id=dm_student)>=120
         or (select count(*) from vibe_live.private_messages m where m.session_id=room.id)>=2400
         then raise exception 'live_message_limit'; end if;
       insert into vibe_live.private_messages(session_id,student_id,sender_role,request_id,body)
       values(room.id,dm_student,dm_sender,dm_request,body) on conflict do nothing;
       select * into dm_prior from vibe_live.private_messages m
         where m.session_id=room.id and m.student_id=dm_student and m.sender_role=dm_sender and m.request_id=dm_request;
       if dm_prior.body is distinct from body then raise exception 'live_request_id_reused'; end if;
     end if;
   elsif p_action='dm_read' then
     -- A read receipt is persisted only after the recipient opened this conversation.
     update vibe_live.private_messages m
     set read_at=clock_timestamp(),delivered_at=coalesce(m.delivered_at,clock_timestamp())
     where m.session_id=room.id and m.student_id=dm_student
       and m.sender_role<>dm_sender and m.read_at is null;
   else
     -- Delivered only when the recipient's client actually fetches the thread.
     update vibe_live.private_messages m set delivered_at=clock_timestamp()
       where m.session_id=room.id and m.student_id=dm_student
         and m.sender_role<>dm_sender and m.delivered_at is null;
   end if;
   return jsonb_build_object('messages',coalesce((
     select jsonb_agg(jsonb_build_object(
       'id',m.id,'body',m.body,'sender',m.sender_role,
       'createdAt',m.created_at,'deliveredAt',m.delivered_at,'readAt',m.read_at
     ) order by m.created_at,m.id)
     from (
       select id,body,sender_role,created_at,delivered_at,read_at from vibe_live.private_messages
       where session_id=room.id and student_id=dm_student
       order by created_at desc,id desc limit 120
     ) m
   ),'[]'::jsonb));
 end if;

$chat$;
  src:=replace(src,old,replacement||old);

  old := '''name'',s.name,''needsHelp'',p.needs_help';
  replacement := '''name'',s.name,''unreadDm'',(select count(*) from vibe_live.private_messages m where m.session_id=room.id and m.student_id=p.student_id and m.sender_role=''learner'' and m.read_at is null),''needsHelp'',p.needs_help';
  IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected participant projection'; END IF;
  src:=replace(src,old,replacement);

  old := '''handAckAt'',(select hand_ack_at from vibe_live.participants where session_id=room.id and student_id=learner),';
  replacement := '''dmUnread'',(select count(*) from vibe_live.private_messages m where m.session_id=room.id and m.student_id=learner and m.sender_role=''teacher'' and m.read_at is null),'||old;
  IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected learner projection'; END IF;
  src:=replace(src,old,replacement);

  EXECUTE src;
END $migration$;
COMMIT;

       then raise exception 'live_invalid_message'; end if;
     dm_request:=(p_payload->>'requestId')::uuid;
     select * into dm_prior from vibe_live.private_messages m
       where m.session_id=room.id and m.student_id=dm_student and m.sender_role=dm_sender and m.request_id=dm_request;
     if found then
       if dm_prior.body<>body then raise exception 'live_request_id_reused'; end if;
     else
       if (select count(*) from vibe_live.private_messages m where m.session_id=room.id and m.student_id=dm_student)>=120
         or (select count(*) from vibe_live.private_messages m where m.session_id=room.id)>=2400
         then raise exception 'live_message_limit'; end if;
       insert into vibe_live.private_messages(session_id,student_id,sender_role,request_id,body)
       values(room.id,dm_student,dm_sender,dm_request,body) on conflict do nothing;
       select * into dm_prior from vibe_live.private_messages m
         where m.session_id=room.id and m.student_id=dm_student and m.sender_role=dm_sender and m.request_id=dm_request;
       if dm_prior.body is distinct from body then raise exception 'live_request_id_reused'; end if;
     end if;
   elsif p_action='dm_read' then
     -- A read receipt is persisted only after the recipient opened this conversation.
     update vibe_live.private_messages m
     set read_at=clock_timestamp(),delivered_at=coalesce(m.delivered_at,clock_timestamp())
     where m.session_id=room.id and m.student_id=dm_student
       and m.sender_role<>dm_sender and m.read_at is null;
   else
     -- Delivered only when the recipient's client actually fetches the thread.
     update vibe_live.private_messages m set delivered_at=clock_timestamp()
       where m.session_id=room.id and m.student_id=dm_student
         and m.sender_role<>dm_sender and m.delivered_at is null;
   end if;
   return jsonb_build_object('messages',coalesce((
     select jsonb_agg(jsonb_build_object(
       'id',m.id,'body',m.body,'sender',m.sender_role,
       'createdAt',m.created_at,'deliveredAt',m.delivered_at,'readAt',m.read_at
     ) order by m.created_at,m.id)
     from (
       select id,body,sender_role,created_at,delivered_at,read_at from vibe_live.private_messages
       where session_id=room.id and student_id=dm_student
       order by created_at desc,id desc limit 120
     ) m
   ),'[]'::jsonb));
 end if;

$chat$;
  src:=replace(src,old,replacement||old);

  old := '''name'',s.name,''needsHelp'',p.needs_help';
  replacement := '''name'',s.name,''unreadDm'',(select count(*) from vibe_live.private_messages m where m.session_id=room.id and m.student_id=p.student_id and m.sender_role=''learner'' and m.read_at is null),''needsHelp'',p.needs_help';
  IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected participant projection'; END IF;
  src:=replace(src,old,replacement);

  old := '''handAckAt'',(select hand_ack_at from vibe_live.participants where session_id=room.id and student_id=learner),';
  replacement := '''dmUnread'',(select count(*) from vibe_live.private_messages m where m.session_id=room.id and m.student_id=learner and m.sender_role=''teacher'' and m.read_at is null),'||old;
  IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected learner projection'; END IF;
  src:=replace(src,old,replacement);

  EXECUTE src;
END $migration$;
COMMIT;
