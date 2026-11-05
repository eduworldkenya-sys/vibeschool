-- Production applied as Supabase migration teacher_vacancies_owner_governed_v1.
-- authorization-test: public.teacher_vacancies
-- Anonymous readers see only published, non-expired rows; platform owner manages records.
create table if not exists public.teacher_vacancies (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(btrim(title)) between 3 and 160),
 school_name text not null check (char_length(btrim(school_name)) between 2 and 180),
 county text not null check (char_length(btrim(county)) between 2 and 80),
 location text,
 employment_type text,
 application_url text check (application_url is null or application_url ~ '^https://[^[:space:]]+$'),
 closing_date date,
 status text not null default 'draft' check (status in ('draft','review','published','expired')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid not null default auth.uid(),
 published_at timestamptz,
 constraint teacher_vacancies_public_requires_link check (status <> 'published' or application_url is not null)
);
create index if not exists teacher_vacancies_public_idx on public.teacher_vacancies(status, closing_date, created_at desc);
alter table public.teacher_vacancies enable row level security;
revoke all on public.teacher_vacancies from public, anon, authenticated;
grant select on public.teacher_vacancies to anon, authenticated;
grant insert, update on public.teacher_vacancies to authenticated;
drop policy if exists teacher_vacancies_public_read on public.teacher_vacancies;
drop policy if exists teacher_vacancies_owner_read on public.teacher_vacancies;
drop policy if exists teacher_vacancies_owner_insert on public.teacher_vacancies;
drop policy if exists teacher_vacancies_owner_update on public.teacher_vacancies;
create policy teacher_vacancies_public_read on public.teacher_vacancies for select to anon, authenticated
 using (status='published' and (closing_date is null or closing_date>=current_date));
create policy teacher_vacancies_owner_read on public.teacher_vacancies for select to authenticated
 using ((select public.is_platform_owner()));
create policy teacher_vacancies_owner_insert on public.teacher_vacancies for insert to authenticated
 with check ((select public.is_platform_owner()) and created_by=(select auth.uid()));
create policy teacher_vacancies_owner_update on public.teacher_vacancies for update to authenticated
 using ((select public.is_platform_owner()))
 with check ((select public.is_platform_owner()));
