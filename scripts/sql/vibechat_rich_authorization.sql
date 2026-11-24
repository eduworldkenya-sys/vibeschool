\set ON_ERROR_STOP on
-- Disposable migrated database ONLY. Never execute on production.
begin;
insert into auth.users(id,aud,role,email,raw_user_meta_data) values
 ('fca40000-0000-4000-8000-000000000001','authenticated','authenticated','vc-rich-a@example.test','{"full_name":"Chat A","role":"teacher"}'),
 ('fca40000-0000-4000-8000-000000000002','authenticated','authenticated','vc-rich-b@example.test','{"full_name":"Chat B","role":"teacher"}'),
 ('fca40000-0000-4000-8000-000000000003','authenticated','authenticated','vc-rich-outsider@example.test','{"full_name":"Chat outsider","role":"teacher"}');
insert into public.profiles(id,full_name,role,account_status,date_of_birth) values
 ('fca40000-0000-4000-8000-000000000001','Chat A','teacher','active','1990-01-01'),
 ('fca40000-0000-4000-8000-000000000002','Chat B','teacher','active','1990-01-01'),
 ('fca40000-0000-4000-8000-000000000003','Chat outsider','teacher','active','1990-01-01')
 on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,account_status=excluded.account_status,date_of_birth=excluded.date_of_birth;
insert into public.vc_threads(id,school_id,type,created_by,context_tag,subject)
values('fca40000-0000-4000-8000-000000000010',null,'direct','fca40000-0000-4000-8000-000000000001','general','Fixture chat');
insert into public.vc_participants(thread_id,profile_id,school_id,last_read_at) values
 ('fca40000-0000-4000-8000-000000000010','fca40000-0000-4000-8000-000000000001',null,now()-interval '1 day'),
 ('fca40000-0000-4000-8000-000000000010','fca40000-0000-4000-8000-000000000002',null,now()-interval '1 day');


do $grants$begin
 if has_table_privilege('authenticated','private.vibechat_reactions','SELECT') or has_table_privilege('authenticated','private.vibechat_reactions','INSERT') then raise exception 'Direct reaction access';end if;
 if has_function_privilege('anon','public.vibechat_rich_messages(text,uuid)','EXECUTE') then raise exception 'Anonymous reader';end if;
end$grants$;
set local role authenticated;
select set_config('request.jwt.claim.sub','fca40000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"fca40000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $sender$declare m uuid;begin
 m:=public.vibechat_send_rich(auth.uid(),'vc','fca40000-0000-4000-8000-000000000010','fca40000-0000-4000-8000-000000000021','Fixture original');
 perform set_config('vc.rich.original',m::text,true);
 if not public.vibechat_change_message('vc','fca40000-0000-4000-8000-000000000010',m,'edit','Fixture edited') then raise exception 'Edit failed';end if;
end$sender$;
select set_config('request.jwt.claim.sub','fca40000-0000-4000-8000-000000000002',true),set_config('request.jwt.claims','{"sub":"fca40000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $peer$declare m uuid:=current_setting('vc.rich.original')::uuid; reply uuid; rows jsonb;begin
 begin
 perform public.vibechat_change_message('vc','fca40000-0000-4000-8000-000000000010',m,'edit','Unauthorized');raise exception 'Nonowner edit';
 exception when insufficient_privilege then null;end;
 perform public.vibechat_change_message('vc','fca40000-0000-4000-8000-000000000010',m,'react','like');
 reply:=public.vibechat_send_rich(auth.uid(),'vc','fca40000-0000-4000-8000-000000000010','fca40000-0000-4000-8000-000000000022','Fixture reply',m);
 if reply is distinct from public.vibechat_send_rich(auth.uid(),'vc','fca40000-0000-4000-8000-000000000010','fca40000-0000-4000-8000-000000000022','Fixture reply',m) then raise exception 'Reply retry duplicated';end if;
 begin
 perform public.vibechat_send_rich(auth.uid(),'vc','fca40000-0000-4000-8000-000000000010','fca40000-0000-4000-8000-000000000022','Fixture reply',null);raise exception 'Reply key changed';
 exception when invalid_parameter_value then null;end;
 begin
 perform public.vibechat_send_rich(auth.uid(),'vc','fca40000-0000-4000-8000-000000000010','fca40000-0000-4000-8000-000000000023','Invalid reply','fca40000-0000-4000-8000-000000000099');raise exception 'Invalid target accepted';
 exception when invalid_parameter_value then null;end;
 rows:=public.vibechat_rich_messages('vc','fca40000-0000-4000-8000-000000000010');
 if not exists(select 1 from jsonb_array_elements(rows) x where x->>'id'=reply::text and x->>'reply_excerpt'='Fixture edited') then raise exception 'Reply excerpt incorrect';end if;
 if not exists(select 1 from jsonb_array_elements(rows) x where x->>'id'=m::text and x->>'edited_at' is not null and jsonb_array_length(x->'reactions')=1) then raise exception 'Edit or reaction missing';end if;
end$peer$;
select set_config('request.jwt.claim.sub','fca40000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"fca40000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $delete$declare m uuid:=current_setting('vc.rich.original')::uuid; rows jsonb;begin
 perform public.vibechat_change_message('vc','fca40000-0000-4000-8000-000000000010',m,'delete');
 rows:=public.vibechat_rich_messages('vc','fca40000-0000-4000-8000-000000000010');
 if rows::text like '%Fixture edited%' then raise exception 'Deleted text exposed';end if;
 if not exists(select 1 from jsonb_array_elements(rows) x where x->>'id'=m::text and x->>'body'='Message deleted' and x->>'deleted_at' is not null and jsonb_array_length(x->'reactions')=0) then raise exception 'Deleted tombstone missing';end if;
end$delete$;
select set_config('request.jwt.claim.sub','fca40000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"fca40000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $outsider$begin
 begin
 perform public.vibechat_rich_messages('vc','fca40000-0000-4000-8000-000000000010');raise exception 'Outsider read';
 exception when insufficient_privilege then null;end;
end$outsider$;
reset role;
rollback;
