-- Synthetic PG17 contract, never execute against a live payment project.
create table if not exists public.mpesa_runtime_control (
  singleton boolean primary key default true,
  initiation_enabled boolean not null default false
);
insert into public.mpesa_runtime_control(singleton,initiation_enabled)
values(true,false) on conflict(singleton) do update
set initiation_enabled=false;
-- Match verified live service-role SELECT/UPDATE grants inside disposable PG only.
grant select,update on public.mpesa_runtime_control to service_role;

do $sw$
declare relation text;
begin
  foreach relation in array array[
    'public.success_wishes_guest_orders',
    'public.success_wishes_guest_payment_attempts',
    'public.success_wishes_guest_payment_events'
  ] loop
    if not (select relrowsecurity from pg_class where oid=relation::regclass)
       or has_table_privilege('anon',relation,'SELECT')
       or has_table_privilege('authenticated',relation,'SELECT')
       or has_table_privilege('anon',relation,'INSERT')
       or has_table_privilege('authenticated',relation,'INSERT') then
      raise exception 'Guest payment table improperly exposed: %', relation;
    end if;
  end loop;
end $sw$;

set role service_role;
do $sw$
declare oid uuid; aid uuid; inbox uuid; sender uuid; ev uuid; ev2 uuid;
  msg uuid; checkout text:='sandbox_checkout_987654321';
begin
  select id into inbox from public.success_wishes_inboxes
    where school_id='11111111-1111-4111-8111-111111111111';
  select id into sender from public.success_wishes_senders
    where email_digest=repeat('2',64); -- unblocked sender

  insert into public.success_wishes_guest_orders(
    inbox_id,sender_id,sender_name,relationship,format,body,phone,amount_kes,idempotency_key
  ) values(inbox,sender,'Sandbox parent','Parent','text',
           'Great effort. Keep going!','254712345678',10,repeat('1a',32))
  returning id into oid;
  insert into public.success_wishes_guest_payment_attempts(order_id)
  values(oid) returning id into aid;

  if public.success_wishes_claim_guest_attempt(aid) is distinct from false then
    raise exception 'STK allowed with canonical kill switch OFF'; end if;
  if (select state from public.success_wishes_guest_payment_attempts where id=aid)<>'created'
    then raise exception 'Disabled claim mutated payment'; end if;

  -- Disposable isolated-db simulation only; NEVER do this to production.
  update public.mpesa_runtime_control set initiation_enabled=true;
  if public.success_wishes_claim_guest_attempt(aid) is distinct from true
    then raise exception 'Expected single STK claim'; end if;
  if public.success_wishes_claim_guest_attempt(aid) is distinct from false
    then raise exception 'Same STK attempt could be claimed twice'; end if;
  if public.success_wishes_attach_guest_stk(aid,checkout,'sandbox_merchant_123456','{}')
      is distinct from true then raise exception 'STK ack not attached'; end if;
  if public.success_wishes_attach_guest_stk(aid,checkout,'sandbox_merchant_123456','{}')
      is distinct from false then raise exception 'Duplicate ack accepted'; end if;

  insert into public.success_wishes_guest_payment_events(
    event_key,checkout_request_id,merchant_request_id,result_code,
    amount_kes,phone,provider_receipt,payload,provider_confirmed
  ) values('test-event-sandbox-verified-001',checkout,'sandbox_merchant_123456',
    0,10,'254712345678','SANDBOXR123','{}',false) returning id into ev;
  if public.success_wishes_settle_guest_event(ev)<>'provider_confirmation_required'
    then raise exception 'Unverified callback released message'; end if;
  if exists(select 1 from public.success_wishes_guest_orders where id=oid
    and state='settled') then raise exception 'Unconfirmed event marked order paid'; end if;
  update public.success_wishes_guest_payment_events
    set provider_confirmed=true where id=ev;
  if public.success_wishes_settle_guest_event(ev)<>'settled'
    then raise exception 'Verified synthetic settlement failed'; end if;
  if public.success_wishes_settle_guest_event(ev)<>'settled'
    then raise exception 'Callback replay changed decision'; end if;
  select message_id into msg from public.success_wishes_guest_orders where id=oid;
  if msg is null or not exists(select 1 from public.success_wishes_messages
    where id=msg and payment_status='paid' and state='request' and format='text')
    then raise exception 'Payment failed to create private candidate request'; end if;

  insert into public.success_wishes_guest_payment_events(
    event_key,checkout_request_id,merchant_request_id,result_code,
    amount_kes,phone,provider_receipt,payload,provider_confirmed
  ) values('test-event-sandbox-duplicate-002',checkout,'sandbox_merchant_123456',
    0,10,'254712345678','SANDBOXR123','{}',true) returning id into ev2;
  if public.success_wishes_settle_guest_event(ev2)<>'already_settled'
    then raise exception 'Duplicate verified callback not recognized'; end if;
  if (select processing_state from public.success_wishes_guest_payment_events where id=ev2)
    <>'duplicate' then raise exception 'Duplicate callback not recorded'; end if;
  if (select count(*) from public.success_wishes_messages where idempotency_key=repeat('1a',32))<>1
    then raise exception 'Double delivered on callback replay'; end if;

  begin
    insert into public.success_wishes_guest_orders(
      inbox_id,sender_id,sender_name,relationship,format,body,phone,amount_kes,idempotency_key
    ) values(inbox,sender,'Replay','Parent','text','Another','254712345678',10,repeat('1a',32));
    raise exception 'Duplicate idempotency key accepted';
  exception when unique_violation then null;
  end;
  -- Leave the shared switch disabled even inside the disposable test database.
  update public.mpesa_runtime_control set initiation_enabled=false;
end $sw$;
reset role;

select 'Guest M-Pesa synthetic ledger, settlement, callback replay and kill switch passed' as result;
