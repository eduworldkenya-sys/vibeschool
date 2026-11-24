\set ON_ERROR_STOP on
-- Disposable migrated database ONLY. Never execute on production.
begin;
insert into auth.users(id,aud,role,email,raw_user_meta_data) values
 ('fca30000-0000-4000-8000-000000000001','authenticated','authenticated','vc-outbox-a@example.test','{"full_name":"Chat A","role":"teacher"}'),
 ('fca30000-0000-4000-8000-000000000002','authenticated','authenticated','vc-outbox-b@example.test','{"full_name":"Chat B","role":"teacher"}'),
 ('fca30000-0000-4000-8000-000000000003','authenticated','authenticated','vc-outbox-outsider@example.test','{"full_name":"Chat outsider","role":"teacher"}');
insert into public.profiles(id,full_name,role,account_status,date_of_birth) values
 ('fca30000-0000-4000-8000-000000000001','Chat A','teacher','active','1990-01-01'),
 ('fca30000-0000-4000-8000-000000000002','Chat B','teacher','active','1990-01-01'),
 ('fca30000-0000-4000-8000-000000000003','Chat outsider','teacher','active','1990-01-01')
 on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,account_status=excluded.account_status,date_of_birth=excluded.date_of_birth;
insert into public.vc_threads(id,school_id,type,created_by,context_tag,subject)
values('fca30000-0000-4000-8000-000000000010',null,'direct','fca30000-0000-4000-8000-000000000001','general','Fixture chat');
insert into public.vc_participants(thread_id,profile_id,school_id,last_read_at) values
 ('fca30000-0000-4000-8000-000000000010','fca30000-0000-4000-8000-000000000001',null,now()-interval '1 day'),
 ('fca30000-0000-4000-8000-000000000010','fca30000-0000-4000-8000-000000000002',null,now()-interval '1 day');

do $grants$begin
 if has_table_privilege('authenticated','private.vibechat_send_operations','SELECT') or has_table_privilege('authenticated','private.vibechat_send_operations','INSERT') then raise exception 'Direct operation ledger access';end if;
 if has_function_privilege('anon','public.vibechat_send_once(uuid,text,uuid,uuid,text)','EXECUTE') then raise exception 'Anonymous send';end if;
end$grants$;
set local role authenticated;
select set_config('request.jwt.claim.sub','fca30000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"fca30000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $sender$declare m uuid;begin
 m:=public.vibechat_send_once(auth.uid(),'vc','fca30000-0000-4000-8000-000000000010','fca30000-0000-4000-8000-000000000021','Fixture hello');
 if m is null or m is distinct from public.vibechat_send_once(auth.uid(),'vc','fca30000-0000-4000-8000-000000000010','fca30000-0000-4000-8000-000000000021','Fixture hello') then raise exception 'Retry did not return original message';end if;
 if (select count(*) from public.vc_messages where thread_id='fca30000-0000-4000-8000-000000000010')<>1 then raise exception 'Duplicate message';end if;
 begin
 perform public.vibechat_send_once(auth.uid(),'vc','fca30000-0000-4000-8000-000000000010','fca30000-0000-4000-8000-000000000021','Altered body');raise exception 'Operation collision accepted';
 exception when invalid_parameter_value then null;end;
 begin
 perform public.vibechat_send_once('fca30000-0000-4000-8000-000000000002','vc','fca30000-0000-4000-8000-000000000010','fca30000-0000-4000-8000-000000000022','Spoof');raise exception 'Spoofed owner accepted';
 exception when insufficient_privilege then null;end;
end$sender$;
select set_config('request.jwt.claim.sub','fca30000-0000-4000-8000-000000000002',true),set_config('request.jwt.claims','{"sub":"fca30000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $peer$begin
 if not exists(select 1 from public.vc_messages where thread_id='fca30000-0000-4000-8000-000000000010' and body='Fixture hello') then raise exception 'Peer did not receive message';end if;
 perform public.vibechat_block_thread('vc','fca30000-0000-4000-8000-000000000010',true);
end$peer$;
select set_config('request.jwt.claim.sub','fca30000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"fca30000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $blocked$begin
 begin
 perform public.vibechat_send_once(auth.uid(),'vc','fca30000-0000-4000-8000-000000000010','fca30000-0000-4000-8000-000000000021','Fixture hello');raise exception 'Blocked retry accepted';
 exception when insufficient_privilege then null;end;
 begin
 perform public.vibechat_send_once(auth.uid(),'vc','fca30000-0000-4000-8000-000000000010','fca30000-0000-4000-8000-000000000022','New blocked message');raise exception 'Blocked send accepted';
 exception when insufficient_privilege then null;end;
end$blocked$;
select set_config('request.jwt.claim.sub','fca30000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"fca30000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $outsider$begin
 begin
 perform public.vibechat_send_once(auth.uid(),'vc','fca30000-0000-4000-8000-000000000010','fca30000-0000-4000-8000-000000000023','Outsider');raise exception 'Outsider sent message';
 exception when insufficient_privilege then null;end;
end$outsider$;
reset role;
rollback;
