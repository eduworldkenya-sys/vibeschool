-- Success Wishes GUEST M-Pesa ledger, isolated development migration.
-- Not applied to the live project. Do not activate production payments.
-- All tables are server-only, and NO existing commerce/learning-product tables
-- or mpesa_runtime_control values are modified.
begin;

create table public.success_wishes_guest_orders (
  id uuid primary key default gen_random_uuid(),
  inbox_id uuid not null references public.success_wishes_inboxes(id) on delete restrict,
  sender_id uuid not null references public.success_wishes_senders(id) on delete restrict,
  sender_name text not null check(length(trim(sender_name)) between 2 and 100),
  relationship text not null check(length(trim(relationship)) between 2 and 60),
  format text not null check(format in ('text','voice','video')),
  body text,
  phone text not null check(phone ~ '^254[17][0-9]{8}$'),
  amount_kes integer not null check(amount_kes between 1 and 100000),
  idempotency_key text not null check(idempotency_key ~ '^[a-f0-9]{64}$'),
  state text not null default 'created' check(state in
    ('created','submitting','awaiting_customer','settled','failed','cancelled',
     'reconciliation_required','refund_pending','refunded')),
  message_id uuid unique references public.success_wishes_messages(id) on delete restrict,
  provider_receipt text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(sender_id,idempotency_key),
  check((format='text' and length(trim(coalesce(body,''))) between 1 and 2000)
    or (format in ('voice','video') and body is null)),
  check((state not in ('settled','refund_pending','refunded')) or
    (message_id is not null and provider_receipt is not null))
);
create index success_wishes_guest_orders_sender_created_idx on
  public.success_wishes_guest_orders(sender_id,created_at desc);

create table public.success_wishes_guest_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.success_wishes_guest_orders(id) on delete restrict,
  state text not null default 'created' check(state in
    ('created','submitting','awaiting_customer','settled','failed','cancelled',
     'reconciliation_required','refund_pending','refunded')),
  checkout_request_id text unique,
  merchant_request_id text,
  provider_receipt text unique,
  provider_response jsonb,
  requested_at timestamptz,
  updated_at timestamptz not null default now(),
  check (checkout_request_id is null or length(checkout_request_id) between 6 and 160)
);

create table public.success_wishes_guest_payment_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique check(length(event_key) between 16 and 240),
  checkout_request_id text not null check(length(checkout_request_id) between 6 and 160),
  merchant_request_id text,
  result_code integer not null check(result_code between 0 and 99999),
  amount_kes integer,
  phone text,
  provider_receipt text,
  payload jsonb not null,
  provider_confirmed boolean not null default false,
  processing_state text not null default 'pending' check(processing_state in
    ('pending','settled','duplicate','failed','reconciliation_required')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  check(amount_kes is null or amount_kes between 1 and 100000),
  check(phone is null or phone ~ '^254[17][0-9]{8}$')
);
create index success_wishes_guest_payment_events_checkout_idx on
  public.success_wishes_guest_payment_events(checkout_request_id,received_at);

alter table public.success_wishes_guest_orders enable row level security;
alter table public.success_wishes_guest_payment_attempts enable row level security;
alter table public.success_wishes_guest_payment_events enable row level security;
revoke all on public.success_wishes_guest_orders,
  public.success_wishes_guest_payment_attempts,
  public.success_wishes_guest_payment_events from public,anon,authenticated;
grant select,insert,update,delete on public.success_wishes_guest_orders,
  public.success_wishes_guest_payment_attempts,
  public.success_wishes_guest_payment_events to service_role;

