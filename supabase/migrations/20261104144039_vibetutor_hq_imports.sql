begin;

-- access: owner-only public.vibetutor_imports
-- authorization-test: public.vibetutor_imports HQ platform owners can read/write; other authenticated users and anon are denied; imported tutor contact details never enter public discovery views

create table if not exists public.vibetutor_imports (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  phone text,
  email text,
  county text,
  town text,
  levels text[] not null default '{}',
  subjects text[] not null default '{}',
  qualifications text,
  experience_years numeric(4,1) check (experience_years is null or experience_years between 0 and 80),
  teaching_mode text not null default 'either' check (teaching_mode in ('online','physical','either')),
  rate_kes integer check (rate_kes is null or rate_kes > 0),
  availability text,
  source_name text not null,
  source_url text,
  source_notes text,
  consent_status text not null default 'not_contacted'
    check (consent_status in ('not_contacted','requested','granted','declined')),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','pending','verified','rejected')),
  imported_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vibetutor_imports_created_at_idx
  on public.vibetutor_imports (created_at desc);
create index if not exists vibetutor_imports_consent_status_idx
  on public.vibetutor_imports (consent_status);
create index if not exists vibetutor_imports_verification_status_idx
  on public.vibetutor_imports (verification_status);

alter table public.vibetutor_imports enable row level security;

drop policy if exists vibetutor_imports_hq_owner_all on public.vibetutor_imports;
create policy vibetutor_imports_hq_owner_all
  on public.vibetutor_imports
  for all to authenticated
  using (public.is_platform_owner())
  with check (public.is_platform_owner());

revoke all on public.vibetutor_imports from anon, public;
grant select, insert, update, delete on public.vibetutor_imports to authenticated;

comment on table public.vibetutor_imports is
  'Private HQ staging register for externally sourced VibeTutor leads. Never exposed in public tutor discovery. Consent and verification must be completed before separate tutor onboarding.';

commit;
