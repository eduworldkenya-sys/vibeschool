begin;

-- Production compatibility bridge.
-- The canonical M-Pesa lifecycle migration creates this singleton earlier in a
-- clean rebuild, but historical production migration drift may leave that table
-- absent. Learning Product commerce must still install fail-closed rather than
-- depending on the older teacher-credit payment stack being promoted first.
--
-- This definition intentionally matches the canonical control contract. If the
-- table already exists, CREATE TABLE IF NOT EXISTS is a no-op; if it is absent,
-- the bridge creates only the operational kill switch, default OFF.
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

insert into public.mpesa_runtime_control(
  singleton,
  initiation_enabled,
  activation_reason,
  activated_at
)
values(
  true,
  false,
  'learning_product_commerce_fail_closed_compatibility',
  null
)
on conflict(singleton) do nothing;

comment on table public.mpesa_runtime_control is
'Operational kill switch for external M-Pesa initiation. Compatibility-safe and OFF by default; schema promotion never activates payments.';

commit;
