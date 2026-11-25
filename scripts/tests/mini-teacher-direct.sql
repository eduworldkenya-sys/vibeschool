-- Run only in a disposable, empty PostgreSQL database.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create schema storage;
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema auth,storage to anon,authenticated,service_role;
create table public.profiles(
 id uuid primary key, role text, account_status text default 'active',
 is_anonymized boolean default false, date_of_birth date, full_name text,
 parental_consent_at timestamptz, parental_consent_by uuid
);
create table public.teacher_profiles(profile_id uuid);
create table public.teacher_profile_verifications(
 profile_id uuid primary key, tsc_status text, tsc_verified_at timestamptz, verified_by uuid
);
create table public.global_public_profiles(
 profile_id uuid primary key, username text unique, display_name text, is_public boolean
);
create table public.vs_identities(auth_user_id uuid primary key, username text, display_name text);
create table public.hq_human_members(
 profile_id uuid, role text,status text,permissions text[],access_expires_at timestamptz,
 revoked_at timestamptz,suspended_at timestamptz
);
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));
alter table storage.objects enable row level security;
grant select on storage.objects to anon,authenticated,service_role;
grant insert on storage.objects to authenticated;
\ir ../../supabase/migrations/20261124044148_mini_lessons_foundation_v1.sql
\ir ../../supabase/migrations/20261124044153_mini_lessons_review_and_abuse_limits.sql
\ir ../../supabase/migrations/20261124044155_mini_lessons_verified_creator_clearance.sql
\ir ../../supabase/migrations/20261124044200_mini_lesson_requests_guarded.sql
\ir ../../supabase/migrations/20261124072331_mini_open_creator_safety_scans.sql
\ir ../../supabase/migrations/20261124072333_mini_scanner_service_permissions.sql
-- Production already has audio; the direct path also tolerates no slide column.
\ir ../../supabase/migrations/20261124233000_mini_voice_optional.sql
\ir ../../supabase/migrations/20261125190000_mini_teacher_direct_photo.sql

insert into public.profiles(id, role, full_name, date_of_birth) values
 ('20000000-0000-0000-0000-000000000001','teacher','Test educator',current_date - interval '30 years'),
 ('20000000-0000-0000-0000-000000000002','teacher','Unverified educator',current_date - interval '30 years'),
 ('20000000-0000-0000-0000-000000000003','teacher','Minor account',current_date - interval '15 years'),
 ('20000000-0000-0000-0000-000000000004','teacher','Self verifier',current_date - interval '30 years'),
 ('20000000-0000-0000-0000-000000000005','teacher','Independent verified adult',current_date - interval '34 years');
insert into public.profiles(id,role,full_name)
select ('20000000-0000-0000-0000-00000000000'||n)::uuid,'student','Test reader'
from generate_series(6,9) n;
insert into public.teacher_profile_verifications values
 ('20000000-0000-0000-0000-000000000001','verified',now(),'20000000-0000-0000-0000-000000000002'),
 ('20000000-0000-0000-0000-000000000003','verified',now(),'20000000-0000-0000-0000-000000000002'),
 ('20000000-0000-0000-0000-000000000004','verified',now(),'20000000-0000-0000-0000-000000000004');
insert into public.mini_creator_clearances(profile_id,verified_birthdate,verified_by,evidence_reference) values
 ('20000000-0000-0000-0000-000000000005',current_date - interval '34 years',
  '20000000-0000-0000-0000-000000000002','fixture: verified independently');

create function public.test_mini_teacher_save(p_consent jsonb)
returns uuid language sql as $$
 select public.mini_save_teacher_photo('10000000-0000-0000-0000-000000000001',
   'The number line','A number line shows the order of numbers from left to right.',
   'Mathematics',array['mathematics'],null,array[]::text[],null,null,'jpg',p_consent)
$$;

set role authenticated;
do $$
declare n int; v_id uuid:='10000000-0000-0000-0000-000000000001';
begin
 for n in 2..4 loop
   perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-00000000000'||n,true);
   if (public.mini_my_teacher_photo_profile()->>'eligible')::boolean then raise exception 'Invalid eligibility: %',n; end if;
   begin
     perform public.test_mini_teacher_save('{"accepted":true,"username":"test_teacher","displayName":"Test educator"}');
     raise exception 'Ineligible account saved a Mini: %',n;
   exception when insufficient_privilege then null;
   end;
 end loop;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000005',true);
 if (public.mini_my_teacher_photo_profile()->>'eligible')::boolean is distinct from true then
   raise exception 'Independent adult clearance lost';
 end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 begin
   perform public.test_mini_teacher_save(null);
   raise exception 'Saved without public consent';
 exception when insufficient_privilege then null;
 end;
 if public.test_mini_teacher_save('{"accepted":true,"username":"test_teacher","displayName":"Test educator"}') is distinct from v_id
    or public.test_mini_teacher_save(null) is distinct from v_id then raise exception 'Draft retry failed'; end if;
 if (select count(*) from public.mini_lessons where id=v_id and status='draft') <> 1 then raise exception 'Duplicate or public draft'; end if;
 update public.mini_lessons set title='Unexpected edit' where id=v_id;
 if found then raise exception 'Draft version tampered'; end if;
 begin
   perform public.mini_release_teacher_photo(auth.uid(),v_id,now(),null);
   raise exception 'Client can invoke service publication';
 exception when insufficient_privilege then null;
 end;
 insert into storage.objects values ('mini-covers',auth.uid()::text||'/'||v_id::text||'.jpg');
end $$;
reset role;

select set_config('request.jwt.claim.sub','',false);
set role anon;
do $$ begin
 if exists(select 1 from public.mini_lessons) or exists(select 1 from storage.objects) then
   raise exception 'Private draft or cover is public';
 end if;
end $$;
reset role;

set role service_role;
do $$
declare v_item public.mini_lessons%rowtype;
begin
 select * into strict v_item from public.mini_lessons;
 if public.mini_release_teacher_photo('20000000-0000-0000-0000-000000000002',v_item.id,v_item.updated_at,v_item.cover_path)
    or public.mini_release_teacher_photo(v_item.creator_id,v_item.id,v_item.updated_at-interval '1 second',v_item.cover_path)
    or public.mini_release_teacher_photo(v_item.creator_id,v_item.id,v_item.updated_at,'wrong path') then
   raise exception 'Release accepted spoofed owner, stale version or wrong cover';
 end if;
 if not public.mini_release_teacher_photo(v_item.creator_id,v_item.id,v_item.updated_at,v_item.cover_path)
    or not public.mini_release_teacher_photo(v_item.creator_id,v_item.id,v_item.updated_at,v_item.cover_path) then
   raise exception 'Release or idempotent retry failed without an external scan';
 end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub','',false);
set role anon;
do $$ begin
 if (select count(*) from public.mini_lessons where status='approved' and reviewed_at is null) <> 1
    or (select count(*) from storage.objects) <> 1 then
   raise exception 'Public post or cover absent, or a scan verdict was fabricated';
 end if;
end $$;
reset role;

set role authenticated;
do $$
declare n int; v_id uuid:='10000000-0000-0000-0000-000000000001';
begin
 for n in 5..9 loop
   perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-00000000000'||n,true);
   insert into public.mini_reports(mini_id,reporter_id,reason) values(v_id,auth.uid(),'unsafe');
 end loop;
end $$;
reset role;

select set_config('request.jwt.claim.sub','',false);
set role anon;
do $$ begin
 if exists(select 1 from public.mini_lessons) or exists(select 1 from storage.objects) then
   raise exception 'Report hold did not hide the post and cover';
 end if;
end $$;
reset role;
