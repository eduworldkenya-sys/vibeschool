\set ON_ERROR_STOP on
-- Local/disposable database ONLY; all fixtures are rolled back.
begin;
do $$
declare t text;
begin
 foreach t in array array['teacher_employment_listings','teacher_employment_requests','teacher_employment_shortlists'] loop
  if has_table_privilege('anon','public.'||t,'SELECT') or has_any_column_privilege('anon','public.'||t,'SELECT') or has_table_privilege('anon','public.'||t,'INSERT') or has_any_column_privilege('anon','public.'||t,'INSERT') then raise exception 'Anonymous grant on private table %',t; end if;
  if not (select c.relrowsecurity from pg_class c where c.oid=('public.'||t)::regclass) then raise exception 'Missing RLS %',t; end if;
 end loop;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='teacher_employment_directory' and column_name in ('teacher_id','phone','email','tsc_number','documents','school_id','consented_at')) then raise exception 'Private fields in public projection'; end if;
 if not has_table_privilege('anon','public.teacher_employment_directory','SELECT') or has_table_privilege('anon','public.teacher_employment_directory','INSERT') then raise exception 'Invalid directory grants'; end if;
 if has_function_privilege('anon','teacher_employment_private.owns_homework_photo(text)','EXECUTE') or has_function_privilege('anon','teacher_employment_private.can_read_homework_photo(text)','EXECUTE') or has_function_privilege('anon','teacher_employment_private.is_current_teacher()','EXECUTE') then raise exception 'Anonymous teacher authority helper access'; end if;
 if not exists(select 1 from storage.buckets where id='teacher-employment-cvs' and public=false and file_size_limit=5242880) then raise exception 'CV bucket not private/bounded'; end if;
 if has_column_privilege('authenticated','public.teacher_employment_listings','teacher_id','UPDATE') or has_column_privilege('authenticated','public.teacher_employment_requests','school_name','INSERT') or has_column_privilege('authenticated','public.teacher_employment_requests','message','UPDATE') then raise exception 'Identity or message mutation grant'; end if;
end $$;
insert into auth.users(id,aud,role,email,raw_user_meta_data) values
 ('e1824000-0000-4000-8000-000000000001','authenticated','authenticated','employmenttest1@example.test','{"full_name":"Fixture Teacher","role":"teacher"}'),
 ('e1824000-0000-4000-8000-000000000002','authenticated','authenticated','employmenttest2@example.test','{"full_name":"Fixture Student","role":"student"}'),
 ('e1824000-0000-4000-8000-000000000003','authenticated','authenticated','employmenttest3@example.test','{"full_name":"Fixture Admin One","role":"teacher"}'),
 ('e1824000-0000-4000-8000-000000000004','authenticated','authenticated','employmenttest4@example.test','{"full_name":"Fixture Admin Two","role":"teacher"}');
insert into public.profiles(id,full_name,role,account_status) values
 ('e1824000-0000-4000-8000-000000000001','Fixture Teacher','teacher','active'),
 ('e1824000-0000-4000-8000-000000000002','Fixture Student','student','active'),
 ('e1824000-0000-4000-8000-000000000003','Fixture Admin One','teacher','active'),
 ('e1824000-0000-4000-8000-000000000004','Fixture Admin Two','teacher','active')
on conflict(id) do update set full_name=excluded.full_name, role=excluded.role, account_status=excluded.account_status;
insert into public.teacher_profiles(profile_id) values ('e1824000-0000-4000-8000-000000000001') on conflict(profile_id) do nothing;
insert into public.schools(id,name,subdomain,timezone,country_code,status,created_by)
values ('e1824000-0000-4000-8000-000000000011','Fixture School One','fixtureemploymentone','Africa/Nairobi','KE','active','e1824000-0000-4000-8000-000000000003'),
 ('e1824000-0000-4000-8000-000000000012','Fixture School Two','fixtureemploymenttwo','Africa/Nairobi','KE','active','e1824000-0000-4000-8000-000000000004');
insert into public.school_members(school_id,profile_id,role) values
 ('e1824000-0000-4000-8000-000000000011','e1824000-0000-4000-8000-000000000003','admin'),
 ('e1824000-0000-4000-8000-000000000012','e1824000-0000-4000-8000-000000000004','admin')
