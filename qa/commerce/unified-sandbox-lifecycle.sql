-- Test-only extension of qa/commerce/unified-sandbox-fixture.sql.
-- Disposable Postgres database ONLY. This intentionally has NO production migration.
-- Internal test runner role is postgres; schema has NO anon/authenticated grants.
begin;

create table commerce_sandbox.catalogue (
  item_reference text primary key,
  product_kind text not null check (product_kind in (
    'teacher_credits','learning_product','exam_access','success_wish',
    'school_subscription','premium_feature'
  )),
  trusted_price_kes integer not null check (trusted_price_kes between 1 and 250000),
  active boolean not null default true
);

insert into commerce_sandbox.catalogue(item_reference,product_kind,trusted_price_kes) values
 ('sandbox-teacher-credits','teacher_credits',100),
 ('sandbox-learning-pack','learning_product',300),
 ('sandbox-exam-access','exam_access',80),
 ('sandbox-success-wish','success_wish',50),
 ('sandbox-school-license','school_subscription',2000),
 ('sandbox-premium-feature','premium_feature',120);

-- This is NOT a provider webhook endpoint. Store immutable observations first.
-- CheckoutReference may arrive before it has been attached to the claimed attempt.
create table commerce_sandbox.provider_inbox (
  id uuid primary key default gen_random_uuid(),
  checkout_request_id text not null check(length(checkout_request_id) between 6 and 160),
  merchant_request_id text not null check(length(merchant_request_id) between 6 and 160),
  provider_event_key text not null unique check(length(provider_event_key) between 6 and 200),
  result_code integer not null,
  paid_amount_kes integer,
  phone text,
  provider_receipt text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table commerce_sandbox.provider_query_observations (
  id uuid primary key default gen_random_uuid(),
  checkout_request_id text not null check(length(checkout_request_id) between 6 and 160),
  merchant_request_id text not null check(length(merchant_request_id) between 6 and 160),
  result_code integer,
  -- Must be inserted by a privileged server after actual Daraja query (or fake injected CI).
  origin text not null default 'daraja_sandbox_query'
    check(origin = 'daraja_sandbox_query'),
  observed_at timestamptz not null default now(),
  unique(checkout_request_id,merchant_request_id,result_code)
);

create table commerce_sandbox.simulated_entitlements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references commerce_sandbox.orders(id) on delete restrict,
  attempt_id uuid not null unique references commerce_sandbox.payment_attempts(id) on delete restrict,
  mode text not null default 'sandbox' check(mode='sandbox'),
  product_kind text not null,
  owner_type text not null,
  owner_reference text not null,
  created_at timestamptz not null default now()
);

create function commerce_sandbox.create_trusted_order(
  p_kind text,p_item_reference text,p_owner_type text,p_owner_reference text,p_idempotency_key text
) returns uuid
language plpgsql set search_path = '' as $$
declare v_price integer; v_id uuid; v_record commerce_sandbox.orders%rowtype;
begin
  -- Caller here is a trusted test service; never expose this as public RPC.
  select trusted_price_kes into v_price from commerce_sandbox.catalogue
   where item_reference=p_item_reference and product_kind=p_kind and active=true;
  if v_price is null or p_owner_type not in ('guest','profile')
   or length(btrim(p_owner_reference))<6
   or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,80}$' then
    raise exception 'invalid_trusted_order';
  end if;
  insert into commerce_sandbox.orders
    (product_kind,item_reference,owner_type,owner_reference,amount_kes,idempotency_key)
    values(p_kind,p_item_reference,p_owner_type,p_owner_reference,v_price,p_idempotency_key)
    on conflict(owner_type,owner_reference,idempotency_key) do nothing
    returning id into v_id;
  if v_id is not null then return v_id; end if;
  select * into v_record from commerce_sandbox.orders
    where owner_type=p_owner_type and owner_reference=p_owner_reference
      and idempotency_key=p_idempotency_key for update;
  if not found or v_record.item_reference<>p_item_reference
    or v_record.product_kind<>p_kind or v_record.amount_kes<>v_price then
    raise exception 'idempotency_conflict';
  end if;
  return v_record.id;
end $$;

