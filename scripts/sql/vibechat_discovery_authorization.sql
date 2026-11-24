\set ON_ERROR_STOP on
-- Run only on a disposable database reconstructed from the candidate migrations.
begin;
insert into auth.users(id,aud,role,email,raw_user_meta_data) values
 ('fca20000-0000-4000-8000-000000000001','authenticated','authenticated','vc-discovery-a@example.test','{"full_name":"Fixture A"}'),
 ('fca20000-0000-4000-8000-000000000002','authenticated','authenticated','vc-discovery-b@example.test','{"full_name":"Fixture B"}'),
 ('fca20000-0000-4000-8000-000000000003','authenticated','authenticated','vc-discovery-child@example.test','{"full_name":"Fixture Child","role":"student"}');
insert into public.profiles(id,full_name,role,account_status,date_of_birth) values
 ('fca20000-0000-4000-8000-000000000001','Fixture A',null,'active','1990-01-01'),
 ('fca20000-0000-4000-8000-000000000002','Fixture B',null,'active','1990-01-01'),
 ('fca20000-0000-4000-8000-000000000003','Fixture Child','student','active',current_date-interval '12 years')
 on conflict(id) do update set role=excluded.role,date_of_birth=excluded.date_of_birth,account_status=excluded.account_status;
insert into public.vs_identities(auth_user_id,username,kind) values
 ('fca20000-0000-4000-8000-000000000001','fixturevca','person'),
 ('fca20000-0000-4000-8000-000000000002','fixturevcb','person'),
 ('fca20000-0000-4000-8000-000000000003','fixturevcchild','person')
 on conflict(auth_user_id) do update set username=excluded.username;
do $grants$begin
 if has_table_privilege('authenticated','private.vibechat_discovery_preferences','SELECT') or has_table_privilege('authenticated','private.vibechat_discovery_preferences','INSERT') then raise exception 'Direct preference access'; end if;
 if has_function_privilege('anon','public.vibechat_search_handles(text)','EXECUTE') or has_function_privilege('anon','public.vibechat_open_or_request_contact(text)','EXECUTE') then raise exception 'Anonymous chat access'; end if;
end$grants$;
set local role authenticated;
select set_config('request.jwt.claim.sub','fca20000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"fca20000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $a$begin
 if exists(select 1 from public.vibechat_search_handles('fixturevcb')) then raise exception 'Private username exposed'; end if;
 perform public.vibechat_set_discovery(true);
end$a$;
select set_config('request.jwt.claim.sub','fca20000-0000-4000-8000-000000000002',true),set_config('request.jwt.claims','{"sub":"fca20000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $b$begin
 if not exists(select 1 from public.vibechat_search_handles('fixturevca') where handle='@fixturevca') then raise exception 'Opted-in canonical username unavailable'; end if;
 perform public.vibechat_set_discovery(true);
end$b$;
select set_config('request.jwt.claim.sub','fca20000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"fca20000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $open$declare room uuid;begin
 room:=public.vibechat_open_or_request_contact('@fixturevcb');
 if room is null or public.vibechat_open_or_request_contact('@fixturevcb') is distinct from room then raise exception 'Direct room not idempotent'; end if;
 perform set_config('vc.discovery.room',room::text,true);
 perform public.vibechat_block_thread('vc',room,true);
 begin
 perform public.vibechat_open_or_request_contact('@fixturevcb');raise exception 'Blocked contact reopened';
 exception when insufficient_privilege then null;end;
end$open$;
select set_config('request.jwt.claim.sub','fca20000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"fca20000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $child$begin
 if exists(select 1 from public.vibechat_search_handles('fixturevc')) then raise exception 'Child stranger discovery';end if;
 begin
 perform public.vibechat_set_discovery(true);raise exception 'Child opted in';
 exception when insufficient_privilege then null;end;
 begin
 perform public.vibechat_open_or_request_contact('@fixturevca');raise exception 'Child opened stranger chat';
 exception when insufficient_privilege then null;end;
end$child$;
reset role;
rollback;