on conflict do nothing;
set local role authenticated;
select set_config('request.jwt.claim.sub','e1824000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"e1824000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into public.teacher_employment_listings(teacher_id,levels,subjects,qualification,experience,registration,counties,employment_types,availability,status,consented_at)
 values ('e1824000-0000-4000-8000-000000000001',array['Primary'],array['Mathematics'],'Degree',0,'Pending',array['Nairobi'],array['Full-time'],'Immediately','published',now());
select set_config('employment_test.listing',(select id::text from public.teacher_employment_listings where teacher_id=auth.uid()),true);
insert into storage.objects(bucket_id,name) values ('teacher-employment-cvs','personal/e1824000-0000-4000-8000-000000000001/cv.pdf');
do $$begin
 if not exists(select 1 from public.teacher_employment_directory where id=current_setting('employment_test.listing')::uuid) then raise exception 'Published profile missing'; end if;
 update public.teacher_employment_listings set status='paused' where id=current_setting('employment_test.listing')::uuid;
 if exists(select 1 from public.teacher_employment_directory where id=current_setting('employment_test.listing')::uuid) then raise exception 'Paused profile exposed'; end if;
 update public.teacher_employment_listings set status='published' where id=current_setting('employment_test.listing')::uuid;
 if not exists(select 1 from storage.objects where bucket_id='teacher-employment-cvs' and name='personal/e1824000-0000-4000-8000-000000000001/cv.pdf') then raise exception 'Personal CV not readable by owner'; end if;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{"role":"anon"}',true);
do $$begin
 if not exists(select 1 from public.teacher_employment_directory where id=current_setting('employment_test.listing')::uuid) then raise exception 'Public discoverability failed'; end if;
 if exists(select 1 from storage.objects where bucket_id='teacher-employment-cvs') then raise exception 'Anonymous CV access'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','e1824000-0000-4000-8000-000000000002',true),set_config('request.jwt.claims','{"sub":"e1824000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$declare n int; rejected boolean:=false;begin
 if exists(select 1 from public.teacher_employment_listings where id=current_setting('employment_test.listing')::uuid) then raise exception 'Nonowner read private listing'; end if;
 update public.teacher_employment_listings set status='paused' where id=current_setting('employment_test.listing')::uuid; get diagnostics n=row_count; if n<>0 then raise exception 'Nonowner changed listing'; end if;
 begin
 insert into public.teacher_employment_listings(teacher_id,levels,subjects,qualification,experience,registration,counties,employment_types,availability,status,consented_at) values (auth.uid(),array['Primary'],array['Mathematics'],'Degree',0,'Pending',array['Nairobi'],array['Full-time'],'Immediately','published',now());
 exception when insufficient_privilege then rejected:=true; end;
 if not rejected then raise exception 'Student published listing'; end if;
 if exists(select 1 from storage.objects where bucket_id='teacher-employment-cvs') then raise exception 'Unrelated student CV access'; end if;
 if teacher_employment_private.owns_homework_photo('e1824000-0000-4000-8000-000000000099/unrelated.jpg') or teacher_employment_private.can_read_homework_photo('e1824000-0000-4000-8000-000000000099/unrelated.jpg') then raise exception 'Unrelated homework evidence allowed'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','e1824000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"e1824000-0000-4000-8000-000000000003","role":"authenticated"}',true);
insert into public.teacher_employment_requests(listing_id,school_id,message) values(current_setting('employment_test.listing')::uuid,'e1824000-0000-4000-8000-000000000011','Fixture interview invite');
select set_config('employment_test.request',(select id::text from public.teacher_employment_requests where listing_id=current_setting('employment_test.listing')::uuid),true);
insert into public.teacher_employment_shortlists(school_id,listing_id) values('e1824000-0000-4000-8000-000000000011',current_setting('employment_test.listing')::uuid);
do $$declare denied boolean:=false; n int;begin
 if not exists(select 1 from public.teacher_employment_requests where id=current_setting('employment_test.request')::uuid and school_name='Fixture School One' and teacher_name='Fixture Teacher') then raise exception 'Derived request identity failed'; end if;
 begin insert into public.teacher_employment_requests(listing_id,school_id,message) values(current_setting('employment_test.listing')::uuid,'e1824000-0000-4000-8000-000000000012','Spoofed school');
 exception when insufficient_privilege or raise_exception then denied:=true; end;
 if not denied then raise exception 'School impersonation accepted'; end if;
 update public.teacher_employment_requests set status='accepted' where id=current_setting('employment_test.request')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'School accepted its own request'; end if;
 if exists(select 1 from storage.objects where bucket_id='teacher-employment-cvs') then raise exception 'School saw personal CV before sharing'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','e1824000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"e1824000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$declare denied boolean:=false;n int;begin
 begin insert into storage.objects(bucket_id,name) values('teacher-employment-cvs','shared/'||current_setting('employment_test.request')||'/cv.pdf');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Pending request allowed CV sharing';end if;
 update public.teacher_employment_requests set status='accepted' where id=current_setting('employment_test.request')::uuid;get diagnostics n=row_count;if n<>1 then raise exception 'Teacher could not accept invitation';end if;
end $$;
insert into storage.objects(bucket_id,name) values('teacher-employment-cvs','shared/'||current_setting('employment_test.request')||'/cv.pdf');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','e1824000-0000-4000-8000-000000000004',true),set_config('request.jwt.claims','{"sub":"e1824000-0000-4000-8000-000000000004","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from public.teacher_employment_requests where id=current_setting('employment_test.request')::uuid) or exists(select 1 from public.teacher_employment_shortlists where listing_id=current_setting('employment_test.listing')::uuid) or exists(select 1 from storage.objects where bucket_id='teacher-employment-cvs') then raise exception 'Cross-school private access';end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','e1824000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"e1824000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$begin
 if not exists(select 1 from storage.objects where bucket_id='teacher-employment-cvs' and name='shared/'||current_setting('employment_test.request')||'/cv.pdf') then raise exception 'Authorized shared CV unavailable';end if;
 if exists(select 1 from storage.objects where bucket_id='teacher-employment-cvs' and name like 'personal/%') then raise exception 'School accessed personal CV';end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','e1824000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"e1824000-0000-4000-8000-000000000001","role":"authenticated"}',true);
delete from storage.objects where bucket_id='teacher-employment-cvs' and name='shared/'||current_setting('employment_test.request')||'/cv.pdf';
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','e1824000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"e1824000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from storage.objects where bucket_id='teacher-employment-cvs' and name='shared/'||current_setting('employment_test.request')||'/cv.pdf') then raise exception 'Revoked CV still visible';end if;
end $$;
reset role;
rollback;
select 'Teacher employment authorization passed' as result;
