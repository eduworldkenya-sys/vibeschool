begin;

-- Payment attempts are durable before any external M-Pesa side effect.
-- authorization-test: public.mpesa_payment_attempts authenticated may select only auth.uid() rows; anon and authenticated cannot write.
create table if not exists public.mpesa_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  package_id uuid,
  package_name text not null,
  expected_amount_kes integer not null check (expected_amount_kes > 0),
  credits integer not null check (credits > 0),
  phone text not null,
  idempotency_key text not null,
  state text not null default 'created' check (state in (
    'created','submitting','awaiting_customer','settled','failed','cancelled','expired','reconciliation_required'
  )),
  merchant_request_id text,
  checkout_request_id text,
  mpesa_receipt_number text,
  provider_result_code integer,
  provider_result_desc text,
  provider_response jsonb,
  processing_error text,
  requested_at timestamptz,
  callback_received_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, idempotency_key),
  unique (checkout_request_id),
  unique (mpesa_receipt_number)
);

create index if not exists mpesa_payment_attempts_teacher_created_idx
  on public.mpesa_payment_attempts (teacher_id, created_at desc);
create index if not exists mpesa_payment_attempts_state_updated_idx
  on public.mpesa_payment_attempts (state, updated_at)
  where state in ('created','submitting','awaiting_customer','reconciliation_required');

alter table public.mpesa_payment_attempts enable row level security;
revoke all on table public.mpesa_payment_attempts from public, anon, authenticated;
grant select on table public.mpesa_payment_attempts to authenticated;
grant all on table public.mpesa_payment_attempts to service_role;

drop policy if exists mpesa_payment_attempts_teacher_read_own on public.mpesa_payment_attempts;
create policy mpesa_payment_attempts_teacher_read_own
  on public.mpesa_payment_attempts
  for select
  to authenticated
  using (teacher_id = auth.uid());

-- Raw callback evidence is service-only and immutable to product clients.
-- access: service-only public.mpesa_callback_events
-- authorization-test: public.mpesa_callback_events anon and authenticated have no privileges or policies; service_role is the processing authority.
create table if not exists public.mpesa_callback_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  checkout_request_id text not null,
  merchant_request_id text,
  result_code integer,
  result_desc text,
  mpesa_receipt_number text,
  paid_amount_kes numeric(12,2),
  raw_payload jsonb not null,
  processing_status text not null default 'pending' check (processing_status in ('pending','processed','reconciliation_required')),
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists mpesa_callback_events_checkout_idx
  on public.mpesa_callback_events (checkout_request_id, received_at desc);
create index if not exists mpesa_callback_events_pending_idx
  on public.mpesa_callback_events (received_at)
  where processing_status = 'pending';

alter table public.mpesa_callback_events enable row level security;
revoke all on table public.mpesa_callback_events from public, anon, authenticated;
grant all on table public.mpesa_callback_events to service_role;

