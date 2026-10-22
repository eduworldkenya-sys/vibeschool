-- DISPOSABLE POSTGRES FIXTURE ONLY. Never run against the VibeSchool live database.
-- No migration history entry, payments, live merchant configuration, or real entitlements.
begin;
create schema commerce_sandbox;
revoke all on schema commerce_sandbox from public;

create table commerce_sandbox.orders (
  id uuid primary key default gen_random_uuid(),
  mode text not null default 'sandbox' check (mode = 'sandbox'),
  product_kind text not null check (product_kind in (
    'teacher_credits','learning_product','exam_access','success_wish',
    'school_subscription','premium_feature'
  )),
  item_reference text not null check (length(trim(item_reference)) between 6 and 100),
  owner_type text not null check (owner_type in ('profile','guest')),
  owner_reference text not null check (length(trim(owner_reference)) between 6 and 100),
  amount_kes integer not null check (amount_kes between 1 and 250000),
  currency text not null default 'KES' check (currency = 'KES'),
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9_-]{16,80}$'),
  state text not null default 'created' check (state in ('created','awaiting_payment','settled_simulated','cancelled','reconciliation_required')),
  created_at timestamptz not null default now(),
  unique (owner_type,owner_reference,idempotency_key)
);

create table commerce_sandbox.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references commerce_sandbox.orders(id) on delete restrict,
  mode text not null default 'sandbox' check (mode = 'sandbox'),
  provider text not null default 'daraja_sandbox' check (provider='daraja_sandbox'),
  amount_kes integer not null check (amount_kes between 1 and 250000),
  phone text not null check (phone ~ '^254[17][0-9]{8}$'),
  state text not null default 'created' check (state in (
    'created','submitting','awaiting_customer','settled_simulated','failed',
    'cancelled','expired','reconciliation_required'
  )),
  checkout_request_id text unique,
  merchant_request_id text,
  provider_receipt text unique,
  created_at timestamptz not null default now()
);

-- At most one live/unresolved attempt for each order.
create unique index one_open_attempt_per_order
  on commerce_sandbox.payment_attempts(order_id)
  where state in ('created','submitting','awaiting_customer','reconciliation_required');

create table commerce_sandbox.callback_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references commerce_sandbox.payment_attempts(id) on delete restrict,
  provider_event_key text not null unique,
  checkout_request_id text not null,
  result_code integer not null,
  amount_kes integer,
  phone text,
  receipt text,
  received_at timestamptz not null default now(),
  check (length(provider_event_key) between 6 and 200),
  check (amount_kes is null or amount_kes between 1 and 250000),
  check (phone is null or phone ~ '^254[17][0-9]{8}$')
);

create function commerce_sandbox.guard_attempt_amount() returns trigger
language plpgsql set search_path = ''
as $$
declare v_amount integer;
begin
  select amount_kes into v_amount from commerce_sandbox.orders where id = new.order_id;
  if v_amount is null or v_amount <> new.amount_kes then
    raise exception 'sandbox_attempt_price_mismatch';
  end if;
  return new;
end $$;
create trigger require_order_price_before_attempt
before insert or update of amount_kes,order_id on commerce_sandbox.payment_attempts
for each row execute function commerce_sandbox.guard_attempt_amount();

create function commerce_sandbox.lock_order_terms() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (old.mode,old.product_kind,old.item_reference,old.owner_type,
      old.owner_reference,old.amount_kes,old.currency,old.idempotency_key)
     is distinct from
     (new.mode,new.product_kind,new.item_reference,new.owner_type,
      new.owner_reference,new.amount_kes,new.currency,new.idempotency_key)
  then raise exception 'sandbox_order_terms_immutable';
  end if;
  return new;
end $$;
create trigger immutable_order_terms
before update on commerce_sandbox.orders
for each row execute function commerce_sandbox.lock_order_terms();

create function commerce_sandbox.prevent_event_rewrite() returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'sandbox_events_append_only';
end $$;
create trigger immutable_callback_events
before update or delete on commerce_sandbox.callback_events
for each row execute function commerce_sandbox.prevent_event_rewrite();

-- No publicly exposed schema; layered RLS and no anon/auth grants.
alter table commerce_sandbox.orders enable row level security;
alter table commerce_sandbox.orders force row level security;
alter table commerce_sandbox.payment_attempts enable row level security;
alter table commerce_sandbox.payment_attempts force row level security;
alter table commerce_sandbox.callback_events enable row level security;
alter table commerce_sandbox.callback_events force row level security;
revoke all on all tables in schema commerce_sandbox from public;
revoke all on all functions in schema commerce_sandbox from public;
commit;
