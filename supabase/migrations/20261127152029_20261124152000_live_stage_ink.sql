-- Prompt-scoped annotation overlay and teacher-mediated learner participation.
begin;
-- access: owner-only vibe_live.stage_ink
-- authorization-test: vibe_live.stage_ink; scripts/test-live-stage-ink.mjs
create table vibe_live.stage_ink (
 session_id uuid not null references vibe_live.sessions(id) on delete cascade,
 prompt_id uuid not null references vibe_live.prompts(id) on delete cascade,
 revision integer not null default 1 check(revision>0),
 ink jsonb not null default '[]'::jsonb,
 grantee uuid references public.students(id) on delete restrict,
 proposal jsonb,
 updated_at timestamptz not null default clock_timestamp(),
 primary key(session_id,prompt_id),
 foreign key(session_id,grantee) references vibe_live.participants(session_id,student_id) on delete cascade
);
alter table vibe_live.stage_ink enable row level security;
revoke all on vibe_live.stage_ink from public,anon,authenticated,service_role;

create function vibe_live.valid_stage_ink(p_ink jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $validate$
declare s jsonb; pt jsonb; n jsonb;
begin
 if jsonb_typeof(p_ink) is distinct from 'array' or pg_column_size(p_ink)>22000 then return false; end if;
 if jsonb_array_length(p_ink)>24 then return false; end if;
 for s in select value from jsonb_array_elements(p_ink) loop
   if jsonb_typeof(s) is distinct from 'object' then return false; end if;
   if exists(select 1 from jsonb_object_keys(s) k where k not in ('color','width','points')) then return false; end if;
   if coalesce(s->>'color','') not in ('#182b3a','#1865c0','#bf3038','#167d58','#a06a05','#7e41b6')
      or coalesce(s->>'width','') not in ('2','4','8') or jsonb_typeof(s->'width') is distinct from 'number'
      or jsonb_typeof(s->'points') is distinct from 'array' then return false; end if;
   if jsonb_array_length(s->'points') not between 1 and 80 then return false; end if;
   for pt in select value from jsonb_array_elements(s->'points') loop
     if jsonb_typeof(pt) is distinct from 'array' then return false; end if;
     if jsonb_array_length(pt)<>2 then return false; end if;
     for n in select value from jsonb_array_elements(pt) loop
       if jsonb_typeof(n) is distinct from 'number' or n::text !~ '^(0|[1-9][0-9]{0,2}|1000)$' then return false; end if;
     end loop;
   end loop;
 end loop;
 return true;
end $validate$;
revoke all on function vibe_live.valid_stage_ink(jsonb) from public,anon,authenticated,service_role;

do $migration$
declare
 src text:=pg_get_functiondef('vibe_live.command(text,uuid,uuid,integer,jsonb)'::regprocedure);
 old text; replacement text;
begin
 old:='result jsonb;';
 replacement:=old||' ink_row vibe_live.stage_ink%rowtype; ink_prompt uuid; ink_grantee uuid; ink_revision integer; ink_payload jsonb;';
 if (length(src)-length(replace(src,old,'')))/length(old)<>1 then raise exception 'Unexpected Live declaration'; end if;
 src:=replace(src,old,replacement);
 old:=$a$if p_action is null or p_action not in ($a$;
 replacement:=old||$a$'ink_get','ink_save','ink_grant','ink_offer','ink_publish','ink_reject',$a$;
 if (length(src)-length(replace(src,old,'')))/length(old)<>1 then raise exception 'Unexpected Live action gate'; end if;
 src:=replace(src,old,replacement);
 old:=$a$if p_action not in ('get','start','dm_list','dm_read',$a$;
 replacement:=$a$if p_action not in ('ink_get','get','start','dm_list','dm_read',$a$;
 if (length(src)-length(replace(src,old,'')))/length(old)<>1 then raise exception 'Unexpected Live history gate'; end if;
 src:=replace(src,old,replacement);
 old:=$a$if p_action in ('get','dm_list','chat_list','wait_list','wait_status','workbook_list') then$a$;
 replacement:=$a$if p_action in ('get','dm_list','chat_list','wait_list','wait_status','workbook_list','ink_get') then$a$;
 if (length(src)-length(replace(src,old,'')))/length(old)<>1 then raise exception 'Unexpected Live read lock'; end if;
 src:=replace(src,old,replacement);
 old:=$a$ if p_action in ('workbook_list','workbook_save','workbook_submit','workbook_return','workbook_accept') then$a$;
 replacement:=$ink$
 if p_action in ('ink_get','ink_save','ink_grant','ink_offer','ink_publish','ink_reject') then
   if coalesce(p_payload->>'promptId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'live_invalid_ink_prompt'; end if;
   ink_prompt:=(p_payload->>'promptId')::uuid;
   if not exists(select 1 from vibe_live.prompts p where p.session_id=room.id and p.id=ink_prompt) then raise exception 'live_invalid_ink_prompt'; end if;
   if p_action='ink_get' then
     select * into ink_row from vibe_live.stage_ink k where k.session_id=room.id and k.prompt_id=ink_prompt;
   else
     if room.status<>'active' or ink_prompt is distinct from room.current_prompt then raise exception 'live_ink_not_open'; end if;
     if p_action='ink_offer' then
       if is_teacher or learner is null then raise exception 'live_not_authorized' using errcode='42501'; end if;
     elsif not is_teacher then raise exception 'live_not_authorized' using errcode='42501';
     end if;
     if coalesce(p_payload->>'revision','') !~ '^[0-9]{1,9}$' then raise exception 'live_invalid_revision'; end if;
     ink_revision:=(p_payload->>'revision')::integer;
     select * into ink_row from vibe_live.stage_ink k where k.session_id=room.id and k.prompt_id=ink_prompt for update;
     if coalesce(ink_row.revision,0)<>ink_revision then raise exception 'live_ink_conflict'; end if;
     if p_action='ink_offer' then
       if ink_row.grantee is distinct from learner or ink_row.proposal is not null then raise exception 'live_not_authorized' using errcode='42501'; end if;
       ink_payload:=p_payload->'ink';
       if not vibe_live.valid_stage_ink(ink_payload) then raise exception 'live_invalid_ink'; end if;
       update vibe_live.stage_ink k set proposal=ink_payload,revision=k.revision+1,updated_at=clock_timestamp() where k.session_id=room.id and k.prompt_id=ink_prompt returning * into ink_row;
     elsif p_action='ink_grant' then
       if p_payload->>'studentId' is not null then
         if p_payload->>'studentId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'live_invalid_ink_grantee'; end if;
         ink_grantee:=(p_payload->>'studentId')::uuid;
         if not exists(select 1 from vibe_live.participants p where p.session_id=room.id and p.student_id=ink_grantee)
           or not vibe_live.can_join(ink_grantee,room.teacher_id,room.mode,room.class_id,room.school_id,room.group_id) then raise exception 'live_not_authorized' using errcode='42501'; end if;
       end if;
       insert into vibe_live.stage_ink(session_id,prompt_id,revision,grantee) values(room.id,ink_prompt,ink_revision+1,ink_grantee)
       on conflict(session_id,prompt_id) do update set grantee=excluded.grantee,proposal=null,revision=excluded.revision,updated_at=clock_timestamp() returning * into ink_row;
     elsif p_action='ink_save' then
       ink_payload:=p_payload->'ink';
       if not vibe_live.valid_stage_ink(ink_payload) then raise exception 'live_invalid_ink'; end if;
       insert into vibe_live.stage_ink(session_id,prompt_id,revision,ink) values(room.id,ink_prompt,ink_revision+1,ink_payload)
       on conflict(session_id,prompt_id) do update set ink=excluded.ink,proposal=null,revision=excluded.revision,updated_at=clock_timestamp() returning * into ink_row;
     else
       if ink_row.proposal is null then raise exception 'live_ink_no_proposal'; end if;
       if p_action='ink_publish' and not vibe_live.can_join(ink_row.grantee,room.teacher_id,room.mode,room.class_id,room.school_id,room.group_id) then raise exception 'live_not_authorized' using errcode='42501'; end if;
       update vibe_live.stage_ink k set ink=case when p_action='ink_publish' then k.proposal else k.ink end,
         proposal=null,grantee=null,revision=k.revision+1,updated_at=clock_timestamp()
         where k.session_id=room.id and k.prompt_id=ink_prompt returning * into ink_row;
     end if;
   end if;
   return jsonb_build_object('revision',coalesce(ink_row.revision,0),'ink',coalesce(ink_row.ink,'[]'::jsonb),
     'canContribute',coalesce(not is_teacher and ink_row.grantee=learner and room.status='active' and room.expires_at>now() and room.current_prompt=ink_prompt and ink_row.proposal is null,false),
     'grantee',case when is_teacher then ink_row.grantee else null end,
     'proposal',case when is_teacher and room.status='active' and room.expires_at>now() and room.current_prompt=ink_prompt and vibe_live.can_join(ink_row.grantee,room.teacher_id,room.mode,room.class_id,room.school_id,room.group_id) then ink_row.proposal else null end,
     'pending',coalesce(not is_teacher and ink_row.grantee=learner and ink_row.proposal is not null,false));
 end if;
$ink$;
 if (length(src)-length(replace(src,old,'')))/length(old)<>1 then raise exception 'Unexpected Live workbook admission anchor'; end if;
 src:=replace(src,old,replacement||old);
 execute src;
end $migration$;
-- Notify through the existing content-free, private room channel.
create trigger live_broadcast_stage_ink after insert or update on vibe_live.stage_ink
for each row execute function vibe_live.broadcast_room_invalidation();
commit;