create function commerce_sandbox.reserve_attempt(p_order_id uuid,p_phone text)
returns uuid language plpgsql set search_path = '' as $$
declare v_order commerce_sandbox.orders%rowtype; v_id uuid;
begin
  if p_phone !~ '^254[17][0-9]{8}$' then raise exception 'invalid_test_phone'; end if;
  select * into v_order from commerce_sandbox.orders where id=p_order_id for update;
  if not found or v_order.state in ('settled_simulated','cancelled','reconciliation_required')
    then raise exception 'order_not_payable'; end if;
  select id into v_id from commerce_sandbox.payment_attempts
    where order_id=p_order_id and state in ('created','submitting','awaiting_customer','reconciliation_required')
    order by created_at desc limit 1 for update;
  if v_id is not null then
    if exists(select 1 from commerce_sandbox.payment_attempts
      where id=v_id and phone<>p_phone) then raise exception 'active_attempt_phone_mismatch'; end if;
    return v_id;
  end if;
  insert into commerce_sandbox.payment_attempts(order_id,amount_kes,phone,state)
    values(p_order_id,v_order.amount_kes,p_phone,'created')
    returning id into v_id;
  update commerce_sandbox.orders set state='awaiting_payment' where id=p_order_id;
  return v_id;
end $$;

-- One-time, transactional claim immediately before an external STK request.
-- If network fails afterwards the attempt stays submitting, requiring status
-- investigation. A retry of the same request cannot claim again.
create function commerce_sandbox.claim_stk_send(p_attempt uuid)
returns boolean language plpgsql set search_path = '' as $$
declare v_id uuid;
begin
  update commerce_sandbox.payment_attempts set state='submitting'
    where id=p_attempt and state='created'
    returning id into v_id;
  return v_id is not null;
end $$;

create function commerce_sandbox.attach_stk(
  p_attempt uuid,p_checkout text,p_merchant text
) returns boolean language plpgsql set search_path = '' as $$
declare v_attempt commerce_sandbox.payment_attempts%rowtype;
begin
  if length(p_checkout)<6 or length(p_merchant)<6 then raise exception 'invalid_provider_request'; end if;
  select * into v_attempt from commerce_sandbox.payment_attempts where id=p_attempt for update;
  if not found then raise exception 'unknown_sandbox_attempt'; end if;
  if v_attempt.state='awaiting_customer'
    and v_attempt.checkout_request_id=p_checkout
    and v_attempt.merchant_request_id=p_merchant then return false; end if;
  if v_attempt.state<>'submitting' then raise exception 'cannot_attach_stk'; end if;
  update commerce_sandbox.payment_attempts
   set state='awaiting_customer',checkout_request_id=p_checkout,merchant_request_id=p_merchant
   where id=p_attempt;
  return true;
end $$;

create function commerce_sandbox.reconcile_sandbox(p_checkout text)
returns text language plpgsql set search_path = '' as $$
declare
 v_attempt commerce_sandbox.payment_attempts%rowtype;
 v_event commerce_sandbox.provider_inbox%rowtype;
 v_query commerce_sandbox.provider_query_observations%rowtype;
 v_order commerce_sandbox.orders%rowtype;
