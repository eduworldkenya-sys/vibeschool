-- Teacher-assigned, session-scoped text discussions. No public membership or direct table grants.
BEGIN;
-- access: owner-only vibe_live.breakout_groups
-- authorization-test: vibe_live.breakout_groups; scripts/test-live-breakouts.mjs
CREATE TABLE vibe_live.breakout_groups(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL REFERENCES vibe_live.sessions(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(char_length(title) BETWEEN 1 AND 60),
 members uuid[] NOT NULL CHECK(cardinality(members) BETWEEN 2 AND 12),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 closed_at timestamptz,
 UNIQUE(id,session_id)
);
-- access: owner-only vibe_live.breakout_messages
-- authorization-test: vibe_live.breakout_messages; scripts/test-live-breakouts.mjs
CREATE TABLE vibe_live.breakout_messages(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL,
 group_id uuid NOT NULL,
 sender_profile_id uuid NOT NULL REFERENCES public.profiles(id),
 sender_student_id uuid REFERENCES public.students(id),
 request_id uuid NOT NULL,
 body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 500),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 hidden_at timestamptz,
 reported_at timestamptz,
 FOREIGN KEY(group_id,session_id) REFERENCES vibe_live.breakout_groups(id,session_id) ON DELETE CASCADE,
 UNIQUE(group_id,sender_profile_id,request_id)
);
CREATE INDEX ON vibe_live.breakout_groups(session_id,created_at);
CREATE INDEX ON vibe_live.breakout_messages(group_id,created_at,id);
ALTER TABLE vibe_live.breakout_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE vibe_live.breakout_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vibe_live.breakout_groups,vibe_live.breakout_messages FROM PUBLIC,anon,authenticated,service_role;
DO $migration$
DECLARE
 src text:=pg_get_functiondef('vibe_live.command(text,uuid,uuid,integer,jsonb)'::regprocedure);
 old text; replacement text;
