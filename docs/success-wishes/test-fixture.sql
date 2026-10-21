-- Disposable PostgreSQL 17 fixture ONLY. Never apply to a Supabase project.
-- This approximates the checked canonical FK/column contract and is not a
-- substitute for an isolated Supabase reconstruction or real-school tests.
create schema if not exists extensions;
create schema if not exists auth;
create extension if not exists pgcrypto with schema extensions;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls; -- mirrors Supabase service_role
grant usage on schema public, auth, extensions to anon, authenticated, service_role;

create table public.schools (
  id uuid primary key,
  name text not null,
  status text not null default 'active',
  deleted_at timestamptz
);
create table public.students (
  id uuid primary key,
  name text not null,
  admission_number text,
  deleted_at timestamptz
);
create table public.classes (
  id uuid primary key,
  school_id uuid references public.schools(id),
  name text not null
);
create table public.student_classes (
  id uuid primary key,
  school_id uuid not null references public.schools(id),
  class_id uuid not null references public.classes(id),
  student_id uuid not null references public.students(id),
  is_current boolean not null default true,
  left_at timestamptz
);
create table public.profiles (
  id uuid primary key,
  account_status text not null,
  is_anonymized boolean not null default false
);
create table public.school_members (
  school_id uuid not null references public.schools(id),
  profile_id uuid not null references public.profiles(id),
  role text not null
);
grant select on public.schools, public.students, public.classes,
  public.student_classes, public.profiles, public.school_members to service_role;
grant select on public.profiles to authenticated;

create function auth.uid() returns uuid language sql stable
set search_path = '' as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
grant execute on function auth.uid() to authenticated, service_role;

create function public.is_school_admin(p_school_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.school_members m join public.schools s on s.id=m.school_id
    where m.school_id=p_school_id and m.profile_id=auth.uid()
      and m.role='admin' and s.deleted_at is null and s.status='active'
  );
$$;
create function public.is_operational_school(p_school_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.schools s where s.id=p_school_id
    and s.deleted_at is null and s.status='active');
$$;
grant execute on function public.is_school_admin(uuid),
  public.is_operational_school(uuid) to authenticated, service_role;

insert into public.schools(id,name) values
  ('11111111-1111-4111-8111-111111111111','School Alpha'),
  ('22222222-2222-4222-8222-222222222222','School Beta');
insert into public.students(id,name,admission_number) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Alice Wanjiku','A-100'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Brian Otieno','B-200');
insert into public.classes(id,school_id,name) values
  ('11111111-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Form 4A'),
  ('11111111-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','Form 4B'),
  ('22222222-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Form 4A');
insert into public.student_classes(id,school_id,class_id,student_id,is_current) values
  ('10000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111',
   '11111111-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true),
  ('10000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111',
   '11111111-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true),
  ('20000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222',
   '22222222-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
insert into public.profiles(id,account_status) values
  ('33333333-3333-4333-8333-333333333333','active'),
  ('44444444-4444-4444-8444-444444444444','active');
insert into public.school_members(school_id,profile_id,role) values
  ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','admin'),
  ('22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','admin');