begin
  select * into v_attempt from commerce_sandbox.payment_attempts
    where checkout_request_id=p_checkout for update;
  if not found then return 'early_event_waiting_for_attachment'; end if;
  select * into v_order from commerce_sandbox.orders where id=v_attempt.order_id for update;
  if v_attempt.state='settled_simulated' then return 'duplicate_settlement'; end if;
  if v_attempt.state not in ('awaiting_customer','reconciliation_required') then return 'not_reconcilable'; end if;
  -- Conflicting evidence requires manual reconciliation. Don't just pick newest success.
  if (select count(distinct (merchant_request_id,result_code,paid_amount_kes,phone,provider_receipt))
        from commerce_sandbox.provider_inbox
       where checkout_request_id=p_checkout)>1
     or (select count(distinct (merchant_request_id,result_code))
        from commerce_sandbox.provider_query_observations
       where checkout_request_id=p_checkout)>1 then
    update commerce_sandbox.payment_attempts set state='reconciliation_required'
      where id=v_attempt.id;
    update commerce_sandbox.orders set state='reconciliation_required' where id=v_order.id;
    return 'conflicting_provider_evidence';
  end if;

  select * into v_query from commerce_sandbox.provider_query_observations
   where checkout_request_id=p_checkout order by observed_at desc limit 1;
  if not found or v_query.result_code is null then return 'query_pending'; end if;
  select * into v_event from commerce_sandbox.provider_inbox
   where checkout_request_id=p_checkout order by created_at desc limit 1;
  if v_query.merchant_request_id<>v_attempt.merchant_request_id then
    update commerce_sandbox.payment_attempts set state='reconciliation_required' where id=v_attempt.id;
    update commerce_sandbox.orders set state='reconciliation_required' where id=v_order.id;
    return 'query_identity_mismatch';
  end if;
  if v_query.result_code=0 then
    if v_event.id is null then return 'awaiting_callback_evidence'; end if;
    if v_event.merchant_request_id<>v_attempt.merchant_request_id
      or v_event.result_code<>0
      or v_event.paid_amount_kes<>v_attempt.amount_kes
      or v_event.phone<>v_attempt.phone
      or v_event.provider_receipt !~ '^[A-Za-z0-9]{6,30}$'
      or v_event.provider_receipt is null then
      update commerce_sandbox.payment_attempts set state='reconciliation_required' where id=v_attempt.id;
      update commerce_sandbox.orders set state='reconciliation_required' where id=v_order.id;
      return 'invalid_settlement_evidence';
    end if;
    -- Unique receipt must never settle a different order/attempt.
    update commerce_sandbox.payment_attempts
      set state='settled_simulated',provider_receipt=v_event.provider_receipt
      where id=v_attempt.id;
    update commerce_sandbox.orders set state='settled_simulated' where id=v_order.id;
    insert into commerce_sandbox.simulated_entitlements
      (order_id,attempt_id,product_kind,owner_type,owner_reference)
      values(v_order.id,v_attempt.id,v_order.product_kind,v_order.owner_type,v_order.owner_reference)
      on conflict(order_id) do nothing;
    return 'settled_simulated';
  end if;
  if v_event.id is not null and (v_event.merchant_request_id<>v_attempt.merchant_request_id
      or v_event.result_code<>v_query.result_code) then
    update commerce_sandbox.payment_attempts set state='reconciliation_required' where id=v_attempt.id;
    update commerce_sandbox.orders set state='reconciliation_required' where id=v_order.id;
    return 'conflicting_failure_evidence';
  end if;
  update commerce_sandbox.payment_attempts set state=case
    when v_query.result_code=1037 then 'expired'
    when v_query.result_code=1032 then 'cancelled'
    else 'failed' end where id=v_attempt.id;
  -- A failed attempt never grants an entitlement. Order can safely retry
  -- only if explicitly requested with a new attempt; no blind provider retry.
  update commerce_sandbox.orders set state='created' where id=v_order.id;
  return case when v_query.result_code=1037 then 'expired'
      when v_query.result_code=1032 then 'cancelled' else 'failed' end;
end $$;

-- Immutable provider evidence, even for delayed early callbacks.
create trigger immutable_provider_inbox
  before update or delete on commerce_sandbox.provider_inbox
  for each row execute function commerce_sandbox.prevent_event_rewrite();
create trigger immutable_provider_query_observations
  before update or delete on commerce_sandbox.provider_query_observations
  for each row execute function commerce_sandbox.prevent_event_rewrite();
create trigger immutable_simulated_entitlements
  before update or delete on commerce_sandbox.simulated_entitlements
  for each row execute function commerce_sandbox.prevent_event_rewrite();

alter table commerce_sandbox.catalogue enable row level security;
alter table commerce_sandbox.catalogue force row level security;
alter table commerce_sandbox.provider_inbox enable row level security;
alter table commerce_sandbox.provider_inbox force row level security;
alter table commerce_sandbox.provider_query_observations enable row level security;
alter table commerce_sandbox.provider_query_observations force row level security;
alter table commerce_sandbox.simulated_entitlements enable row level security;
alter table commerce_sandbox.simulated_entitlements force row level security;
revoke all on all tables in schema commerce_sandbox from public;
revoke all on all functions in schema commerce_sandbox from public;
commit;
