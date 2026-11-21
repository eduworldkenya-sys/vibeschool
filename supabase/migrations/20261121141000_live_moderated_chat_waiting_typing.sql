-- Moderated Live text chat, teacher-controlled Open-class admission and
-- ephemeral one-to-one typing state, all through the canonical authorized RPC.
-- Private data never receives direct client grants or public Realtime payloads.
BEGIN;
-- access: owner-only vibe_live.class_messages
-- authorization-test: vibe_live.class_messages; scripts/test-live-classroom-pilot.mjs
CREATE TABLE vibe_live.class_messages(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL REFERENCES vibe_live.sessions(id) ON DELETE CASCADE,
 sender_profile_id uuid NOT NULL REFERENCES public.profiles(id),
 sender_student_id uuid REFERENCES public.students(id),
 sender_role text NOT NULL CHECK(sender_role IN ('teacher','learner')),
 request_id uuid NOT NULL,
 body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 500),
 hidden_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(session_id,sender_profile_id,request_id),
 CHECK((sender_role='teacher' AND sender_student_id IS NULL) OR (sender_role='learner' AND sender_student_id IS NOT NULL))
);
CREATE INDEX ON vibe_live.class_messages(session_id,created_at DESC,id DESC);

-- access: owner-only vibe_live.class_reports
-- authorization-test: vibe_live.class_reports; scripts/test-live-classroom-pilot.mjs
CREATE TABLE vibe_live.class_reports(
 message_id uuid NOT NULL REFERENCES vibe_live.class_messages(id) ON DELETE CASCADE,
 session_id uuid NOT NULL REFERENCES vibe_live.sessions(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES public.students(id),
 reason text NOT NULL CHECK(char_length(reason) BETWEEN 1 AND 200),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(message_id,student_id)
);

-- access: owner-only vibe_live.waiting_requests
-- authorization-test: vibe_live.waiting_requests; scripts/test-live-classroom-pilot.mjs
CREATE TABLE vibe_live.waiting_requests(
 session_id uuid NOT NULL REFERENCES vibe_live.sessions(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES public.students(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','admitted','denied')),
 requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 decided_at timestamptz,
 decided_by uuid REFERENCES public.profiles(id),
 PRIMARY KEY(session_id,student_id)
);

-- access: owner-only vibe_live.dm_typing
-- authorization-test: vibe_live.dm_typing; scripts/test-live-classroom-pilot.mjs
CREATE TABLE vibe_live.dm_typing(
 session_id uuid NOT NULL REFERENCES vibe_live.sessions(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES public.students(id),
 sender_role text NOT NULL CHECK(sender_role IN ('teacher','learner')),
 touched_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(session_id,student_id,sender_role)
);
ALTER TABLE vibe_live.class_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE vibe_live.class_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE vibe_live.waiting_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE vibe_live.dm_typing ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vibe_live.class_messages,vibe_live.class_reports,vibe_live.waiting_requests,vibe_live.dm_typing FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE vibe_live.sessions ADD COLUMN chat_enabled boolean NOT NULL DEFAULT false;

DO $migration$
DECLARE
 src text := pg_get_functiondef('vibe_live.command(text,uuid,uuid,integer,jsonb)'::regprocedure);
 old text; replacement text;
BEGIN
 IF position('chat_toggle' in src)>0 OR position('dm_typing' in src)>0 THEN
   RAISE EXCEPTION 'Moderation or typing actions already installed: reconcile before applying';
 END IF;
 old := 'result jsonb;';
 replacement := old||' chat_request uuid; chat_message uuid; chat_body text; chat_student uuid;';
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected command declaration'; END IF;
 src:=replace(src,old,replacement);

 old := '''dm_read'')'||E'\n or p_payload is null';
 replacement := '''dm_read'',''dm_typing'',''chat_list'',''chat_send'',''chat_toggle'',''chat_hide'',''chat_report'',''wait_request'',''wait_status'',''wait_list'',''wait_decide'')'||E'\n or p_payload is null';
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected Live action whitelist'; END IF;
 src:=replace(src,old,replacement);

 old := $anchor$if p_action in ('get','dm_list') then$anchor$;
 replacement := $anchor$if p_action in ('get','dm_list','chat_list','wait_list','wait_status') then$anchor$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected read-only room lock'; END IF;
 src:=replace(src,old,replacement);

 old := $anchor$'end','ack','reply','workspace_get','workspace_save') and not is_teacher$anchor$;
 replacement := $anchor$'end','ack','reply','workspace_get','workspace_save','chat_toggle','chat_hide','wait_list','wait_decide') and not is_teacher$anchor$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected teacher-only action gate'; END IF;
 src:=replace(src,old,replacement);

 old := $anchor$if p_action in ('join','answer','help','lower','ask','note') and (learner is null or is_teacher) then$anchor$;
 replacement := $anchor$if p_action in ('join','answer','help','lower','ask','note','wait_request','wait_status','chat_report') and (learner is null or is_teacher) then$anchor$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected learner role gate'; END IF;
 src:=replace(src,old,replacement);

 old := $anchor$if p_action='join' then
   insert into vibe_live.participants(session_id,student_id) values(room.id,learner) on conflict do nothing;
 elsif not is_teacher and not exists(select 1 from vibe_live.participants where session_id=room.id and student_id=learner) then$anchor$;
 replacement := $anchor$if p_action='join' then
   if room.mode='open' and not exists(
     select 1 from vibe_live.waiting_requests w where w.session_id=room.id and w.student_id=learner and w.status='admitted'
   ) then raise exception 'live_waiting_approval_required'; end if;
   insert into vibe_live.participants(session_id,student_id) values(room.id,learner) on conflict do nothing;
 elsif p_action in ('wait_request','wait_status') then
   if room.mode<>'open' or is_teacher or learner is null then raise exception 'live_not_authorized' using errcode='42501'; end if;
 elsif not is_teacher and not exists(select 1 from vibe_live.participants where session_id=room.id and student_id=learner) then$anchor$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected Live join and membership gate'; END IF;
 src:=replace(src,old,replacement);

 old := $anchor$ if p_action in ('dm_list','dm_send','dm_read') then$anchor$;
 replacement := $block$
 if p_action in ('wait_request','wait_status','wait_list','wait_decide') then
   if room.mode<>'open' then raise exception 'live_not_authorized' using errcode='42501'; end if;
   if p_action='wait_status' then
     return jsonb_build_object('status',(
       select w.status from vibe_live.waiting_requests w where w.session_id=room.id and w.student_id=learner
     ));
   end if;
   if p_action='wait_request' then
     if room.status<>'active' then raise exception 'live_waiting_closed'; end if;
     if exists(select 1 from vibe_live.waiting_requests w where w.session_id=room.id and w.student_id=learner and w.status='denied')
       then raise exception 'live_waiting_denied'; end if;
     if not exists(select 1 from vibe_live.participants p where p.session_id=room.id and p.student_id=learner) then
       insert into vibe_live.waiting_requests(session_id,student_id)
       values(room.id,learner) on conflict(session_id,student_id) do nothing;
       if found then update vibe_live.sessions set version=version+1 where id=room.id returning * into room; end if;
     end if;
     return jsonb_build_object('status',coalesce((select w.status from vibe_live.waiting_requests w
       where w.session_id=room.id and w.student_id=learner),'admitted'));
   end if;
   if p_action='wait_decide' then
     if coalesce(p_payload->>'studentId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(p_payload->>'admit','') not in ('true','false') then raise exception 'live_invalid_waiting_decision'; end if;
     chat_student:=(p_payload->>'studentId')::uuid;
     if not vibe_live.can_join(chat_student,room.teacher_id,room.mode,room.class_id,room.school_id,room.group_id)
       then raise exception 'live_not_authorized' using errcode='42501'; end if;
     update vibe_live.waiting_requests w
       set status=case when p_payload->>'admit'='true' then 'admitted' else 'denied' end,
           decided_at=clock_timestamp(),decided_by=caller
       where w.session_id=room.id and w.student_id=chat_student and w.status='pending';
     if not found then raise exception 'live_waiting_missing'; end if;
     update vibe_live.sessions set version=version+1 where id=room.id returning * into room;
     return jsonb_build_object('decided',true);
   end if;
   return jsonb_build_object('requests',coalesce((
     select jsonb_agg(jsonb_build_object('studentId',w.student_id,'name',s.name,'requestedAt',w.requested_at) order by w.requested_at,w.student_id)
     from vibe_live.waiting_requests w join public.students s on s.id=w.student_id and s.deleted_at is null
     where w.session_id=room.id and w.status='pending'
       and vibe_live.can_join(w.student_id,room.teacher_id,room.mode,room.class_id,room.school_id,room.group_id)
   ),'[]'::jsonb));
 end if;

$block$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected private DM action anchor'; END IF;
 src:=replace(src,old,replacement||old);

 old := $anchor$if p_action in ('dm_list','dm_send','dm_read') then$anchor$;
 replacement := $anchor$if p_action in ('dm_list','dm_send','dm_read','dm_typing') then$anchor$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected DM action gate'; END IF;
 src:=replace(src,old,replacement);

 old := $anchor$   if p_action='dm_send' then$anchor$;
 replacement := $typing$
   if p_action='dm_typing' then
     if room.status<>'active' or room.expires_at<=now() then raise exception 'live_message_closed'; end if;
     if coalesce(p_payload->>'typing','') not in ('true','false') then raise exception 'live_invalid_typing'; end if;
     if p_payload->>'typing'='true' then
       if not exists(select 1 from vibe_live.dm_typing t where t.session_id=room.id and t.student_id=dm_student
           and t.sender_role=dm_sender and t.touched_at>clock_timestamp()-interval '2 seconds') then
         insert into vibe_live.dm_typing(session_id,student_id,sender_role)
         values(room.id,dm_student,dm_sender)
         on conflict(session_id,student_id,sender_role) do update set touched_at=clock_timestamp();
       end if;
     else
       delete from vibe_live.dm_typing t where t.session_id=room.id and t.student_id=dm_student and t.sender_role=dm_sender;
     end if;
     return jsonb_build_object('typingSaved',true);
   end if;
$typing$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected DM send branch'; END IF;
 src:=replace(src,old,replacement||old);

 old := $anchor$return jsonb_build_object('messages',coalesce(($anchor$;
 replacement := $anchor$return jsonb_build_object('peerTyping',exists(
     select 1 from vibe_live.dm_typing t where t.session_id=room.id and t.student_id=dm_student
       and t.sender_role<>dm_sender and t.touched_at>clock_timestamp()-interval '7 seconds'
   ),'messages',coalesce(($anchor$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected DM list projection'; END IF;
 src:=replace(src,old,replacement);

 old := $anchor$ if p_action='publish' then$anchor$;
 replacement := $chat$
 if p_action in ('chat_list','chat_send','chat_toggle','chat_hide','chat_report') then
   if p_action='chat_list' then
     return jsonb_build_object('enabled',room.chat_enabled,'messages',coalesce((
       select jsonb_agg(jsonb_build_object(
         'id',q.id,'body',q.body,'author',case when q.sender_role='teacher' then 'Teacher' else coalesce(s.name,'Learner') end,
         'own',q.sender_profile_id=caller,'hidden',q.hidden_at is not null,'sentAt',q.created_at,
         'reports',case when is_teacher then (select count(*) from vibe_live.class_reports rep where rep.message_id=q.id) else 0 end
       ) order by q.created_at,q.id)
       from (select m.* from vibe_live.class_messages m where m.session_id=room.id and
         (is_teacher or m.hidden_at is null) order by m.created_at desc,m.id desc limit 80) q
       left join public.students s on s.id=q.sender_student_id and s.deleted_at is null
     ),'[]'::jsonb));
   end if;
   if p_action='chat_toggle' then
     if coalesce(p_payload->>'enabled','') not in ('true','false') then raise exception 'live_invalid_chat_setting'; end if;
     update vibe_live.sessions set chat_enabled=(p_payload->>'enabled')::boolean,version=version+1
       where id=room.id returning * into room;
     return jsonb_build_object('enabled',room.chat_enabled);
   end if;
   if p_action='chat_send' then
     if not room.chat_enabled or room.status<>'active' then raise exception 'live_chat_closed'; end if;
     chat_body:=btrim(coalesce(p_payload->>'body',''));
     if char_length(chat_body) not between 1 and 500 or
       coalesce(p_payload->>'requestId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       then raise exception 'live_invalid_chat_message'; end if;
     chat_request:=(p_payload->>'requestId')::uuid;
     if exists(select 1 from vibe_live.class_messages m where m.session_id=room.id and m.sender_profile_id=caller and m.request_id=chat_request and m.body<>chat_body)
       then raise exception 'live_request_id_reused'; end if;
     if not exists(select 1 from vibe_live.class_messages m where m.session_id=room.id and m.sender_profile_id=caller and m.request_id=chat_request) then
       if (select count(*) from vibe_live.class_messages m where m.session_id=room.id)>=400
         or (select count(*) from vibe_live.class_messages m where m.session_id=room.id and m.sender_profile_id=caller)>=80
         then raise exception 'live_chat_limit'; end if;
       if exists(select 1 from vibe_live.class_messages m where m.session_id=room.id and m.sender_profile_id=caller
         and m.created_at>clock_timestamp()-interval '2 seconds') then raise exception 'live_chat_rate_limit'; end if;
       insert into vibe_live.class_messages(session_id,sender_profile_id,sender_student_id,sender_role,request_id,body)
       values(room.id,caller,case when is_teacher then null else learner end,
         case when is_teacher then 'teacher' else 'learner' end,chat_request,chat_body)
       on conflict(session_id,sender_profile_id,request_id) do nothing;
       update vibe_live.sessions set version=version+1 where id=room.id returning * into room;
     end if;
     return jsonb_build_object('sent',true);
   end if;
   if p_action='chat_hide' then
     chat_message:=nullif(p_payload->>'messageId','')::uuid;
     if chat_message is null then raise exception 'live_invalid_chat_message'; end if;
     update vibe_live.class_messages m set hidden_at=clock_timestamp()
       where m.session_id=room.id and m.id=chat_message and m.hidden_at is null;
     if not found then raise exception 'live_chat_message_missing'; end if;
     update vibe_live.sessions set version=version+1 where id=room.id returning * into room;
     return jsonb_build_object('hidden',true);
   end if;
   if p_action='chat_report' then
     chat_message:=nullif(p_payload->>'messageId','')::uuid;
     chat_body:=btrim(coalesce(p_payload->>'reason',''));
     if chat_message is null or char_length(chat_body) not between 1 and 200 then raise exception 'live_invalid_report'; end if;
     if not exists(select 1 from vibe_live.class_messages m where m.session_id=room.id and m.id=chat_message
       and m.hidden_at is null and m.sender_profile_id<>caller) then raise exception 'live_not_authorized' using errcode='42501'; end if;
     insert into vibe_live.class_reports(message_id,session_id,student_id,reason)
       values(chat_message,room.id,learner,chat_body)
       on conflict(message_id,student_id) do nothing;
     update vibe_live.sessions set version=version+1 where id=room.id returning * into room;
     return jsonb_build_object('reported',true);
   end if;
 end if;
$chat$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected publish branch'; END IF;
 src:=replace(src,old,replacement||old);

 old:=$anchor$'teacher',is_teacher,'mode',room.mode,'expiresAt'$anchor$;
 replacement:=$anchor$'teacher',is_teacher,'mode',room.mode,'chatEnabled',room.chat_enabled,'expiresAt'$anchor$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected room response projection'; END IF;
 src:=replace(src,old,replacement);

 old:=$anchor$'canJoin',vibe_live.can_join(learner,x.teacher_id,x.mode,x.class_id,x.school_id,x.group_id)$anchor$;
 replacement:=old||$anchor$,'waitingStatus',(select w.status from vibe_live.waiting_requests w where w.session_id=x.id and w.student_id=learner)$anchor$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected Live discovery response'; END IF;
 src:=replace(src,old,replacement);

 old:=$anchor$ if is_teacher then
   -- Filter current enrollment again when projecting learner data.$anchor$;
 replacement:=$anchor$ if is_teacher then
   result:=result||jsonb_build_object('waitingCount',(select count(*) from vibe_live.waiting_requests w
     where w.session_id=room.id and w.status='pending' and vibe_live.can_join(w.student_id,room.teacher_id,room.mode,room.class_id,room.school_id,room.group_id)));
   -- Filter current enrollment again when projecting learner data.$anchor$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected teacher projection'; END IF;
 src:=replace(src,old,replacement);
 EXECUTE src;
END $migration$;

-- Content-free notifications use the existing private authorized Realtime channel.
CREATE TRIGGER live_broadcast_class_chat AFTER INSERT OR UPDATE ON vibe_live.class_messages
FOR EACH ROW EXECUTE FUNCTION vibe_live.broadcast_room_invalidation();
CREATE TRIGGER live_broadcast_waiting AFTER INSERT OR UPDATE ON vibe_live.waiting_requests
FOR EACH ROW EXECUTE FUNCTION vibe_live.broadcast_room_invalidation();
CREATE TRIGGER live_broadcast_typing AFTER INSERT OR UPDATE ON vibe_live.dm_typing
FOR EACH ROW EXECUTE FUNCTION vibe_live.broadcast_room_invalidation();
COMMIT;
