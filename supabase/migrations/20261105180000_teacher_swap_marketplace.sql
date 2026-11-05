-- Teacher Swap V1: discovery listings and private interest, separate from official TSC transfers.
create table if not exists public.teacher_swap_listings (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null references auth.users(id) on delete cascade,
 current_county text not null check (length(trim(current_county)) between 2 and 80),
 current_subcounty text not null check (length(trim(current_subcounty)) between 2 and 100),
 preferred_county text not null check (length(trim(preferred_county)) between 2 and 80),
 preferred_subcounty text,
 school_level text not null check (school_level in ('Primary','Junior School','Senior School')),
 subject text not null default '' check (length(subject)<=100),
 status text not null default 'published' check(status in ('published','paused')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint swap_different_counties check (lower(trim(current_county))<>lower(trim(preferred_county))),
 constraint swap_one_listing_per_teacher unique(teacher_id)
);
create index if not exists teacher_swap_discovery_idx on public.teacher_swap_listings(preferred_county,current_county,school_level) where status='published';
create table if not exists public.teacher_swap_interests (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.teacher_swap_listings(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 message text not null default '' check(length(message)<=500),
 contact_phone text not null check(contact_phone ~ '^[+]?[0-9]{10,15}),
 status text not null default 'pending' check(status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(),
 constraint swap_unique_interest unique(listing_id,sender_id)
);
create index if not exists teacher_swap_interests_sender_idx on public.teacher_swap_interests(sender_id);
create index if not exists teacher_swap_interests_listing_idx on public.teacher_swap_interests(listing_id);
alter table public.teacher_swap_listings enable row level security;
alter table public.teacher_swap_interests enable row level security;
revoke all on public.teacher_swap_listings from anon,authenticated;
revoke all on public.teacher_swap_interests from anon,authenticated;
grant select on public.teacher_swap_listings to anon,authenticated;
grant insert,delete on public.teacher_swap_listings to authenticated;
grant update(current_county,current_subcounty,preferred_county,preferred_subcounty,school_level,subject,status,updated_at) on public.teacher_swap_listings to authenticated;
grant select,insert,delete on public.teacher_swap_interests to authenticated;
grant update(status) on public.teacher_swap_interests to authenticated;
create policy "swap public discover and own listing" on public.teacher_swap_listings for select to anon,authenticated using (status='published' or teacher_id=(select auth.uid()));
create policy "swap owner publish" on public.teacher_swap_listings for insert to authenticated with check(teacher_id=(select auth.uid()));
create policy "swap owner edit" on public.teacher_swap_listings for update to authenticated using(teacher_id=(select auth.uid())) with check(teacher_id=(select auth.uid()));
create policy "swap owner delete" on public.teacher_swap_listings for delete to authenticated using(teacher_id=(select auth.uid()));
create policy "swap interest visible to participants" on public.teacher_swap_interests for select to authenticated using (sender_id=(select auth.uid()) or exists(select 1 from public.teacher_swap_listings l where l.id=listing_id and l.teacher_id=(select auth.uid())));
create policy "swap sender submit" on public.teacher_swap_interests for insert to authenticated with check (sender_id=(select auth.uid()) and exists(select 1 from public.teacher_swap_listings l where l.id=listing_id and l.teacher_id<>(select auth.uid()) and l.status='published'));
create policy "swap listing owner responds" on public.teacher_swap_interests for update to authenticated using(exists(select 1 from public.teacher_swap_listings l where l.id=listing_id and l.teacher_id=(select auth.uid()))) with check(exists(select 1 from public.teacher_swap_listings l where l.id=listing_id and l.teacher_id=(select auth.uid())));
create policy "swap sender withdraw" on public.teacher_swap_interests for delete to authenticated using(sender_id=(select auth.uid()));
comment on table public.teacher_swap_listings is 'Discovery only; no official TSC transfer status or public contact details.';
),
 status text not null default 'pending' check(status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(),
 constraint swap_unique_interest unique(listing_id,sender_id)
);
create index if not exists teacher_swap_interests_sender_idx on public.teacher_swap_interests(sender_id);
create index if not exists teacher_swap_interests_listing_idx on public.teacher_swap_interests(listing_id);
alter table public.teacher_swap_listings enable row level security;
alter table public.teacher_swap_interests enable row level security;
revoke all on public.teacher_swap_listings from anon,authenticated;
revoke all on public.teacher_swap_interests from anon,authenticated;
grant select on public.teacher_swap_listings to anon,authenticated;
grant insert,delete on public.teacher_swap_listings to authenticated;
grant update(current_county,current_subcounty,preferred_county,preferred_subcounty,school_level,subject,status,updated_at) on public.teacher_swap_listings to authenticated;
grant select,insert,delete on public.teacher_swap_interests to authenticated;
grant update(status) on public.teacher_swap_interests to authenticated;
create policy "swap public discover and own listing" on public.teacher_swap_listings for select to anon,authenticated using (status='published' or teacher_id=(select auth.uid()));
create policy "swap owner publish" on public.teacher_swap_listings for insert to authenticated with check(teacher_id=(select auth.uid()));
create policy "swap owner edit" on public.teacher_swap_listings for update to authenticated using(teacher_id=(select auth.uid())) with check(teacher_id=(select auth.uid()));
create policy "swap owner delete" on public.teacher_swap_listings for delete to authenticated using(teacher_id=(select auth.uid()));
create policy "swap interest visible to participants" on public.teacher_swap_interests for select to authenticated using (sender_id=(select auth.uid()) or exists(select 1 from public.teacher_swap_listings l where l.id=listing_id and l.teacher_id=(select auth.uid())));
create policy "swap sender submit" on public.teacher_swap_interests for insert to authenticated with check (sender_id=(select auth.uid()) and exists(select 1 from public.teacher_swap_listings l where l.id=listing_id and l.teacher_id<>(select auth.uid()) and l.status='published'));
create policy "swap listing owner responds" on public.teacher_swap_interests for update to authenticated using(exists(select 1 from public.teacher_swap_listings l where l.id=listing_id and l.teacher_id=(select auth.uid()))) with check(exists(select 1 from public.teacher_swap_listings l where l.id=listing_id and l.teacher_id=(select auth.uid())));
create policy "swap sender withdraw" on public.teacher_swap_interests for delete to authenticated using(sender_id=(select auth.uid()));
comment on table public.teacher_swap_listings is 'Discovery only; no official TSC transfer status or public contact details.';
