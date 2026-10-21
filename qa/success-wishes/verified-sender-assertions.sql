-- Synthetic-only, disposable PostgreSQL. Run after sponsor assertions and
-- the verified-senders migration. These tests never send email or payments.
do $sw$
declare relation text;
begin
  foreach relation in array array[
    'public.success_wishes_senders',
    'public.success_wishes_sender_challenges',
    'public.success_wishes_sender_sessions',
    'public.success_wishes_blocked_senders'
  ] loop
    if not (select c.relrowsecurity from pg_class c where c.oid=relation::regclass)
       or has_table_privilege('anon',relation,'SELECT')
       or has_table_privilege('authenticated',relation,'SELECT') then
      raise exception 'Unprotected verified-sender table: %', relation;
    end if;
  end loop;
end $sw$;

set role service_role;
insert into public.success_wishes_senders(email_digest) values
  (repeat('1',64)),(repeat('2',64));
-- The preceding concurrency test removed fixture hash 5 to free its last
-- sponsored slot. Create a new unpaid synthetic request with a verified sender.
insert into public.success_wishes_messages(
  inbox_id,sender_id,sender_name,relationship,format,body,
  management_token_hash,idempotency_key,payment_status,expires_at
) select i.id,s.id,'Verified guardian','Guardian','text','You can do this',
  repeat('5',64),repeat('6',64),'pending',now()+interval '2 days'
from public.success_wishes_inboxes i
cross join public.success_wishes_senders s
where i.school_id='11111111-1111-4111-8111-111111111111'
  and s.email_digest=repeat('1',64);

do $sw$
declare alpha uuid; beta uuid; sender uuid; wish uuid;
begin
  select id into alpha from public.success_wishes_inboxes
    where school_id='11111111-1111-4111-8111-111111111111';
  select id into beta from public.success_wishes_inboxes
    where school_id='22222222-2222-4222-8222-222222222222';
  select id into sender from public.success_wishes_senders where email_digest=repeat('1',64);
  select id into wish from public.success_wishes_messages where management_token_hash=repeat('5',64);
  if wish is null then raise exception 'Synthetic sponsored wish fixture missing'; end if;
  if public.success_wishes_block_sender(alpha,wish) is distinct from true then
    raise exception 'Sender block failed';
  end if;
  if not exists(select 1 from public.success_wishes_blocked_senders
    where inbox_id=alpha and sender_id=sender) then
    raise exception 'Persistent sender block missing';
  end if;
  if exists(select 1 from public.success_wishes_messages where id=wish and state<>'blocked') then
    raise exception 'Previously received message remains visible';
  end if;

  -- The message insert remains closed to the same sender despite a fresh
  -- idempotency key. Avoid the sponsored quota guard by using pending payment.
  begin
    insert into public.success_wishes_messages(
      inbox_id,sender_id,sender_name,relationship,format,body,
      management_token_hash,idempotency_key,payment_status,expires_at
    ) values(alpha,sender,'Blocked sender','Guardian','text',
      'Attempt again',repeat('0',64),repeat('3',64),'pending',now()+interval '2 days');
    raise exception 'Persistent block was bypassed';
  exception when check_violation then
    null; -- a check-violation is the expected fail-closed outcome
  end;

  -- A candidate in a different school is never affected by Alpha's block.
  insert into public.success_wishes_messages(
    inbox_id,sender_id,sender_name,relationship,format,body,
    management_token_hash,idempotency_key,payment_status,expires_at
  ) values(beta,sender,'Same sender','Guardian','text',
    'Different school',repeat('4',64),repeat('a',64),'pending',now()+interval '2 days');

  begin
    insert into public.success_wishes_messages(
      inbox_id,sender_name,relationship,format,body,
      management_token_hash,idempotency_key,payment_status,expires_at
    ) values(beta,'No verification','Guardian','text',
      'Unverified',repeat('e',64),repeat('f',64),'pending',now()+interval '2 days');
    raise exception 'Unverified sender was allowed to submit';
  exception when check_violation then null;
  end;
end $sw$;
reset role;
select 'Verified sender identity and cross-school blocking isolation passed' as result;
