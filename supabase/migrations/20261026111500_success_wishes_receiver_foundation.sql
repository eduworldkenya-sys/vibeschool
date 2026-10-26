-- Success Wishes receiver foundation. No checkout, provider credential, SMS or public grant is activated.
-- A separate commerce migration must explicitly classify real gift orders as success_wish_text.
create table if not exists public.success_wish_receivers (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete set null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 100),
  school_label text not null default '' check (char_length(school_label) <= 160),
  phone_e164 text not null check (phone_e164 ~ '^\+254[17][0-9]{8}$'),
  consent_status text not null default 'pending' check (consent_status in ('pending','verified','revoked')),
  created_at timestamptz not null default now()
);
-- Deliberately no UNIQUE(phone_e164): guardians and siblings share phones.
create index if not exists success_wish_receivers_phone_idx on public.success_wish_receivers(phone_e164);
create table if not exists public.success_wish_cards (
  id uuid primary key default gen_random_uuid(),
  receiver_id uuid not null references public.success_wish_receivers(id) on delete restrict,
  payment_attempt_id uuid not null unique references public.commerce_payment_attempts(id) on delete restrict,
  theme text not null check (theme in ('heritage','botanical','nightfall','sunrise')),
  sender_name text not null check (char_length(btrim(sender_name)) between 1 and 100),
  sender_reveal_early boolean not null default false,
  message text not null check (char_length(btrim(message)) between 1 and 1500),
  exam_year text not null check (exam_year ~ '^20[0-9]{2}$'),
  opened_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists success_wish_cards_receiver_idx on public.success_wish_cards(receiver_id,created_at desc);
create table if not exists public.success_wish_card_access (
  card_id uuid primary key references public.success_wish_cards(id) on delete cascade,
  link_hash text not null unique check (link_hash ~ '^[a-f0-9]{64}$'),
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  revoked_at timestamptz,
  expires_at timestamptz not null
);
create table if not exists public.success_wish_card_sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  card_id uuid not null references public.success_wish_cards(id) on delete cascade,
  expires_at timestamptz not null
);
create index if not exists success_wish_card_sessions_card_idx on public.success_wish_card_sessions(card_id);
create table if not exists public.success_wish_sms_deliveries (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references public.success_wish_cards(id) on delete restrict,
  receiver_id uuid references public.success_wish_receivers(id) on delete restrict,
  purpose text not null check (purpose in ('card','recovery','request')),
  provider_id text,
  status text not null default 'queued' check (status in ('queued','accepted','delivered','failed')),
  failure_code text,
  cost_kes numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(card_id is not null or receiver_id is not null)
);
create table if not exists public.success_wish_receiver_challenges (
  id uuid primary key default gen_random_uuid(),
  receiver_id uuid not null references public.success_wish_receivers(id) on delete cascade,
  code_hash text not null check (code_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  attempts int not null default 0 check (attempts between 0 and 5),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists success_wish_receiver_challenges_receiver_idx on public.success_wish_receiver_challenges(receiver_id,created_at desc);
create table if not exists public.success_wish_receiver_sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  receiver_id uuid not null references public.success_wish_receivers(id) on delete cascade,
  expires_at timestamptz not null
);
create table if not exists public.success_wish_requests (
  id uuid primary key default gen_random_uuid(),
  receiver_id uuid not null references public.success_wish_receivers(id) on delete cascade,
  invitee_phone_e164 text not null check (invitee_phone_e164 ~ '^\+254[17][0-9]{8}$'),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists success_wish_requests_receiver_idx on public.success_wish_requests(receiver_id,created_at desc);
-- The settlement guard makes an unrelated textbook payment or a simulated callback unusable.
-- The commerce team MUST create real gift orders with this classification before fulfilment.
create or replace function public.success_wish_assert_real_settlement()
returns trigger language plpgsql set search_path=public as $$
begin
  if not exists (
    select 1 from public.commerce_payment_attempts a
    join public.learning_product_orders o on o.id = a.order_id
    where a.id = new.payment_attempt_id
      and a.provider = 'mpesa' and a.state = 'settled'
      and a.provider_result_code = 0 and a.provider_receipt is not null
      and a.settled_at is not null and a.callback_received_at is not null
      and a.expected_amount_kes = 50 and o.amount_kes = 50
      and o.status = 'paid' and o.refunded_at is null
      and o.product_snapshot ->> 'kind' = 'success_wish_text'
  ) then
    raise exception 'Success Wish requires a verified, eligible real KSh 50 settlement' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.success_wish_assert_real_settlement() from public, anon, authenticated;
drop trigger if exists success_wish_paid_insert on public.success_wish_cards;
create trigger success_wish_paid_insert before insert or update of payment_attempt_id on public.success_wish_cards
for each row execute function public.success_wish_assert_real_settlement();
-- No user-facing PostgREST access; all access passes through guarded Node handlers.
do $$
declare name text;
begin
  foreach name in array array[
    'success_wish_receivers','success_wish_cards','success_wish_card_access','success_wish_card_sessions',
    'success_wish_sms_deliveries','success_wish_receiver_challenges','success_wish_receiver_sessions','success_wish_requests'
  ] loop
    execute format('alter table public.%I enable row level security',name);
    execute format('revoke all on public.%I from public, anon, authenticated',name);
    execute format('grant select,insert,update,delete on public.%I to service_role',name);
  end loop;
end $$;
