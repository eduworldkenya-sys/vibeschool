-- Explicit employment-system classification without assuming legacy teachers are TSC.
alter table public.teacher_swap_listings
 add column if not exists employment_sector text not null default 'unspecified';
alter table public.teacher_swap_listings
 drop constraint if exists teacher_swap_listings_employment_sector_check;
alter table public.teacher_swap_listings
 add constraint teacher_swap_listings_employment_sector_check
 check (employment_sector in ('unspecified', 'tsc', 'private'));
grant update(employment_sector) on public.teacher_swap_listings to authenticated;
comment on column public.teacher_swap_listings.employment_sector is
 'Teacher self-selected employment system: TSC or private school. Unspecified means historical/unverified; not an official verification or transfer approval.';
