-- Receiver safety and data rights. This queues requests for review without automatically destroying payment evidence.
-- access: service-only public.success_wish_receiver_reports
-- authorization-test: public.success_wish_receiver_reports
-- access: service-only public.success_wish_data_requests
-- authorization-test: public.success_wish_data_requests
alter table public.success_wish_cards add column if not exists hidden_at timestamptz;
create table public.success_wish_receiver_reports (
  id uuid primary key default gen_random_uuid(),
  receiver_id uuid not null references public.success_wish_receivers(id) on delete cascade,
  card_id uuid not null references public.success_wish_cards(id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 10 and 500),
  status text not null default 'open' check (status in ('open','under_review','resolved')),
  created_at timestamptz not null default now()
);
create index on public.success_wish_receiver_reports(receiver_id,created_at desc);
create table public.success_wish_data_requests (
  id uuid primary key default gen_random_uuid(),
  receiver_id uuid not null references public.success_wish_receivers(id) on delete cascade,
  kind text not null check (kind in ('deletion','access')),
  status text not null default 'pending' check (status in ('pending','reviewing','completed','rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index on public.success_wish_data_requests(receiver_id,created_at desc);
alter table public.success_wish_receiver_reports enable row level security;
alter table public.success_wish_data_requests enable row level security;
revoke all on public.success_wish_receiver_reports from public, anon, authenticated;
revoke all on public.success_wish_data_requests from public, anon, authenticated;
grant select,insert,update,delete on public.success_wish_receiver_reports to service_role;
grant select,insert,update,delete on public.success_wish_data_requests to service_role;