-- Operational activation is independent from commercial billing policy. A code
-- deploy must never activate payment initiation by itself. Production starts
-- disabled and an operator may flip this row only after schema, functions and a
-- controlled Daraja test are attested.
-- access: service-only public.mpesa_runtime_control
-- authorization-test: public.mpesa_runtime_control anon and authenticated have no privileges or policies; service_role may read/update the singleton control.
create table if not exists public.mpesa_runtime_control (
  singleton boolean primary key default true check (singleton),
  initiation_enabled boolean not null default false,
  activation_reason text,
  activated_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.mpesa_runtime_control enable row level security;
revoke all on table public.mpesa_runtime_control from public, anon, authenticated;
grant select, update on table public.mpesa_runtime_control to service_role;

insert into public.mpesa_runtime_control(singleton, initiation_enabled, activation_reason, activated_at)
values(true, false, 'payment_hardening_default_fail_closed', null)
on conflict(singleton) do nothing;

-- Only settled credits enter the credit ledger. This RPC is the single settlement gateway.
create or replace function public.settle_mpesa_credit_v2(
  p_checkout_id text,
  p_mpesa_ref text,
  p_paid_amount_kes numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_attempt public.mpesa_payment_attempts%rowtype;
  v_balance integer;
  v_new_balance integer;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'service_role_required';
  end if;

  if nullif(btrim(coalesce(p_checkout_id,'')),'') is null
     or nullif(btrim(coalesce(p_mpesa_ref,'')),'') is null
     or p_paid_amount_kes is null or p_paid_amount_kes <= 0 then
    return jsonb_build_object('success',false,'error','invalid_settlement_input');
  end if;

  select * into v_attempt
  from public.mpesa_payment_attempts
  where checkout_request_id = btrim(p_checkout_id)
  for update;

  if not found then
    return jsonb_build_object('success',false,'error','attempt_not_found');
  end if;

  if v_attempt.state = 'settled' then
    if v_attempt.mpesa_receipt_number = btrim(p_mpesa_ref) then
      return jsonb_build_object('success',true,'idempotent',true,'attempt_id',v_attempt.id);
    end if;
    update public.mpesa_payment_attempts
      set state='reconciliation_required', processing_error='settled_attempt_receipt_conflict', updated_at=now()
      where id=v_attempt.id;
    return jsonb_build_object('success',false,'error','receipt_conflict');
  end if;

  if p_paid_amount_kes <> v_attempt.expected_amount_kes then
    update public.mpesa_payment_attempts
      set state='reconciliation_required',
          processing_error=format('amount_mismatch expected=%s received=%s',v_attempt.expected_amount_kes,p_paid_amount_kes),
          callback_received_at=coalesce(callback_received_at,now()),
          updated_at=now()
      where id=v_attempt.id;
    return jsonb_build_object('success',false,'error','amount_mismatch');
  end if;

  if exists (
    select 1 from public.mpesa_payment_attempts
    where mpesa_receipt_number=btrim(p_mpesa_ref) and id<>v_attempt.id
  ) or exists (
    select 1 from public.vibe_credit_transactions
    where mpesa_ref=btrim(p_mpesa_ref)
  ) then
    update public.mpesa_payment_attempts
      set state='reconciliation_required', processing_error='duplicate_mpesa_receipt', updated_at=now()
      where id=v_attempt.id;
    return jsonb_build_object('success',false,'error','duplicate_receipt');
  end if;

  insert into public.vibe_credits(teacher_id,balance,total_earned,total_spent)
  values(v_attempt.teacher_id,0,0,0)
  on conflict(teacher_id) do nothing;

  select balance into v_balance
  from public.vibe_credits
  where teacher_id=v_attempt.teacher_id
  for update;

  v_new_balance := coalesce(v_balance,0) + v_attempt.credits;

  update public.vibe_credits
    set balance=v_new_balance,
        total_earned=coalesce(total_earned,0)+v_attempt.credits,
        updated_at=now()
    where teacher_id=v_attempt.teacher_id;

  insert into public.vibe_credit_transactions(
    teacher_id,type,feature,amount,balance_after,mpesa_ref,mpesa_amount_kes,notes
  ) values (
    v_attempt.teacher_id,'purchase','mpesa_stk',v_attempt.credits,v_new_balance,
    btrim(p_mpesa_ref),v_attempt.expected_amount_kes,
    format('M-Pesa settled — %s — CheckoutRequestID %s',v_attempt.package_name,v_attempt.checkout_request_id)
  );

  update public.mpesa_payment_attempts
    set state='settled',
        mpesa_receipt_number=btrim(p_mpesa_ref),
        callback_received_at=coalesce(callback_received_at,now()),
        settled_at=now(),
        processing_error=null,
        updated_at=now()
    where id=v_attempt.id;

  return jsonb_build_object(
    'success',true,
    'attempt_id',v_attempt.id,
    'credits_added',v_attempt.credits,
    'balance_after',v_new_balance,
    'receipt',btrim(p_mpesa_ref)
  );
end;
$function$;

revoke all on function public.settle_mpesa_credit_v2(text,text,numeric) from public, anon, authenticated;
grant execute on function public.settle_mpesa_credit_v2(text,text,numeric) to service_role;

-- Persisted callback events are processed idempotently. An event that arrives before
-- the STK response is attached to its attempt remains pending and can be replayed safely.
create or replace function public.process_mpesa_callback_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_event public.mpesa_callback_events%rowtype;
  v_attempt public.mpesa_payment_attempts%rowtype;
  v_result jsonb;
  v_terminal_state text;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'service_role_required';
  end if;

  select * into v_event
  from public.mpesa_callback_events
  where id=p_event_id
  for update;

  if not found then
    return jsonb_build_object('success',false,'error','event_not_found');
  end if;

  if v_event.processing_status='processed' then
    return jsonb_build_object('success',true,'idempotent',true);
  end if;

  select * into v_attempt
  from public.mpesa_payment_attempts
  where checkout_request_id=v_event.checkout_request_id
  for update;

  if not found then
    update public.mpesa_callback_events
      set processing_error='attempt_not_found'
      where id=v_event.id;
    return jsonb_build_object('success',false,'error','attempt_not_found');
  end if;

  if coalesce(v_event.result_code,-1) <> 0 then
    v_terminal_state := case
      when v_event.result_code = 1032 then 'cancelled'
      when v_event.result_code in (1037, 1) then 'expired'
      else 'failed'
    end;

    if v_attempt.state <> 'settled' then
      update public.mpesa_payment_attempts
        set state=v_terminal_state,
            provider_result_code=v_event.result_code,
            provider_result_desc=v_event.result_desc,
            callback_received_at=now(),
            processing_error=null,
            updated_at=now()
        where id=v_attempt.id;
    end if;

    update public.mpesa_callback_events
      set processing_status='processed',processing_error=null,processed_at=now()
      where id=v_event.id;

    return jsonb_build_object('success',true,'state',case when v_attempt.state='settled' then 'settled' else v_terminal_state end);
  end if;

  if nullif(btrim(coalesce(v_event.mpesa_receipt_number,'')),'') is null
     or v_event.paid_amount_kes is null or v_event.paid_amount_kes <= 0 then
    update public.mpesa_payment_attempts
      set state='reconciliation_required',
          provider_result_code=v_event.result_code,
          provider_result_desc=v_event.result_desc,
          callback_received_at=now(),
          processing_error='successful_callback_missing_receipt_or_amount',
          updated_at=now()
      where id=v_attempt.id and state <> 'settled';
    update public.mpesa_callback_events
      set processing_status='reconciliation_required',processing_error='missing_receipt_or_amount',processed_at=now()
      where id=v_event.id;
    return jsonb_build_object('success',false,'error','missing_receipt_or_amount');
  end if;

  v_result := public.settle_mpesa_credit_v2(
    v_event.checkout_request_id,
    v_event.mpesa_receipt_number,
    v_event.paid_amount_kes
  );

  if coalesce((v_result->>'success')::boolean,false) then
    update public.mpesa_callback_events
      set processing_status='processed',processing_error=null,processed_at=now()
      where id=v_event.id;
  else
    update public.mpesa_callback_events
      set processing_status='reconciliation_required',processing_error=v_result->>'error',processed_at=now()
      where id=v_event.id;
  end if;

  return v_result;
end;
$function$;

revoke all on function public.process_mpesa_callback_event(uuid) from public, anon, authenticated;
grant execute on function public.process_mpesa_callback_event(uuid) to service_role;

-- The teacher wallet reader self-authorizes by auth.uid(); restore the client contract.
grant execute on function public.get_credit_balance(uuid) to authenticated;

-- The current teacher UI/product language identifies the Vibe-* catalogue as canonical.
-- Retire obsolete duplicate economics without deleting historical package rows.
update public.vibe_credit_packages
set is_active=false
where name in ('Daily','Weekly','Monthly') and is_active=true;

commit;
