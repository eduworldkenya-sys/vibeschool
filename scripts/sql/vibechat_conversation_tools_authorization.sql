\set ON_ERROR_STOP on
-- Disposable migrated database ONLY. Never execute on production.
begin;
insert into auth.users(id,aud,role,email,raw_user_meta_data) values
 ('fca50000-0000-4000-8000-000000000001','authenticated','authenticated','vc-settings-a@example.test','{"full_name":"Chat A","role":"teacher"}'),
 ('fca50000-0000-4000-8000-000000000002','authenticated','authenticated','vc-settings-b@example.test','{"full_name":"Chat B","role":"teacher"}'),
 ('fca50000-0000-4000-8000-000000000003','authenticated','authenticated','vc-settings-outsider@example.test','{"full_name":"Chat outsider","role":"teacher"}');
insert into public.profiles(id,full_name,role,account_status,date_of_birth) values
 ('fca50000-0000-4000-8000-000000000001','Chat A','teacher','active','1990-01-01'),
 ('fca50000-0000-4000-8000-000000000002','Chat B','teacher','active','1990-01-01'),
 ('fca50000-0000-4000-8000-000000000003','Chat outsider','teacher','active','1990-01-01')
 on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,account_status=excluded.account_status,date_of_birth=excluded.date_of_birth;
insert into public.vc_threads(id,school_id,type,created_by,context_tag,subject)
values('fca50000-0000-4000-8000-000000000010',null,'direct','fca50000-0000-4000-8000-000000000001','general','Fixture chat');
insert into public.vc_participants(thread_id,profile_id,school_id,last_read_at) values
 ('fca50000-0000-4000-8000-000000000010','fca50000-0000-4000-8000-000000000001',null,now()-interval '1 day'),
 ('fca50000-0000-4000-8000-000000000010','fca50000-0000-4000-8000-000000000002',null,now()-interval '1 day');



do $grants$begin
 if has_table_privilege('authenticated','private.vibechat_conversation_preferences','SELECT') or has_table_privilege('authenticated','private.vibechat_notification_preferences','UPDATE') then raise exception 'Direct private preference access';end if;
 if has_function_privilege('anon','public.vibechat_message_page(text,uuid,timestamptz,uuid,text)','EXECUTE') then raise exception 'Anonymous history search';end if;
end$grants$;
set local role authenticated;
select set_config('request.jwt.claim.sub','fca50000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"fca50000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $sender$declare r jsonb; m uuid;begin
 perform public.vibechat_set_conversation_preference('vc','fca50000-0000-4000-8000-000000000010','pinned',true);
 perform public.vibechat_set_conversation_preference('vc','fca50000-0000-4000-8000-000000000010','muted',true);
 perform public.vibechat_notification_preferences(true);
 if not public.vibechat_notification_preferences() then raise exception 'Notification preference not saved';end if;
 r:=public.vibechat_my_conversation_preferences();
 if not exists(select 1 from jsonb_array_elements(r) x where x->>'room_id'='fca50000-0000-4000-8000-000000000010' and x->>'pinned'='true' and x->>'muted'='true' and x->>'archived'='false') then raise exception 'Independent settings not preserved';end if;
 m:=public.vibechat_send_rich(auth.uid(),'vc','fca50000-0000-4000-8000-000000000010','fca50000-0000-4000-8000-000000000021','Fixture geometry');
 perform set_config('vc.tools.message',m::text,true);
 perform public.vibechat_send_rich(auth.uid(),'vc','fca50000-0000-4000-8000-000000000010','fca50000-0000-4000-8000-000000000022','Fixture history');
 r:=public.vibechat_message_page('vc','fca50000-0000-4000-8000-000000000010',null,null,'geometry');
 if jsonb_array_length(r)<>1 or r->0->>'id'<>m::text then raise exception 'Search mismatch';end if;
 r:=public.vibechat_message_page('vc','fca50000-0000-4000-8000-000000000010');
 if jsonb_array_length(r)<>2 then raise exception 'History mismatch';end if;
 if jsonb_array_length(public.vibechat_message_page('vc','fca50000-0000-4000-8000-000000000010',(r->0->>'created_at')::timestamptz,(r->0->>'id')::uuid))<>0 then raise exception 'Cursor repeated earliest message';end if;
end$sender$;
select set_config('request.jwt.claim.sub','fca50000-0000-4000-8000-000000000002',true),set_config('request.jwt.claims','{"sub":"fca50000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $peer$begin
 if jsonb_array_length(public.vibechat_my_conversation_preferences())<>0 or public.vibechat_notification_preferences() then raise exception 'Peer preferences leaked';end if;
 if jsonb_array_length(public.vibechat_message_page('vc','fca50000-0000-4000-8000-000000000010',null,null,'GEOMETRY'))<>1 then raise exception 'Peer search failed';end if;
end$peer$;
select set_config('request.jwt.claim.sub','fca50000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"fca50000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $deleted$begin
 perform public.vibechat_change_message('vc','fca50000-0000-4000-8000-000000000010',current_setting('vc.tools.message')::uuid,'delete');
 if jsonb_array_length(public.vibechat_message_page('vc','fca50000-0000-4000-8000-000000000010',null,null,'geometry'))<>0 then raise exception 'Deleted message searchable';end if;
end$deleted$;
select set_config('request.jwt.claim.sub','fca50000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"fca50000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $outsider$begin
 begin
 perform public.vibechat_message_page('vc','fca50000-0000-4000-8000-000000000010');raise exception 'Outsider history read';
 exception when insufficient_privilege then null;end;
 begin
 perform public.vibechat_set_conversation_preference('vc','fca50000-0000-4000-8000-000000000010','muted',true);raise exception 'Outsider preference saved';
 exception when insufficient_privilege then null;end;
end$outsider$;
reset role;
rollback;
