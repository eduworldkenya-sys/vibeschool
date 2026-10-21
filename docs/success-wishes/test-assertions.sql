-- Disposable PostgreSQL test assertions. Execute only after test-fixture.sql and
-- schema.sql in a throwaway database, never against production.

-- All private tables must be RLS-enabled and require explicit grants.
do $sw_assert$
declare n integer;
begin
  select count(*) into n from pg_class c join pg_namespace s on s.oid=c.relnamespace
    where s.nspname='public' and c.relname like 'success_wishes_%'
      and c.relkind='r' and c.relrowsecurity;
  if n<>7 then raise exception 'Expected seven RLS-protected domain tables, got %', n; end if;
end $sw_assert$;

-- Test service-role matching using two school/candidate identities.
set role service_role;
insert into public.success_wishes_schools(school_id,enabled,sponsored_text,expires_at) values
  ('11111111-1111-4111-8111-111111111111',true,true,now()+interval '30 days'),
  ('22222222-2222-4222-8222-222222222222',true,true,now()+interval '30 days');
insert into public.success_wishes_inboxes(school_id,student_id,access_code_hash,expires_at) values
  ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    encode(extensions.digest('success-wishes:inbox:'||repeat('A',32),'sha256'),'hex'),now()+interval '30 days'),
  ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    encode(extensions.digest('success-wishes:inbox:'||repeat('B',32),'sha256'),'hex'),now()+interval '30 days');
do $sw_assert$
declare alpha uuid; beta uuid;
begin
  select id into alpha from public.success_wishes_inboxes where school_id='11111111-1111-4111-8111-111111111111';
  select id into beta from public.success_wishes_inboxes where school_id='22222222-2222-4222-8222-222222222222';
  if public.success_wishes_match_recipient('11111111-1111-4111-8111-111111111111','A-100','Alice Wanjiku') is distinct from alpha
    then raise exception 'Valid recipient did not match'; end if;
  if public.success_wishes_match_recipient('22222222-2222-4222-8222-222222222222','B-200','Brian Otieno') is distinct from beta
    then raise exception 'Second recipient did not match'; end if;
  if public.success_wishes_match_recipient('11111111-1111-4111-8111-111111111111','B-200','Brian Otieno') is not null
    or public.success_wishes_match_recipient('22222222-2222-4222-8222-222222222222','A-100','Alice Wanjiku') is not null
    or public.success_wishes_match_recipient('11111111-1111-4111-8111-111111111111','A-100','Wrong Name') is not null
    then raise exception 'Recipient lookup crossed school/name authority'; end if;
end $sw_assert$;

insert into public.success_wishes_messages(
  inbox_id,sender_name,relationship,format,body,management_token_hash,
  idempotency_key,payment_status,expires_at
) select id,'Parent One','Parent','text','Good luck!',
  repeat('a',64),repeat('b',64),'sponsored',now()+interval '10 days'
  from public.success_wishes_inboxes where school_id='11111111-1111-4111-8111-111111111111';

do $sw_assert$
declare inbox uuid; wish uuid;
begin
  select i.id,m.id into inbox,wish from public.success_wishes_inboxes i
    join public.success_wishes_messages m on m.inbox_id=i.id
    where i.school_id='11111111-1111-4111-8111-111111111111';
  if public.success_wishes_message_action(inbox,wish,'accept',null) is not true
    then raise exception 'Candidate acceptance failed'; end if;
  if public.success_wishes_message_action(inbox,wish,'report','Suspicious sender') is not true
    then raise exception 'Candidate reporting failed'; end if;
  if not exists(select 1 from public.success_wishes_reports where message_id=wish
    and reason='Suspicious sender' and status='open')
    then raise exception 'Report not persisted atomically'; end if;
end $sw_assert$;
select set_config('success_wishes.test_report_id', (select id::text from public.success_wishes_reports limit 1), false);
reset role;

-- No direct anonymous or authenticated table access is allowed.
set role anon;
do $sw_assert$
begin
  begin
    perform 1 from public.success_wishes_messages limit 1;
    raise exception 'Anonymous role read private messages';
  exception when insufficient_privilege then null;
  end;
end $sw_assert$;
reset role;
set role authenticated;
do $sw_assert$
begin
  begin
    perform 1 from public.success_wishes_messages limit 1;
    raise exception 'Authenticated role read private messages';
  exception when insufficient_privilege then null;
  end;
end $sw_assert$;

-- School Alpha administrator may manage only Alpha reports and participation.
do $sw_assert$
declare report_id uuid;
begin
  perform set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
  report_id := current_setting('success_wishes.test_report_id',true)::uuid;
  if public.success_wishes_resolve_report('11111111-1111-4111-8111-111111111111',report_id) is not true
    then raise exception 'Authorised report review failed'; end if;
  if public.success_wishes_set_school_participation('11111111-1111-4111-8111-111111111111',false,false) is not true
    then raise exception 'Authorised opt-out failed'; end if;
end $sw_assert$;
do $sw_assert$
begin
  perform set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
  begin
    perform public.success_wishes_set_school_participation('11111111-1111-4111-8111-111111111111',true,true);
    raise exception 'School Beta administrator managed School Alpha';
  exception when insufficient_privilege then null;
  end;
end $sw_assert$;
do $sw_assert$
begin
  perform set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
  begin
    perform public.success_wishes_set_school_participation('11111111-1111-4111-8111-111111111111',true,false);
    raise exception 'School opt-in accepted missing consent';
  exception when check_violation then null;
  end;
end $sw_assert$;
reset role;

select 'success-wishes disposable PostgreSQL assertions passed' as result;
