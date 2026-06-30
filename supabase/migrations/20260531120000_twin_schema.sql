-- twin_memory: stores every query a student makes
create table if not exists twin_memory (
  id          uuid primary key default gen_random_uuid(),
  user_id  uuid not null references profiles(id) on delete cascade,
  type        text not null,
  content     text not null,
  subject     text not null default 'general',
  created_at  timestamptz not null default now()
);

alter table twin_memory enable row level security;

create policy "Users own their twin memory"
  on twin_memory
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- twin_profile: stores learning profile per student
create table if not exists twin_profile (
  user_id   uuid primary key references profiles(id) on delete cascade,
  top_subjects text[]       not null default '{}',
  last_topic   text         not null default 'general',
  updated_at   timestamptz  not null default now()
);

alter table twin_profile enable row level security;

create policy "Users own their twin profile"
  on twin_profile
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- index for fast profile lookups
create index if not exists twin_memory_user_idx on twin_memory(user_id);
