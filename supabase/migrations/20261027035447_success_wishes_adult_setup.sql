-- Pre-card setup for a trusted-operator-provisioned adult recipient.
-- No public enrollment or consent shortcut: the existing phone OTP and explicit
-- adult consent declaration remain mandatory. Existing receiver RLS/grants stay.
alter table public.success_wish_receivers
  add column setup_token_hash text,
  add column setup_expires_at timestamptz,
  add constraint success_wish_receiver_setup_shape check (
    (setup_token_hash is null and setup_expires_at is null) or
    (setup_token_hash is not null and setup_token_hash ~ '^[a-f0-9]{64}$'
      and setup_expires_at is not null and consent_route is not distinct from 'adult'
      and setup_expires_at > created_at
      and setup_expires_at <= created_at + interval '24 hours')
  );
create unique index success_wish_receiver_setup_hash_idx
  on public.success_wish_receivers (setup_token_hash) where setup_token_hash is not null;
comment on column public.success_wish_receivers.setup_token_hash is
  'SHA256(success-wishes:receiver-setup: + 256-bit private token). Operator provisioned only; not proof of phone ownership.';