-- Canonical kill-switch check occurs in this database transaction before the
-- STK transport may be invoked; no preview bypass of the shared switch.
create function public.success_wishes_claim_guest_attempt(p_attempt_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare claimed uuid;
begin
  if not exists(select 1 from public.mpesa_runtime_control
       where singleton=true and initiation_enabled=true) then return false; end if;
  update public.success_wishes_guest_payment_attempts a
     set state='submitting',requested_at=clock_timestamp(),updated_at=clock_timestamp()
    from public.success_wishes_guest_orders o
   where a.id=p_attempt_id and a.order_id=o.id and a.state='created'
     and o.state='created'
   returning a.id into claimed;
  if claimed is null then return false; end if;
  update public.success_wishes_guest_orders
     set state='submitting',updated_at=clock_timestamp()
   where id=(select order_id from public.success_wishes_guest_payment_attempts
             where id=p_attempt_id);
  return true;
end; $$;
revoke all on function public.success_wishes_claim_guest_attempt(uuid)
  from public,anon,authenticated;
grant execute on function public.success_wishes_claim_guest_attempt(uuid) to service_role;

-- Mark the transport acknowledgement. A callback may arrive first: leave
-- immutable event records pending for ordered reconciliation after attachment.
create function public.success_wishes_attach_guest_stk(
  p_attempt_id uuid,p_checkout text,p_merchant text,p_response jsonb
) returns boolean language plpgsql security invoker set search_path='' as $$
declare order_ref uuid;
begin
  if p_checkout is null or length(p_checkout) not between 6 and 160
    or p_merchant is null or length(p_merchant) not between 6 and 160
    then return false; end if;
  update public.success_wishes_guest_payment_attempts
     set checkout_request_id=p_checkout,merchant_request_id=p_merchant,
         state='awaiting_customer',provider_response=p_response,
         updated_at=clock_timestamp()
   where id=p_attempt_id and state='submitting' and checkout_request_id is null
   returning order_id into order_ref;
  if order_ref is null then return false; end if;
  update public.success_wishes_guest_orders
     set state='awaiting_customer',updated_at=clock_timestamp()
   where id=order_ref and state='submitting';
  return true;
end; $$;
revoke all on function public.success_wishes_attach_guest_stk(uuid,text,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.success_wishes_attach_guest_stk(uuid,text,text,jsonb)
  to service_role;

-- Invoke only after a backend has confirmed the callback against Daraja's
-- independent STK status query. The callback URL token ALONE is insufficient.
-- The event is inserted durably before this function is called.
create function public.success_wishes_settle_guest_event(p_event_id uuid)
returns text language plpgsql security invoker set search_path='' as $$
declare ev public.success_wishes_guest_payment_events%rowtype;
        att public.success_wishes_guest_payment_attempts%rowtype;
        ord public.success_wishes_guest_orders%rowtype;
        campaign record; new_message uuid; expiry timestamptz;
begin
  select * into ev from public.success_wishes_guest_payment_events
   where id=p_event_id for update;
  if not found then return 'missing_event'; end if;
  if ev.processing_state <> 'pending' then return ev.processing_state; end if;
  if not ev.provider_confirmed then return 'provider_confirmation_required'; end if;
  select * into att from public.success_wishes_guest_payment_attempts
   where checkout_request_id=ev.checkout_request_id for update;
  if not found then return 'pending_checkout_attachment'; end if;
  select * into ord from public.success_wishes_guest_orders
   where id=att.order_id for update;
  if ev.merchant_request_id is distinct from att.merchant_request_id
    or ev.merchant_request_id is null then
    update public.success_wishes_guest_payment_events
      set processing_state='reconciliation_required',processed_at=clock_timestamp()
      where id=ev.id;
    return 'merchant_mismatch';
  end if;
  if ord.state='settled' then
    update public.success_wishes_guest_payment_events
      set processing_state=case when ev.result_code=0
           and ev.provider_receipt=ord.provider_receipt then 'duplicate'
           else 'reconciliation_required' end,processed_at=clock_timestamp()
      where id=ev.id;
    return 'already_settled';
  end if;
  if ord.state not in ('awaiting_customer','reconciliation_required')
    or att.state not in ('awaiting_customer','reconciliation_required') then
    update public.success_wishes_guest_payment_events
      set processing_state='reconciliation_required',processed_at=clock_timestamp()
      where id=ev.id;
    return 'unexpected_state';
  end if;
  if ev.result_code <> 0 then
    update public.success_wishes_guest_payment_attempts
      set state='failed',updated_at=clock_timestamp() where id=att.id;
    update public.success_wishes_guest_orders
      set state='failed',updated_at=clock_timestamp() where id=ord.id;
    update public.success_wishes_guest_payment_events
      set processing_state='failed',processed_at=clock_timestamp()
      where id=ev.id;
    return 'failed';
  end if;
  if ev.amount_kes is distinct from ord.amount_kes or ev.phone is distinct from ord.phone
     or ev.provider_receipt is null
     or ev.provider_receipt !~ '^[A-Za-z0-9]{6,30}$' then
    update public.success_wishes_guest_payment_attempts
      set state='reconciliation_required',updated_at=clock_timestamp() where id=att.id;
    update public.success_wishes_guest_orders
      set state='reconciliation_required',updated_at=clock_timestamp() where id=ord.id;
    update public.success_wishes_guest_payment_events
      set processing_state='reconciliation_required',processed_at=clock_timestamp()
      where id=ev.id;
    return 'amount_phone_receipt_mismatch';
  end if;
  select s.expires_at,s.retention_days,s.enabled,i.expires_at as inbox_expires
    into campaign
    from public.success_wishes_inboxes i join public.success_wishes_schools s
      on s.school_id=i.school_id where i.id=ord.inbox_id;
  if not found or not campaign.enabled or campaign.expires_at<=now()
    or campaign.inbox_expires<=now() then
    update public.success_wishes_guest_payment_attempts
      set state='reconciliation_required',updated_at=clock_timestamp() where id=att.id;
    update public.success_wishes_guest_orders
      set state='reconciliation_required',updated_at=clock_timestamp() where id=ord.id;
    update public.success_wishes_guest_payment_events
      set processing_state='reconciliation_required',processed_at=clock_timestamp()
      where id=ev.id;
    return 'recipient_ineligible_paid_requires_refund_review';
  end if;
  expiry=least(campaign.expires_at,campaign.inbox_expires,
              now()+make_interval(days=>campaign.retention_days));
  insert into public.success_wishes_messages(
    inbox_id,sender_id,sender_name,relationship,format,body,
    media_provider,media_asset_id,media_status,payment_status,state,
    expires_at,idempotency_key,management_token_hash
  ) values (
    ord.inbox_id,ord.sender_id,ord.sender_name,ord.relationship,ord.format,ord.body,
    case when ord.format='voice' then 'supabase-private-voice'
      when ord.format='video' then 'cloudflare-stream' else null end,
    case when ord.format<>'text' then 'pending:'||ord.id::text else null end,
    'pending','paid','request',expiry,ord.idempotency_key,
    encode(extensions.digest(encode(extensions.digest('success-wishes:manage:'||ord.idempotency_key,'sha256'),'hex'),'sha256'),'hex')
  ) returning id into new_message;
  update public.success_wishes_guest_orders
     set state='settled',provider_receipt=ev.provider_receipt,message_id=new_message,
         updated_at=clock_timestamp() where id=ord.id;
  update public.success_wishes_guest_payment_attempts
     set state='settled',provider_receipt=ev.provider_receipt,
         updated_at=clock_timestamp() where id=att.id;
  update public.success_wishes_guest_payment_events
     set processing_state='settled',processed_at=clock_timestamp()
     where id=ev.id;
  return 'settled';
end; $$;
revoke all on function public.success_wishes_settle_guest_event(uuid)
  from public,anon,authenticated;
grant execute on function public.success_wishes_settle_guest_event(uuid) to service_role;

commit;
