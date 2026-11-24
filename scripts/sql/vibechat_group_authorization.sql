\set ON_ERROR_STOP on
-- Disposable migrated database ONLY. Never execute on production.
begin;
insert into auth.users(id,aud,role,email,raw_user_meta_data) values
 ('fca60000-0000-4000-8000-000000000001','authenticated','authenticated','vc-group-a@example.test','{"full_name":"Chat A","role":"teacher"}'),
 ('fca60000-0000-4000-8000-000000000002','authenticated','authenticated','vc-group-b@example.test','{"full_name":"Chat B","role":"teacher"}'),
 ('fca60000-0000-4000-8000-000000000003','authenticated','authenticated','vc-group-outsider@example.test','{"full_name":"Chat outsider","role":"teacher"}');
insert into public.profiles(id,full_name,role,account_status,date_of_birth) values
 ('fca60000-0000-4000-8000-000000000001','Chat A','teacher','active','1990-01-01'),
 ('fca60000-0000-4000-8000-000000000002','Chat B','teacher','active','1990-01-01'),
 ('fca60000-0000-4000-8000-000000000003','Chat outsider','teacher','active','1990-01-01')
 on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,account_status=excluded.account_status,date_of_birth=excluded.date_of_birth;
insert into public.vc_threads(id,school_id,type,created_by,context_tag,subject)
values('fca60000-0000-4000-8000-000000000010',null,'direct','fca60000-0000-4000-8000-000000000001','general','Fixture chat');
insert into public.vc_participants(thread_id,profile_id,school_id,last_read_at) values
 ('fca60000-0000-4000-8000-000000000010','fca60000-0000-4000-8000-000000000001',null,now()-interval '1 day'),
 ('fca60000-0000-4000-8000-000000000010','fca60000-0000-4000-8000-000000000002',null,now()-interval '1 day');




insert into public.vibechat_contact_requests(requester_id,recipient_id,status,thread_id,responded_at)
values('fca60000-0000-4000-8000-000000000001','fca60000-0000-4000-8000-000000000002','accepted','fca60000-0000-4000-8000-000000000010',now());
do $grants$begin
 if has_table_privilege('authenticated','private.vibechat_group_invites','SELECT') then raise exception 'Direct group invites exposed';end if;
 if has_function_privilege('anon','public.vibechat_group_send(uuid,uuid,uuid,text)','EXECUTE') then raise exception 'Anonymous group sender';end if;
end$grants$;
set local role authenticated;
select set_config('request.jwt.claim.sub','fca60000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"fca60000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $create$declare room uuid:='fca60000-0000-4000-8000-000000000011';m uuid;begin
 if public.vibechat_group_create(room,'Fixture group',array['fca60000-0000-4000-8000-000000000002'::uuid]) is distinct from room then raise exception 'Group creation failed';end if;
 m:=public.vibechat_group_send(auth.uid(),room,'fca60000-0000-4000-8000-000000000021','Fixture group message');
 if m is distinct from public.vibechat_group_send(auth.uid(),room,'fca60000-0000-4000-8000-000000000021','Fixture group message') then raise exception 'Group retry duplicated';end if;
 begin
 perform public.vibechat_group_invite(room,array['fca60000-0000-4000-8000-000000000003'::uuid]);raise exception 'Unconnected account invited';
 exception when insufficient_privilege then null;end;
end$create$;
reset role;
-- Make the pre-join history unambiguously earlier in this single transaction.
update public.vc_messages set created_at=now()-interval '1 minute' where thread_id='fca60000-0000-4000-8000-000000000011';
set local role authenticated;
select set_config('request.jwt.claim.sub','fca60000-0000-4000-8000-000000000002',true),set_config('request.jwt.claims','{"sub":"fca60000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $join$declare room uuid:='fca60000-0000-4000-8000-000000000011';i uuid;begin
 begin
 perform public.vibechat_group_messages(room);raise exception 'Unaccepted group read';
 exception when insufficient_privilege then null;end;
 select (x->>'id')::uuid into i from jsonb_array_elements(public.vibechat_group_invitations()) x where x->>'group_name'='Fixture group';
 if i is null or public.vibechat_group_respond(i,true) is distinct from room then raise exception 'Invitation acceptance failed';end if;
 if jsonb_array_length(public.vibechat_group_messages(room))<>0 then raise exception 'Pre-join history exposed';end if;
 perform public.vibechat_group_send(auth.uid(),room,'fca60000-0000-4000-8000-000000000022','Fixture reply');
 if jsonb_array_length(public.vibechat_group_messages(room,null,null,'reply'))<>1 then raise exception 'Group search failed';end if;
 perform public.vibechat_group_preference(room,'muted',true);
 begin
 insert into public.vc_messages(thread_id,school_id,sender_id,body) values(room,null,auth.uid(),'Legacy group bypass');raise exception 'Direct group insert bypass';
 exception when insufficient_privilege then null;end;
 perform public.vibechat_group_leave(room);
 begin
 perform public.vibechat_group_messages(room);raise exception 'Departed member read';
 exception when insufficient_privilege then null;end;
end$join$;
select set_config('request.jwt.claim.sub','fca60000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"fca60000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $outsider$begin
 if exists(select 1 from public.vc_messages where thread_id='fca60000-0000-4000-8000-000000000011') then raise exception 'Outsider table read';end if;
 begin
 perform public.vibechat_group_send(auth.uid(),'fca60000-0000-4000-8000-000000000011','fca60000-0000-4000-8000-000000000023','Outsider');raise exception 'Outsider group send';
 exception when insufficient_privilege then null;end;
end$outsider$;
reset role;
rollback;
