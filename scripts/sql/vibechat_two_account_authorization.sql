\set ON_ERROR_STOP on
-- Disposable migrated database ONLY. Never execute on production.
begin;
insert into auth.users(id,aud,role,email,raw_user_meta_data) values
 ('fca10000-0000-4000-8000-000000000001','authenticated','authenticated','vc-a@example.test','{"full_name":"Chat A","role":"teacher"}'),
 ('fca10000-0000-4000-8000-000000000002','authenticated','authenticated','vc-b@example.test','{"full_name":"Chat B","role":"teacher"}'),
 ('fca10000-0000-4000-8000-000000000003','authenticated','authenticated','vc-outsider@example.test','{"full_name":"Chat outsider","role":"teacher"}');
insert into public.profiles(id,full_name,role,account_status,date_of_birth) values
 ('fca10000-0000-4000-8000-000000000001','Chat A','teacher','active','1990-01-01'),
 ('fca10000-0000-4000-8000-000000000002','Chat B','teacher','active','1990-01-01'),
 ('fca10000-0000-4000-8000-000000000003','Chat outsider','teacher','active','1990-01-01')
 on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,account_status=excluded.account_status,date_of_birth=excluded.date_of_birth;
insert into public.vc_threads(id,school_id,type,created_by,context_tag,subject)
values('fca10000-0000-4000-8000-000000000010',null,'direct','fca10000-0000-4000-8000-000000000001','general','Fixture chat');
insert into public.vc_participants(thread_id,profile_id,school_id,last_read_at) values
 ('fca10000-0000-4000-8000-000000000010','fca10000-0000-4000-8000-000000000001',null,now()-interval '1 day'),
 ('fca10000-0000-4000-8000-000000000010','fca10000-0000-4000-8000-000000000002',null,now()-interval '1 day');
set local role authenticated;
select set_config('request.jwt.claim.sub','fca10000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"fca10000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('vc.receipt.hello',public.vibechat_send_rich(auth.uid(),'vc','fca10000-0000-4000-8000-000000000010','fca10000-0000-4000-8000-000000000021','Fixture hello')::text,true);
do $a$begin
 if public.vibechat_ack_message('vc','fca10000-0000-4000-8000-000000000010',current_setting('vc.receipt.hello')::uuid,true) then raise exception 'Own message acknowledged'; end if;
 if not private.vibechat_can_receive_inbox('vibechat-inbox:'||auth.uid()::text) or private.vibechat_can_receive_inbox('vibechat-inbox:fca10000-0000-4000-8000-000000000002') then raise exception 'Cross-user channel allowed'; end if;
 perform public.vibechat_presence_settings(true);
end$a$;
select set_config('request.jwt.claim.sub','fca10000-0000-4000-8000-000000000002',true),set_config('request.jwt.claims','{"sub":"fca10000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $b$declare item jsonb;begin
 select value into item from jsonb_array_elements(public.vibechat_my_inbox_state()) where value->>'room_id'='fca10000-0000-4000-8000-000000000010';
 if item is null or (item->>'unread')::int<>1 then raise exception 'Missing incoming unread'; end if;
 if not public.vibechat_ack_message('vc','fca10000-0000-4000-8000-000000000010',current_setting('vc.receipt.hello')::uuid,false) then raise exception 'Delivery failed'; end if;
 if not public.vibechat_ack_message('vc','fca10000-0000-4000-8000-000000000010',current_setting('vc.receipt.hello')::uuid,true) then raise exception 'Read acknowledgement failed'; end if;
 perform public.vibechat_presence_settings(true);
 select value into item from jsonb_array_elements(public.vibechat_my_inbox_state()) where value->>'room_id'='fca10000-0000-4000-8000-000000000010';
 if (item->>'unread')::int<>0 or (item->>'peer_online')::boolean is distinct from true then raise exception 'Read or presence state failed'; end if;
end$b$;
select set_config('vc.receipt.reply',public.vibechat_send_rich(auth.uid(),'vc','fca10000-0000-4000-8000-000000000010','fca10000-0000-4000-8000-000000000022','Fixture reply')::text,true);
select set_config('request.jwt.claim.sub','fca10000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"fca10000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $reply$declare item jsonb;begin
 if not exists(select 1 from public.vc_messages where id=current_setting('vc.receipt.reply')::uuid) then raise exception 'Reply not delivered'; end if;
 select value into item from jsonb_array_elements(public.vibechat_my_inbox_state()) where value->>'room_id'='fca10000-0000-4000-8000-000000000010';
 if item->>'peer_read_at' is null or item->>'peer_delivered_at' is null then raise exception 'Missing sender receipts'; end if;
 perform public.vibechat_block_thread('vc','fca10000-0000-4000-8000-000000000010',true);
end$reply$;
select set_config('request.jwt.claim.sub','fca10000-0000-4000-8000-000000000002',true),set_config('request.jwt.claims','{"sub":"fca10000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $blocked$begin
 if public.vibechat_ack_message('vc','fca10000-0000-4000-8000-000000000010',current_setting('vc.receipt.hello')::uuid,true) then raise exception 'Blocked receipt allowed'; end if;
 begin
 perform public.vibechat_send_rich(auth.uid(),'vc','fca10000-0000-4000-8000-000000000010','fca10000-0000-4000-8000-000000000023','Must fail');
 raise exception 'Blocked message accepted';
 exception when insufficient_privilege then null; end;
end$blocked$;
select set_config('request.jwt.claim.sub','fca10000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"fca10000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $outsider$begin
 if exists(select 1 from public.vc_messages where thread_id='fca10000-0000-4000-8000-000000000010') or exists(select 1 from jsonb_array_elements(public.vibechat_my_inbox_state()) where value->>'room_id'='fca10000-0000-4000-8000-000000000010') then raise exception 'Outsider read'; end if;
 if public.vibechat_ack_message('vc','fca10000-0000-4000-8000-000000000010',current_setting('vc.receipt.hello')::uuid,true) then raise exception 'Outsider receipt'; end if;
end$outsider$;
reset role;
rollback;
