-- Disposable PG17 only; runs after test-fixture, foundation assertions,
-- founder identity fixture, and the sponsored pilot migration.

set role authenticated;
do $sw$
begin
  perform set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
  begin
    perform public.success_wishes_set_sponsored_pilot(
      '11111111-1111-4111-8111-111111111111',true,7,2);
    raise exception 'Non-owner could enable sponsored messages';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.success_wishes_owner_schools();
    raise exception 'Non-owner accessed the founder-only school directory';
  exception when insufficient_privilege then null;
  end;
end $sw$;

do $sw$
begin
  perform set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
  begin
    perform public.success_wishes_set_sponsored_pilot(
      '11111111-1111-4111-8111-111111111111',true,7,2);
    raise exception 'Sponsorship enabled before school re-consented';
  exception when check_violation then null;
  end;
end $sw$;

do $sw$
declare result jsonb;
begin
  perform set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
  if public.success_wishes_set_school_participation(
    '11111111-1111-4111-8111-111111111111',true,true) is not true
    then raise exception 'School consent failed'; end if;
  result := public.success_wishes_set_sponsored_pilot(
    '11111111-1111-4111-8111-111111111111',true,7,2);
  if result->>'enabled' is distinct from 'true' or
    result->>'dailyLimit' is distinct from '2' then
    raise exception 'Owner sponsorship settings were not persisted'; end if;
end $sw$;
reset role;

set role service_role;
-- Existing fixture has one sponsored message from docs/test-assertions.sql.
insert into public.success_wishes_messages(
  inbox_id,sender_name,relationship,format,body,management_token_hash,
  idempotency_key,payment_status,expires_at
) select id,'Pilot Guardian','Parent','text','You can do it!',
  repeat('5',64),repeat('6',64),'sponsored',now()+interval '5 days'
from public.success_wishes_inboxes
where school_id='11111111-1111-4111-8111-111111111111';

do $sw$
begin
  if (select count(*) from public.success_wishes_messages m
    join public.success_wishes_inboxes i on i.id=m.inbox_id
    where i.school_id='11111111-1111-4111-8111-111111111111'
      and m.payment_status='sponsored') <> 2
    then raise exception 'Unexpected pilot message count'; end if;
  begin
    insert into public.success_wishes_messages(
      inbox_id,sender_name,relationship,format,body,management_token_hash,
      idempotency_key,payment_status,expires_at
    ) select id,'Over Cap','Guardian','text','More wishes',
      repeat('7',64),repeat('8',64),'sponsored',now()+interval '5 days'
      from public.success_wishes_inboxes
      where school_id='11111111-1111-4111-8111-111111111111';
    raise exception 'Daily sponsored quota was bypassed';
  exception when check_violation then null;
  end;
end $sw$;
reset role;

set role authenticated;
do $sw$
begin
  perform set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
  if (public.success_wishes_set_sponsored_pilot(
    '11111111-1111-4111-8111-111111111111',false,7,2)->>'enabled') <> 'false'
    then raise exception 'Founder failed to disable sponsorship'; end if;
end $sw$;
reset role;

set role service_role;
do $sw$
begin
  begin
    insert into public.success_wishes_messages(
      inbox_id,sender_name,relationship,format,body,management_token_hash,
      idempotency_key,payment_status,expires_at
    ) select id,'Disabled','Guardian','text','Messages are off',
      repeat('9',64),repeat('e',64),'sponsored',now()+interval '5 days'
      from public.success_wishes_inboxes
      where school_id='11111111-1111-4111-8111-111111111111';
    raise exception 'Sender inserted while sponsorship disabled';
  exception when check_violation then null;
  end;
end $sw$;
reset role;

select 'owner-only sponsored text and atomic school cap tested' as result;
