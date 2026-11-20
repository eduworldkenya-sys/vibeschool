-- Issue #1824. New opt-in public directory, separate private ownership and recruitment requests.
-- Credential assertions are self-declared; no school authority is derived from them.
create table public.teacher_employment_listings (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null unique references public.profiles(id) on delete cascade,
 levels text[] not null check (cardinality(levels) between 1 and 4 and levels <@ array['ECDE','Primary','Junior School','Senior School']::text[]),
 subjects text[] not null check (cardinality(subjects) between 1 and 12 and length(array_to_string(subjects,',')) <= 240 and array_position(subjects,null) is null and length(btrim(array_to_string(subjects,''))) > 0),
 qualification text not null check (qualification in ('Certificate','Diploma','Degree','Postgraduate')),
 experience integer not null check (experience between 0 and 60),
 registration text not null check (registration in ('Registered','Pending','Not registered')),
 counties text[] not null check (cardinality(counties) between 1 and 47 and array_position(counties,null) is null),
 employment_types text[] not null check (cardinality(employment_types) between 1 and 3 and employment_types <@ array['Full-time','Part-time','Temporary / BOM']::text[]),
 availability text not null check (availability in ('Immediately','Within one month','Negotiable')),
 bio text not null default '' check (length(bio)<=600),
 education text not null default '' check (length(education)<=1500),
 work_history text not null default '' check (length(work_history)<=2000),
 status text not null default 'draft' check (status in ('draft','published','paused')),
 consented_at timestamptz,
 published_at timestamptz not null default now(),
 check (status <> 'published' or consented_at is not null)
);
alter table public.teacher_employment_listings enable row level security;
revoke all on public.teacher_employment_listings from public,anon,authenticated;
grant select,insert,update,delete on public.teacher_employment_listings to authenticated;
create policy employment_owner_read on public.teacher_employment_listings for select to authenticated using (teacher_id=(select auth.uid()));
create policy employment_owner_insert on public.teacher_employment_listings for insert to authenticated with check (
 teacher_id=(select auth.uid()) and exists(select 1 from public.profiles p join public.teacher_profiles t on t.profile_id=p.id where p.id=(select auth.uid()) and p.role='teacher' and p.account_status='active' and not coalesce(p.is_anonymized,false))
);
create policy employment_owner_update on public.teacher_employment_listings for update to authenticated using (teacher_id=(select auth.uid())) with check (
 teacher_id=(select auth.uid()) and exists(select 1 from public.profiles p join public.teacher_profiles t on t.profile_id=p.id where p.id=(select auth.uid()) and p.role='teacher' and p.account_status='active' and not coalesce(p.is_anonymized,false))
);
create policy employment_owner_delete on public.teacher_employment_listings for delete to authenticated using (teacher_id=(select auth.uid()));
create index teacher_employment_published_idx on public.teacher_employment_listings(published_at desc,id) where status='published';
create index teacher_employment_counties_idx on public.teacher_employment_listings using gin(counties) where status='published';
create index teacher_employment_levels_idx on public.teacher_employment_listings using gin(levels) where status='published';
-- Deliberate controlled projection: the underlying rows, owner IDs, and private profile fields are not public.
-- The view's owner access is necessary to make only the consented projection public. Do not add private fields.
create view public.teacher_employment_directory with (security_barrier=true) as
 select l.id,p.full_name::text as display_name,l.levels,l.subjects,l.qualification,l.experience,l.registration,l.counties,l.employment_types,l.availability,l.bio,l.education,l.work_history,l.published_at,
 concat_ws(' ',p.full_name,array_to_string(l.subjects,' '),array_to_string(l.levels,' ')) as search_text
 from public.teacher_employment_listings l join public.profiles p on p.id=l.teacher_id
 where l.status='published' and l.consented_at is not null and p.account_status='active' and p.role='teacher' and not coalesce(p.is_anonymized,false) and length(btrim(p.full_name))>0;
revoke all on public.teacher_employment_directory from public,anon,authenticated;
grant select on public.teacher_employment_directory to anon,authenticated;
create table public.teacher_employment_requests (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.teacher_employment_listings(id) on delete cascade,
 school_id uuid not null references public.schools(id) on delete cascade,
 school_name text not null default '',
 message text not null check (length(btrim(message)) between 1 and 1000),
 status text not null default 'pending' check (status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(),
 unique(listing_id,school_id)
);
alter table public.teacher_employment_requests enable row level security;
revoke all on public.teacher_employment_requests from public,anon,authenticated;
grant select on public.teacher_employment_requests to authenticated;
grant insert(listing_id,school_id,message) on public.teacher_employment_requests to authenticated;
grant update(status) on public.teacher_employment_requests to authenticated;
create function public.teacher_employment_request_school_name() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not public.is_school_admin(new.school_id) then raise exception 'School authorization required'; end if;
 select s.name into new.school_name from public.schools s where s.id=new.school_id and s.status='active' and s.deleted_at is null;
 if not found then raise exception 'School unavailable'; end if;
 return new;
end $$;
revoke all on function public.teacher_employment_request_school_name() from public,anon,authenticated;
create trigger employment_request_name before insert on public.teacher_employment_requests for each row execute function public.teacher_employment_request_school_name();
create policy employment_request_sender_read on public.teacher_employment_requests for select to authenticated using (public.is_school_admin(school_id));
create policy employment_request_receiver_read on public.teacher_employment_requests for select to authenticated using (
 exists(select 1 from public.teacher_employment_listings l where l.id=listing_id and l.teacher_id=(select auth.uid()))
);
create policy employment_request_sender_insert on public.teacher_employment_requests for insert to authenticated with check (
 public.is_school_admin(school_id) and status='pending' and exists(select 1 from public.teacher_employment_directory d where d.id=listing_id)
);
create policy employment_request_receiver_update on public.teacher_employment_requests for update to authenticated using (
 status='pending' and exists(select 1 from public.teacher_employment_listings l where l.id=listing_id and l.teacher_id=(select auth.uid()))
) with check (
 status in ('accepted','declined') and exists(select 1 from public.teacher_employment_listings l where l.id=listing_id and l.teacher_id=(select auth.uid()))
);
create index teacher_employment_requests_school_idx on public.teacher_employment_requests(school_id,created_at desc);
