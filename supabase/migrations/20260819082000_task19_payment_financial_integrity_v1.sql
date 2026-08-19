begin;

-- Task 19: canonical M-Pesa financial integrity for Learning Product commerce.
-- This migration is deliberately non-activating. mpesa_runtime_control remains OFF.
-- authorization-test: public.commerce_financial_ledger service-only immutable financial evidence
-- authorization-test: public.commerce_payment_receipts service-only, user receipt via self-authorizing RPC
-- authorization-test: public.commerce_get_my_payment_status authenticated self only
-- authorization-test: public.hq_payment_finance_overview owner only

create table if not exists public.commerce_financial_ledger (
  id uuid primary key default gen_random_uuid(),
  payment_attempt_id uuid not null references public.commerce_payment_attempts(id) on delete restrict,
  order_id uuid not null references public.learning_product_orders(id) on delete restrict,
  payer_profile_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null,
  entry_type text not null,
  amount_kes numeric(12,2) not null,
  currency text not null default 'KES',
  provider_checkout_id text not null,
  provider_receipt text not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint commerce_financial_ledger_provider_check check (provider = 'mpesa'),
  constraint commerce_financial_ledger_entry_type_check check (entry_type = 'payment_settlement'),
  constraint commerce_financial_ledger_amount_check check (amount_kes > 0),
  constraint commerce_financial_ledger_currency_check check (currency = 'KES'),
  unique(payment_attempt_id, entry_type),
  unique(provider, provider_receipt, entry_type)
);

create index if not exists commerce_financial_ledger_order_idx
  on public.commerce_financial_ledger(order_id, occurred_at desc);
create index if not exists commerce_financial_ledger_payer_idx
  on public.commerce_financial_ledger(payer_profile_id, occurred_at desc);

create table if not exists public.commerce_payment_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  order_id uuid not null unique references public.learning_product_orders(id) on delete restrict,
  payment_attempt_id uuid not null unique references public.commerce_payment_attempts(id) on delete restrict,
  payer_profile_id uuid not null references public.profiles(id) on delete restrict,
  product_id uuid not null references public.learning_products(id) on delete restrict,
  provider text not null,
  provider_receipt text not null,
  amount_kes numeric(12,2) not null,
  currency text not null default 'KES',
  issued_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint commerce_payment_receipts_provider_check check (provider = 'mpesa'),
  constraint commerce_payment_receipts_amount_check check (amount_kes > 0),
  constraint commerce_payment_receipts_currency_check check (currency = 'KES'),
  unique(provider, provider_receipt)
);

alter table public.commerce_financial_ledger enable row level security;
alter table public.commerce_payment_receipts enable row level security;
revoke all on table public.commerce_financial_ledger from public, anon, authenticated;
revoke all on table public.commerce_payment_receipts from public, anon, authenticated;
grant select, insert on table public.commerce_financial_ledger to service_role;
grant select, insert on table public.commerce_payment_receipts to service_role;

create or replace function public.commerce_reject_financial_evidence_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  raise exception 'financial_evidence_is_append_only';
end;
$function$;

revoke all on function public.commerce_reject_financial_evidence_mutation() from public, anon, authenticated;
grant execute on function public.commerce_reject_financial_evidence_mutation() to service_role;

drop trigger if exists commerce_financial_ledger_immutable on public.commerce_financial_ledger;
create trigger commerce_financial_ledger_immutable
before update or delete on public.commerce_financial_ledger
for each row execute function public.commerce_reject_financial_evidence_mutation();

drop trigger if exists commerce_payment_receipts_immutable on public.commerce_payment_receipts;
create trigger commerce_payment_receipts_immutable
before update or delete on public.commerce_payment_receipts
for each row execute function public.commerce_reject_financial_evidence_mutation();

