-- Disposable PostgreSQL fixture ONLY, not a migration for Supabase production.
alter table public.students add column date_of_birth date;
create table auth.users (id uuid primary key);
create table public.parent_student_links (
 id uuid primary key,
 student_id uuid not null references public.students(id),
 parent_id uuid not null references auth.users(id),
 school_id uuid references public.schools(id),
 relationship text not null,
 is_primary boolean not null default false,
 receives_alerts boolean not null default false
);
grant select on public.parent_student_links to service_role;
grant select on auth.users to service_role;
insert into auth.users (id) values
('55555555-5555-4555-8555-555555555555'),
('66666666-6666-4666-8666-666666666666');
insert into public.parent_student_links(id,student_id,parent_id,school_id,relationship,is_primary,receives_alerts) values
('70000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','guardian',true,true),
('70000000-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 '66666666-6666-4666-8666-666666666666','22222222-2222-4222-8222-222222222222','mother',true,true);
update public.students set date_of_birth=current_date-interval '16 years' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update public.students set date_of_birth=current_date-interval '16 years' where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
