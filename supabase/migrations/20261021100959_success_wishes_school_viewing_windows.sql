begin;

-- School-device sessions for candidates who cannot use a personal device.
-- These records contain no candidate identity, message content or provider data.
create table public.success_wishes_viewing_windows (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.success_wishes_schools(school_id) on delete cascade,
  weekday smallint not null check(weekday between 0 and 6),
  starts_at time without time zone not null,
  ends_at time without time zone not null,
  venue text not null check(length(trim(venue)) between 2 and 120),
  guidance text not null default '' check(length(guidance) <= 320),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint success_wishes_viewing_valid_hours check(ends_at > starts_at),
  constraint success_wishes_viewing_unique_slot unique(school_id,weekday,starts_at,ends_at)
);
create index success_wishes_viewing_school_day_idx
on public.success_wishes_viewing_windows(school_id,weekday,starts_at);

-- access: service-only public.success_wishes_viewing_windows
-- authorization-test: public.success_wishes_viewing_windows
alter table public.success_wishes_viewing_windows enable row level security;
revoke all on table public.success_wishes_viewing_windows from public,anon,authenticated;
grant select,insert,update,delete on table public.success_wishes_viewing_windows to service_role;

-- No unauthenticated or direct authenticated SQL access. Staff and current
-- candidate sessions may only read through independently authorised APIs.
commit;