-- Legacy service-only fulfillment accepted a caller-supplied receipt and amount.
-- Keep the signature for compatibility but permanently close it as an entitlement bypass.
create or replace function public.commerce_fulfill_learning_product_order(
  p_order_id uuid,
  p_provider text,
  p_provider_receipt text,
  p_paid_amount_kes numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'service_role_required';
  end if;
  return jsonb_build_object('success',false,'error','direct_fulfillment_disabled','order_id',p_order_id);
end;
$function$;

revoke all on function public.commerce_fulfill_learning_product_order(uuid,text,text,numeric) from public, anon, authenticated;
grant execute on function public.commerce_fulfill_learning_product_order(uuid,text,text,numeric) to service_role;

-- The only paid-entitlement settlement gateway. It binds one durable callback event
-- to one durable attempt, one order, one ledger entry, one receipt and one entitlement
-- in a single database transaction.
create or replace function public.commerce_settle_verified_mpesa_attempt(
  p_attempt_id uuid,
  p_callback_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_attempt public.commerce_payment_attempts%rowtype;
  v_event public.commerce_payment_callback_events%rowtype;
  v_order public.learning_product_orders%rowtype;
  v_entitlement_id uuid;
  v_ends_at timestamptz;
  v_receipt_number text;
  v_ledger_id uuid;
  v_receipt_id uuid;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'service_role_required';
  end if;

  select * into v_event
  from public.commerce_payment_callback_events
  where id = p_callback_event_id
  for update;
  if not found then return jsonb_build_object('success',false,'error','callback_event_not_found'); end if;

  select * into v_attempt
  from public.commerce_payment_attempts
  where id = p_attempt_id
  for update;
  if not found then return jsonb_build_object('success',false,'error','attempt_not_found'); end if;

  select * into v_order
  from public.learning_product_orders
  where id = v_attempt.order_id
  for update;
  if not found then return jsonb_build_object('success',false,'error','order_not_found'); end if;

  if v_event.provider <> 'mpesa'
     or coalesce(v_event.result_code,-1) <> 0
     or v_event.checkout_request_id is distinct from v_attempt.checkout_request_id
     or nullif(btrim(coalesce(v_event.provider_receipt,'')),'') is null
     or v_event.paid_amount_kes is null
     or v_event.paid_amount_kes <= 0 then
    return jsonb_build_object('success',false,'error','callback_evidence_invalid');
  end if;

  if v_event.merchant_request_id is not null
     and v_attempt.merchant_request_id is not null
     and v_event.merchant_request_id is distinct from v_attempt.merchant_request_id then
    return jsonb_build_object('success',false,'error','merchant_request_mismatch');
  end if;

  if v_event.paid_amount_kes <> v_attempt.expected_amount_kes
     or v_event.paid_amount_kes <> v_order.amount_kes then
    return jsonb_build_object('success',false,'error','amount_mismatch');
  end if;

  if v_attempt.payer_profile_id is distinct from v_order.purchaser_profile_id then
    return jsonb_build_object('success',false,'error','payer_order_mismatch');
  end if;

  if v_attempt.state in ('failed','cancelled','expired') then
    return jsonb_build_object('success',false,'error','success_after_terminal_provider_state');
  end if;

  if exists(
    select 1 from public.commerce_financial_ledger l
    where l.provider='mpesa' and l.provider_receipt=btrim(v_event.provider_receipt)
      and l.payment_attempt_id<>v_attempt.id
  ) or exists(
    select 1 from public.learning_product_orders o
    where o.payment_provider='mpesa' and o.provider_receipt=btrim(v_event.provider_receipt)
      and o.id<>v_order.id
  ) then
    return jsonb_build_object('success',false,'error','duplicate_provider_receipt');
  end if;

  if v_order.status='fulfilled'
     and (v_order.payment_provider is distinct from 'mpesa'
          or v_order.provider_receipt is distinct from btrim(v_event.provider_receipt)) then
    return jsonb_build_object('success',false,'error','fulfilled_receipt_conflict');
  end if;

  v_ends_at := case when v_order.access_days_snapshot is null
    then null else coalesce(v_order.fulfilled_at,now()) + make_interval(days=>v_order.access_days_snapshot) end;

  select id into v_entitlement_id
  from public.learning_product_entitlements
  where order_id=v_order.id;

  if v_entitlement_id is null then
    insert into public.learning_product_entitlements(
      product_id,order_id,profile_id,student_id,school_id,source,status,starts_at,ends_at,metadata
    ) values (
      v_order.product_id,v_order.id,v_order.beneficiary_profile_id,v_order.beneficiary_student_id,
      v_order.beneficiary_school_id,'purchase','active',coalesce(v_order.fulfilled_at,now()),v_ends_at,
      jsonb_build_object('payment_provider','mpesa','provider_receipt',btrim(v_event.provider_receipt),'payment_attempt_id',v_attempt.id)
    ) returning id into v_entitlement_id;
  end if;

  insert into public.commerce_financial_ledger(
    payment_attempt_id,order_id,payer_profile_id,provider,entry_type,amount_kes,currency,
    provider_checkout_id,provider_receipt,occurred_at
  ) values (
    v_attempt.id,v_order.id,v_attempt.payer_profile_id,'mpesa','payment_settlement',
    v_event.paid_amount_kes,'KES',v_event.checkout_request_id,btrim(v_event.provider_receipt),
    coalesce(v_attempt.callback_received_at,v_event.received_at,now())
  )
  on conflict(payment_attempt_id,entry_type) do nothing
  returning id into v_ledger_id;

  if v_ledger_id is null then
    select id into v_ledger_id from public.commerce_financial_ledger
    where payment_attempt_id=v_attempt.id and entry_type='payment_settlement';
  end if;

  v_receipt_number := 'VS-' || upper(substr(replace(v_order.id::text,'-',''),1,12));
  insert into public.commerce_payment_receipts(
    receipt_number,order_id,payment_attempt_id,payer_profile_id,product_id,provider,
    provider_receipt,amount_kes,currency,issued_at
  ) values (
    v_receipt_number,v_order.id,v_attempt.id,v_attempt.payer_profile_id,v_order.product_id,'mpesa',
    btrim(v_event.provider_receipt),v_event.paid_amount_kes,'KES',coalesce(v_event.received_at,now())
  )
  on conflict(order_id) do nothing
  returning id into v_receipt_id;

  if v_receipt_id is null then
    select id,receipt_number into v_receipt_id,v_receipt_number
    from public.commerce_payment_receipts where order_id=v_order.id;
  end if;

  update public.learning_product_orders
  set status='fulfilled',payment_provider='mpesa',provider_checkout_id=v_attempt.checkout_request_id,
      provider_receipt=btrim(v_event.provider_receipt),paid_at=coalesce(paid_at,v_event.received_at,now()),
      fulfilled_at=coalesce(fulfilled_at,now()),updated_at=now()
  where id=v_order.id;

  update public.commerce_payment_attempts
  set state='settled',provider_receipt=btrim(v_event.provider_receipt),provider_result_code=0,
      provider_result_desc=v_event.result_desc,callback_received_at=coalesce(callback_received_at,v_event.received_at,now()),
      settled_at=coalesce(settled_at,now()),processing_error=null,updated_at=now()
  where id=v_attempt.id;

  insert into public.learning_product_order_events(order_id,event_type,details)
  select v_order.id,'payment_settled',jsonb_build_object(
    'provider','mpesa','payment_attempt_id',v_attempt.id,'callback_event_id',v_event.id,
    'ledger_id',v_ledger_id,'receipt_id',v_receipt_id,'amount_kes',v_event.paid_amount_kes
  )
  where not exists(
    select 1 from public.learning_product_order_events e
    where e.order_id=v_order.id and e.event_type='payment_settled'
      and e.details->>'payment_attempt_id'=v_attempt.id::text
  );

  insert into public.learning_product_order_events(order_id,event_type,details)
  select v_order.id,'entitlement_granted',jsonb_build_object('entitlement_id',v_entitlement_id,'product_id',v_order.product_id,'payment_attempt_id',v_attempt.id)
  where not exists(
    select 1 from public.learning_product_order_events e
    where e.order_id=v_order.id and e.event_type='entitlement_granted'
      and e.details->>'entitlement_id'=v_entitlement_id::text
  );

  return jsonb_build_object(
    'success',true,'order_id',v_order.id,'attempt_id',v_attempt.id,'entitlement_id',v_entitlement_id,
    'ledger_id',v_ledger_id,'receipt_id',v_receipt_id,'receipt_number',v_receipt_number,
    'provider_receipt',btrim(v_event.provider_receipt),'amount_kes',v_event.paid_amount_kes
  );
end;
$function$;

revoke all on function public.commerce_settle_verified_mpesa_attempt(uuid,uuid) from public, anon, authenticated;
grant execute on function public.commerce_settle_verified_mpesa_attempt(uuid,uuid) to service_role;

create or replace function public.process_commerce_payment_callback_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event public.commerce_payment_callback_events%rowtype;
  v_attempt public.commerce_payment_attempts%rowtype;
  v_result jsonb;
  v_terminal_state text;
begin
  if current_user not in ('postgres','service_role') then raise exception 'service_role_required'; end if;

  select * into v_event from public.commerce_payment_callback_events where id=p_event_id for update;
  if not found then return jsonb_build_object('success',false,'error','event_not_found'); end if;
  if v_event.processing_status='processed' then return jsonb_build_object('success',true,'idempotent',true); end if;

  select * into v_attempt from public.commerce_payment_attempts
  where checkout_request_id=v_event.checkout_request_id for update;
  if not found then
    update public.commerce_payment_callback_events set processing_error='attempt_not_found' where id=v_event.id;
    return jsonb_build_object('success',false,'error','attempt_not_found');
  end if;

  if coalesce(v_event.result_code,-1)<>0 then
    v_terminal_state:=case when v_event.result_code=1032 then 'cancelled' when v_event.result_code in (1037,1) then 'expired' else 'failed' end;
    if v_attempt.state='settled' then
      update public.commerce_payment_callback_events
      set processing_status='reconciliation_required',processing_error='terminal_callback_after_settlement',processed_at=now()
      where id=v_event.id;
      return jsonb_build_object('success',false,'error','terminal_callback_after_settlement');
    end if;
    update public.commerce_payment_attempts
      set state=v_terminal_state,provider_result_code=v_event.result_code,provider_result_desc=v_event.result_desc,
          callback_received_at=coalesce(callback_received_at,v_event.received_at,now()),processing_error=null,updated_at=now()
      where id=v_attempt.id;
    update public.commerce_payment_callback_events set processing_status='processed',processing_error=null,processed_at=now() where id=v_event.id;
    return jsonb_build_object('success',true,'state',v_terminal_state);
  end if;

  v_result:=public.commerce_settle_verified_mpesa_attempt(v_attempt.id,v_event.id);
  if coalesce((v_result->>'success')::boolean,false) then
    update public.commerce_payment_callback_events set processing_status='processed',processing_error=null,processed_at=now() where id=v_event.id;
  else
    update public.commerce_payment_attempts set state='reconciliation_required',processing_error=v_result->>'error',updated_at=now() where id=v_attempt.id and state<>'settled';
    update public.learning_product_orders set status='reconciliation_required',updated_at=now() where id=v_attempt.order_id and status<>'fulfilled';
    update public.commerce_payment_callback_events set processing_status='reconciliation_required',processing_error=v_result->>'error',processed_at=now() where id=v_event.id;
  end if;
  return v_result;
end;
$function$;

revoke all on function public.process_commerce_payment_callback_event(uuid) from public, anon, authenticated;
grant execute on function public.process_commerce_payment_callback_event(uuid) to service_role;

-- Deterministic recovery: replay durable success evidence, otherwise never guess an unresolved provider state.
create or replace function public.commerce_reconcile_payment_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_attempt public.commerce_payment_attempts%rowtype;
  v_event_id uuid;
  v_result jsonb;
begin
  if current_user not in ('postgres','service_role') then raise exception 'service_role_required'; end if;
  select * into v_attempt from public.commerce_payment_attempts where id=p_attempt_id for update;
  if not found then return jsonb_build_object('success',false,'error','attempt_not_found'); end if;

  if v_attempt.state='settled' then
    if exists(select 1 from public.commerce_financial_ledger where payment_attempt_id=v_attempt.id and entry_type='payment_settlement')
       and exists(select 1 from public.commerce_payment_receipts where payment_attempt_id=v_attempt.id)
       and exists(select 1 from public.learning_product_entitlements where order_id=v_attempt.order_id)
       and exists(select 1 from public.learning_product_orders where id=v_attempt.order_id and status='fulfilled') then
      return jsonb_build_object('success',true,'state','settled','idempotent',true);
    end if;
    return jsonb_build_object('success',false,'error','settled_financial_effect_incomplete');
  end if;

  select id into v_event_id
  from public.commerce_payment_callback_events
  where checkout_request_id=v_attempt.checkout_request_id and result_code=0
  order by received_at desc limit 1;

  if v_event_id is not null then
    v_result:=public.process_commerce_payment_callback_event(v_event_id);
    return v_result;
  end if;

  if v_attempt.state in ('created','submitting','awaiting_customer')
     and coalesce(v_attempt.requested_at,v_attempt.created_at) < now()-interval '15 minutes' then
    update public.commerce_payment_attempts
      set state='reconciliation_required',processing_error='provider_confirmation_missing_after_threshold',updated_at=now()
      where id=v_attempt.id;
    update public.learning_product_orders
      set status='reconciliation_required',updated_at=now()
      where id=v_attempt.order_id and status='pending_payment';
    return jsonb_build_object('success',false,'state','reconciliation_required','error','provider_confirmation_missing');
  end if;

  return jsonb_build_object('success',true,'state',v_attempt.state,'no_action',true);
end;
$function$;

revoke all on function public.commerce_reconcile_payment_attempt(uuid) from public, anon, authenticated;
grant execute on function public.commerce_reconcile_payment_attempt(uuid) to service_role;

-- Browser status is self-authorizing and reveals no stored phone or raw provider payload.
create or replace function public.commerce_get_my_payment_status(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_caller uuid:=auth.uid();
  v_attempt public.commerce_payment_attempts%rowtype;
  v_order public.learning_product_orders%rowtype;
  v_receipt public.commerce_payment_receipts%rowtype;
  v_entitled boolean:=false;
begin
  if v_caller is null then raise exception 'authentication_required'; end if;
  select * into v_attempt from public.commerce_payment_attempts where id=p_attempt_id and payer_profile_id=v_caller;
  if not found then raise exception 'payment_not_found_or_not_authorized'; end if;
  select * into v_order from public.learning_product_orders where id=v_attempt.order_id and purchaser_profile_id=v_caller;
  if not found then raise exception 'payment_not_found_or_not_authorized'; end if;
  select * into v_receipt from public.commerce_payment_receipts where payment_attempt_id=v_attempt.id;
  select exists(select 1 from public.learning_product_entitlements e where e.order_id=v_order.id and e.status='active' and e.revoked_at is null and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())) into v_entitled;
  return jsonb_build_object(
    'attempt_id',v_attempt.id,'order_id',v_order.id,'state',v_attempt.state,'order_status',v_order.status,
    'amount_kes',v_attempt.expected_amount_kes,'currency',v_order.currency,'product_id',v_order.product_id,
    'checkout_request_id',v_attempt.checkout_request_id,'provider_receipt',v_attempt.provider_receipt,
    'receipt_number',v_receipt.receipt_number,'receipt_issued_at',v_receipt.issued_at,'entitlement_active',v_entitled,
    'reconciliation_required',(v_attempt.state='reconciliation_required' or v_order.status='reconciliation_required')
  );
end;
$function$;

revoke all on function public.commerce_get_my_payment_status(uuid) from public, anon;
grant execute on function public.commerce_get_my_payment_status(uuid) to authenticated;

-- Owner finance reads reconciled settlement ledger, never STK initiations as revenue.
create or replace function public.hq_payment_finance_overview(p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
  return jsonb_build_object(
    'runtime',coalesce((select jsonb_build_object('initiation_enabled',initiation_enabled,'activation_reason',activation_reason,'activated_at',activated_at,'updated_at',updated_at) from public.mpesa_runtime_control where singleton=true),'{}'::jsonb),
    'summary',jsonb_build_object(
      'initiated',(select count(*) from public.commerce_payment_attempts where state in ('submitting','awaiting_customer','settled','failed','cancelled','expired','reconciliation_required')),
      'successful',(select count(*) from public.commerce_payment_attempts where state='settled'),
      'pending',(select count(*) from public.commerce_payment_attempts where state in ('created','submitting','awaiting_customer')),
      'failed',(select count(*) from public.commerce_payment_attempts where state in ('failed','cancelled','expired')),
      'reconciliation_required',(select count(*) from public.commerce_payment_attempts where state='reconciliation_required'),
      'active_entitlements',(select count(*) from public.learning_product_entitlements where source='purchase' and status='active' and revoked_at is null and starts_at<=now() and (ends_at is null or ends_at>now())),
      'reconciled_revenue_kes',(select coalesce(sum(amount_kes),0) from public.commerce_financial_ledger where entry_type='payment_settlement'),
      'reconciled_revenue_30d_kes',(select coalesce(sum(amount_kes),0) from public.commerce_financial_ledger where entry_type='payment_settlement' and occurred_at>=now()-interval '30 days')
    ),
    'recent',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select a.id attempt_id,a.order_id,a.state,a.expected_amount_kes amount_kes,o.currency,o.product_id,
             a.checkout_request_id,a.provider_receipt,r.receipt_number,r.issued_at,a.processing_error,a.created_at,a.updated_at
      from public.commerce_payment_attempts a
      join public.learning_product_orders o on o.id=a.order_id
      left join public.commerce_payment_receipts r on r.payment_attempt_id=a.id
      order by a.created_at desc limit greatest(1,least(coalesce(p_limit,100),500))
    ) x),'[]'::jsonb),
    'reconciliation',coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at asc) from (
      select a.id attempt_id,a.order_id,a.state,a.expected_amount_kes amount_kes,a.checkout_request_id,
             a.processing_error,a.created_at,a.updated_at
      from public.commerce_payment_attempts a where a.state='reconciliation_required'
      order by a.updated_at asc limit greatest(1,least(coalesce(p_limit,100),500))
    ) x),'[]'::jsonb)
  );
end;
$function$;

revoke all on function public.hq_payment_finance_overview(integer) from public, anon;
grant execute on function public.hq_payment_finance_overview(integer) to authenticated;

-- Keep payment initiation fail-closed across schema rollout.
update public.mpesa_runtime_control
set initiation_enabled=false,
    activation_reason=case when initiation_enabled then 'task19_financial_integrity_migration_forced_off' else activation_reason end,
    activated_at=null,
    updated_at=now()
where singleton=true;

commit;