BEGIN
 old:='result jsonb;';
 replacement:=old||' breakout vibe_live.breakout_groups%rowtype; breakout_members uuid[]; breakout_title text; breakout_body text; breakout_request uuid; breakout_message uuid;';
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected Live declaration'; END IF;
 src:=replace(src,old,replacement);
 old:=$a$if p_action is null or p_action not in ($a$;
 replacement:=old||$a$'breakout_list','breakout_read','breakout_create','breakout_close','breakout_send','breakout_report','breakout_hide',$a$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected Live action whitelist'; END IF;
 src:=replace(src,old,replacement);
 old:=$a$if p_action in ('get','dm_list','chat_list','wait_list','wait_status'$a$;
 replacement:=$a$if p_action in ('breakout_list','breakout_read','get','dm_list','chat_list','wait_list','wait_status'$a$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected Live read lock'; END IF;
 src:=replace(src,old,replacement);
 old:=$a$ if p_action in ('workspace_get','workspace_save') then$a$;
 replacement:=$block$
 if p_action in ('breakout_list','breakout_read','breakout_create','breakout_close','breakout_send','breakout_report','breakout_hide') then
   if room.mode='open' then raise exception 'live_breakout_unavailable'; end if;
   if p_action in ('breakout_create','breakout_close','breakout_hide') and not is_teacher then
     raise exception 'live_teacher_required' using errcode='42501';
   end if;
   if p_action='breakout_list' then
     return jsonb_build_object(
       'groups',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'title',g.title,'closed',g.closed_at is not null,'size',cardinality(g.members),'members',case when is_teacher then to_jsonb(g.members) else '[]'::jsonb end) order by g.created_at,g.id)
        from vibe_live.breakout_groups g where g.session_id=room.id and (is_teacher or (g.closed_at is null and learner=any(g.members)))),'[]'::jsonb),
       'roster',case when is_teacher then coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) order by s.name,s.id)
        from vibe_live.participants p join public.students s on s.id=p.student_id and s.deleted_at is null
        where p.session_id=room.id and vibe_live.can_join(s.id,room.teacher_id,room.mode,room.class_id,room.school_id,room.group_id)),'[]'::jsonb) else '[]'::jsonb end
     );
   end if;
   if p_action='breakout_create' then
     if room.status<>'active' then raise exception 'live_breakout_closed'; end if;
     breakout_title:=btrim(coalesce(p_payload->>'title',''));
     if char_length(breakout_title) not between 1 and 60 or jsonb_typeof(p_payload->'members') is distinct from 'array' then raise exception 'live_invalid_breakout'; end if;
     if jsonb_array_length(p_payload->'members') not between 2 and 12 then raise exception 'live_invalid_breakout'; end if;
     if exists(select 1 from jsonb_array_elements_text(p_payload->'members') x where x !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then raise exception 'live_invalid_breakout'; end if;
     select array_agg(distinct x::uuid order by x::uuid) into breakout_members from jsonb_array_elements_text(p_payload->'members') x;
     if cardinality(breakout_members)<>jsonb_array_length(p_payload->'members') or exists(
       select 1 from unnest(breakout_members) x where not exists(
         select 1 from vibe_live.participants p where p.session_id=room.id and p.student_id=x
           and vibe_live.can_join(x,room.teacher_id,room.mode,room.class_id,room.school_id,room.group_id)
       )) then raise exception 'live_invalid_breakout_members'; end if;
     if coalesce(p_payload->>'requestId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'live_invalid_breakout'; end if;
     breakout_request:=(p_payload->>'requestId')::uuid;
     select * into breakout from vibe_live.breakout_groups where id=breakout_request;
     if found then
       if breakout.session_id<>room.id or breakout.members<>breakout_members or breakout.title<>breakout_title then raise exception 'live_request_id_reused'; end if;
       return jsonb_build_object('id',breakout.id);
     end if;
     if (select count(*) from vibe_live.breakout_groups where session_id=room.id)>=30 or
       (select count(*) from vibe_live.breakout_groups where session_id=room.id and closed_at is null)>=10 then raise exception 'live_breakout_limit'; end if;
     if exists(select 1 from vibe_live.breakout_groups g where g.session_id=room.id and g.closed_at is null and g.members && breakout_members) then raise exception 'live_breakout_member_busy'; end if;
     insert into vibe_live.breakout_groups(id,session_id,title,members) values(breakout_request,room.id,breakout_title,breakout_members) returning * into breakout;
     return jsonb_build_object('id',breakout.id);
   end if;
   select * into breakout from vibe_live.breakout_groups g where g.id=nullif(p_payload->>'groupId','')::uuid and g.session_id=room.id
     and (is_teacher or (g.closed_at is null and learner=any(g.members)));
   if not found then raise exception 'live_not_authorized' using errcode='42501'; end if;
   if p_action='breakout_read' then
     return jsonb_build_object('closed',breakout.closed_at is not null,'messages',coalesce((
       select jsonb_agg(jsonb_build_object('id',q.id,'body',q.body,'author',case when q.sender_student_id is null then 'Teacher' else coalesce(s.name,'Learner') end,'own',q.sender_profile_id=caller,'hidden',q.hidden_at is not null,'reported',case when is_teacher then q.reported_at is not null else false end,'sentAt',q.created_at) order by q.created_at,q.id)
       from (select m.* from vibe_live.breakout_messages m where m.group_id=breakout.id and m.session_id=room.id and (is_teacher or m.hidden_at is null) order by m.created_at desc,m.id desc limit 80) q
       left join public.students s on s.id=q.sender_student_id and s.deleted_at is null
     ),'[]'::jsonb));
   end if;
   if p_action='breakout_close' then
     update vibe_live.breakout_groups set closed_at=clock_timestamp() where id=breakout.id and closed_at is null;
     return jsonb_build_object('closed',true);
   end if;
   if p_action='breakout_send' then
     if breakout.closed_at is not null or room.status<>'active' then raise exception 'live_breakout_closed'; end if;
     breakout_body:=btrim(coalesce(p_payload->>'body',''));
     if char_length(breakout_body) not between 1 and 500 or coalesce(p_payload->>'requestId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'live_invalid_chat_message'; end if;
     breakout_request:=(p_payload->>'requestId')::uuid;
     if exists(select 1 from vibe_live.breakout_messages m where m.group_id=breakout.id and m.sender_profile_id=caller and m.request_id=breakout_request and m.body<>breakout_body) then raise exception 'live_request_id_reused'; end if;
     if not exists(select 1 from vibe_live.breakout_messages m where m.group_id=breakout.id and m.sender_profile_id=caller and m.request_id=breakout_request) then
       if (select count(*) from vibe_live.breakout_messages where group_id=breakout.id)>=240 or (select count(*) from vibe_live.breakout_messages where session_id=room.id and sender_profile_id=caller)>=80 then raise exception 'live_chat_limit'; end if;
       if exists(select 1 from vibe_live.breakout_messages where session_id=room.id and sender_profile_id=caller and created_at>clock_timestamp()-interval '2 seconds') then raise exception 'live_chat_rate_limit'; end if;
       insert into vibe_live.breakout_messages(session_id,group_id,sender_profile_id,sender_student_id,request_id,body)
       values(room.id,breakout.id,caller,case when is_teacher then null else learner end,breakout_request,breakout_body);
     end if;
     return jsonb_build_object('sent',true);
   end if;
   breakout_message:=nullif(p_payload->>'messageId','')::uuid;
   if p_action='breakout_hide' then
     update vibe_live.breakout_messages set hidden_at=coalesce(hidden_at,clock_timestamp()) where id=breakout_message and group_id=breakout.id and session_id=room.id;
   elsif p_action='breakout_report' then
     if is_teacher then raise exception 'live_learner_required' using errcode='42501'; end if;
     update vibe_live.breakout_messages set reported_at=coalesce(reported_at,clock_timestamp()) where id=breakout_message and group_id=breakout.id and session_id=room.id and hidden_at is null and sender_profile_id<>caller;
   end if;
   if not found then raise exception 'live_not_authorized' using errcode='42501'; end if;
   return jsonb_build_object('saved',true);
 end if;
$block$;
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Unexpected Live workspace anchor'; END IF;
 src:=replace(src,old,replacement||old);
 EXECUTE src;
END $migration$;
CREATE TRIGGER live_broadcast_breakout AFTER INSERT OR UPDATE ON vibe_live.breakout_groups FOR EACH ROW EXECUTE FUNCTION vibe_live.broadcast_room_invalidation();
CREATE TRIGGER live_broadcast_breakout_message AFTER INSERT OR UPDATE ON vibe_live.breakout_messages FOR EACH ROW EXECUTE FUNCTION vibe_live.broadcast_room_invalidation();
COMMIT;
