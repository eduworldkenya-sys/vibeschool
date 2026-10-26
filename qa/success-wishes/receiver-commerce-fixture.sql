-- Disposable fixture for Success Wishes receiver contract tests ONLY.
-- Does not represent actual Daraja payments, provider credentials or production proof.
create table public.learning_product_orders (
  id uuid primary key,
  amount_kes integer not null,
  status text not null,
  refunded_at timestamptz,
  product_snapshot jsonb not null
);
create table public.commerce_payment_attempts (
  id uuid primary key,
  order_id uuid not null references public.learning_product_orders(id),
  provider text not null,
  state text not null,
  provider_result_code integer,
  provider_receipt text,
  settled_at timestamptz,
  callback_received_at timestamptz,
  expected_amount_kes integer not null
);
grant select on public.learning_product_orders,public.commerce_payment_attempts to service_role;
