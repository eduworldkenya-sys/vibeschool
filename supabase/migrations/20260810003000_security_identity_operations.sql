-- Security & Identity institutional ownership + immutable security event ledger.
insert into public.hq_departments(key,name,mandate,icon,sort_order,active)
values ('security_identity','Security & Identity','Authentication, password recovery, sessions, MFA, account lockouts, identity assurance, access control and account compromise response','security',45,true)
on conflict (key) do update set name=excluded.name,mandate=excluded.mandate,icon=excluded.icon,sort_order=excluded.sort_order,active=true;

create table if not exists public.hq_security_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_user_id uuid null,
  subject_user_id uuid null,
  subject_email text null,
  surface text not null,
  outcome text not null check (outcome in ('requested','allowed','denied','completed','failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.hq_security_events enable row level security;
revoke all on public.hq_security_events from anon, authenticated;
create index if not exists hq_security_events_created_at_idx on public.hq_security_events(created_at desc);
create index if not exists hq_security_events_subject_idx on public.hq_security_events(subject_user_id,created_at desc);
comment on table public.hq_security_events is 'Server-written Security & Identity audit ledger. No browser role has direct table access.';
