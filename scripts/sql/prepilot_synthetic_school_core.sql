\set ON_ERROR_STOP on

-- READY FOR FIRST TEACHER — disposable core synthetic school certification.
-- Runs only against an isolated local rebuild. Every fixture is transactional
-- and rolled back. Direct profile provisioning below is test-fixture setup,
-- never an application/auth provisioning path and never production seed data.

begin;

-- Stable synthetic principals. Direct SQL insertion into auth.users does not
-- execute the hosted Auth signup lifecycle in this isolated harness, therefore
-- profiles are created explicitly by postgres before school FKs are introduced.
insert into auth.users (
  id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,is_sso_user,is_anonymous
) values
  ('10000000-0000-0000-0000-000000000001','authenticated','authenticated','synthetic.admin.a@example.invalid',clock_timestamp(),'{}','{"role":"global_user","full_name":"Synthetic School Admin A"}',clock_timestamp(),clock_timestamp(),false,false),
  ('10000000-0000-0000-0000-000000000002','authenticated','authenticated','synthetic.teacher.a@example.invalid',clock_timestamp(),'{}','{"role":"teacher","full_name":"Synthetic Chemistry Teacher A"}',clock_timestamp(),clock_timestamp(),false,false),
  ('10000000-0000-0000-0000-000000000003','authenticated','authenticated','synthetic.teacher.b@example.invalid',clock_timestamp(),'{}','{"role":"teacher","full_name":"Synthetic Chemistry Teacher B"}',clock_timestamp(),clock_timestamp(),false,false),
  ('10000000-0000-0000-0000-000000000004','authenticated','authenticated','synthetic.parent.a@example.invalid',clock_timestamp(),'{}','{"role":"parent","full_name":"Synthetic Parent A"}',clock_timestamp(),clock_timestamp(),false,false),
  ('10000000-0000-0000-0000-000000000005','authenticated','authenticated','synthetic.parent.b@example.invalid',clock_timestamp(),'{}','{"role":"parent","full_name":"Synthetic Parent B"}',clock_timestamp(),clock_timestamp(),false,false);

insert into public.profiles (id,full_name,role,country_code) values
  ('10000000-0000-0000-0000-000000000001','Synthetic School Admin A','admin','KE'),
  ('10000000-0000-0000-0000-000000000002','Synthetic Chemistry Teacher A','teacher','KE'),
  ('10000000-0000-0000-0000-000000000003','Synthetic Chemistry Teacher B','teacher','KE'),
  ('10000000-0000-0000-0000-000000000004','Synthetic Parent A','parent','KE'),
  ('10000000-0000-0000-0000-000000000005','Synthetic Parent B','parent','KE');

insert into public.schools (
  id,name,subdomain,timezone,status,country_code,requires_dual_approval,
  created_by,school_category,directory_source
) values
  ('40000000-0000-0000-0000-000000000001','VibeSchool Synthetic Pilot A','synthetic-pilot-a','Africa/Nairobi','active','KE',true,'10000000-0000-0000-0000-000000000001','secondary','synthetic_certification'),
  ('40000000-0000-0000-0000-000000000002','VibeSchool Synthetic Isolation B','synthetic-isolation-b','Africa/Nairobi','active','KE',true,null,'secondary','synthetic_certification');

-- Membership must exist before assigning teacher profile.school_id because the
-- canonical teacher-onboarding trigger verifies that membership first.
insert into public.school_members (school_id,profile_id,role) values
  ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','admin'),
  ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','teacher'),
  ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','teacher');

update public.profiles
set school_id = case
  when id in ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000004')
    then '40000000-0000-0000-0000-000000000001'::uuid
  else '40000000-0000-0000-0000-000000000002'::uuid
end
where id in (
  '10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005'
);

-- Teacher onboarding may already have created the minimal role-extension row.
-- Enrich deterministically instead of assuming a blank teacher_profiles table.
insert into public.teacher_profiles (profile_id,school_id,employment_type,subjects_taught,designation) values
  ('10000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','synthetic',array['Chemistry'],'Chemistry Teacher'),
  ('10000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000002','synthetic',array['Chemistry'],'Isolation Teacher')
on conflict (profile_id) do update
set school_id=excluded.school_id,
    employment_type=excluded.employment_type,
    subjects_taught=excluded.subjects_taught,
    designation=excluded.designation;

insert into public.classes (id,teacher_id,name,stream,subject,school_id) values
  ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','Grade 10','A','Chemistry','40000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','Grade 10','B','Chemistry','40000000-0000-0000-0000-000000000002');

-- One synthetic global subject is sufficient for both tenant-isolation classes.
-- School-scoped subjects require a canonical global_subject_id link, so using a
-- global fixture avoids manufacturing a second subject identity domain.
insert into public.subjects (id,school_id,name,global_subject_id) values
  ('60000000-0000-0000-0000-000000000001',null,'Synthetic Chemistry',null);

insert into public.teacher_classes (school_id,teacher_id,class_id,subject_id,is_class_teacher) values
  ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001',true),
  ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000001',true);

-- Twenty Grade 10 Chemistry learners in School A plus one adversarial learner
-- in School B. Every learner has both Auth/profile and canonical student IDs.
do $$
declare
  i integer;
  v_profile uuid;
  v_student uuid;
  v_school uuid;
  v_class uuid;
  v_creator uuid;
begin
  for i in 1..21 loop
    v_profile := format('20000000-0000-0000-0000-%s',lpad(i::text,12,'0'))::uuid;
    v_student := format('30000000-0000-0000-0000-%s',lpad(i::text,12,'0'))::uuid;
    if i <= 20 then
      v_school := '40000000-0000-0000-0000-000000000001'::uuid;
      v_class := '50000000-0000-0000-0000-000000000001'::uuid;
      v_creator := '10000000-0000-0000-0000-000000000002'::uuid;
    else
      v_school := '40000000-0000-0000-0000-000000000002'::uuid;
      v_class := '50000000-0000-0000-0000-000000000002'::uuid;
      v_creator := '10000000-0000-0000-0000-000000000003'::uuid;
    end if;

    insert into auth.users (
      id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,
      created_at,updated_at,is_sso_user,is_anonymous
    ) values (
      v_profile,'authenticated','authenticated',format('synthetic.learner.%s@example.invalid',i),clock_timestamp(),
      '{}'::jsonb,jsonb_build_object('role','student','full_name',format('Synthetic Learner %s',i)),
      clock_timestamp(),clock_timestamp(),false,false
    );

    insert into public.profiles (id,full_name,role,country_code,school_id)
    values (v_profile,format('Synthetic Learner %s',i),'student','KE',v_school);

    insert into public.students (id,class_id,name,admission_number,profile_id,created_by,self_use_enabled)
    values (v_student,v_class,format('Synthetic Learner %s',i),format('SYN-%03s',i),v_profile,v_creator,true);

    insert into public.student_classes (school_id,student_id,class_id,is_current)
    values (v_school,v_student,v_class,true);
  end loop;
end
$$;

insert into public.parent_student_links (parent_id,student_id,school_id,relationship,is_primary,access_level) values
  ('10000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','guardian',true,'full'),
  ('10000000-0000-0000-0000-000000000005','30000000-0000-0000-0000-000000000021','40000000-0000-0000-0000-000000000002','guardian',true,'full');

do $$
begin
  if (select count(*) from public.students where class_id='50000000-0000-0000-0000-000000000001') <> 20 then
    raise exception 'synthetic pilot class must contain exactly 20 learners';
  end if;
  if has_table_privilege('anon','public.exams','SELECT')
     or has_table_privilege('anon','public.exams','INSERT')
     or has_table_privilege('anon','public.exams','UPDATE')
     or has_table_privilege('anon','public.exams','DELETE') then
    raise exception 'anon must have no public.exams privileges';
  end if;
end
$$;

-- Teacher A can create/manage an exam only in the active school to which they
-- belong. Cross-school direct-client writes must fail closed.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
set local role authenticated;

insert into public.exams (id,school_id,name,term,academic_year,exam_type,pass_mark,is_locked,created_by)
values ('70000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Synthetic Chemistry CAT',2,2026,'cat',50,false,'10000000-0000-0000-0000-000000000002');

do $$
begin
  begin
    insert into public.exams (id,school_id,name,term,academic_year,exam_type,pass_mark,is_locked,created_by)
    values ('70000000-0000-0000-0000-000000000099','40000000-0000-0000-0000-000000000002','ILLEGAL CROSS SCHOOL EXAM',2,2026,'cat',50,false,'10000000-0000-0000-0000-000000000002');
    raise exception 'cross-school exam insert unexpectedly succeeded';
  exception when insufficient_privilege or check_violation then null;
  end;
end
$$;

insert into public.exam_results (id,exam_id,school_id,class_id,subject_id,student_id,teacher_id,marks,is_absent) values
  ('71000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',78,false),
  ('71000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',42,false);

do $$
begin
  begin
    insert into public.exam_results (exam_id,school_id,class_id,subject_id,student_id,teacher_id,marks,is_absent)
    values ('70000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002',101,false);
    raise exception 'mark >100 unexpectedly succeeded';
  exception when check_violation then null;
  end;

  if (select count(*) from public.students) <> 20 then
    raise exception 'Teacher A can see a learner outside the assigned school/class';
  end if;
end
$$;
reset role;

-- Teacher B establishes an isolation-school result so the following read tests
-- prove cross-school and cross-child boundaries rather than testing emptiness.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
set local role authenticated;
insert into public.exams (id,school_id,name,term,academic_year,exam_type,pass_mark,is_locked,created_by)
values ('70000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','Isolation Chemistry CAT',2,2026,'cat',50,false,'10000000-0000-0000-0000-000000000003');
insert into public.exam_results (id,exam_id,school_id,class_id,subject_id,student_id,teacher_id,marks,is_absent)
values ('71000000-0000-0000-0000-000000000021','70000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000021','10000000-0000-0000-0000-000000000003',88,false);
reset role;

-- Parent A may read only the explicitly linked child's result.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.exam_results) <> 1 then raise exception 'Parent A exam-result boundary failed'; end if;
  if (select student_id from public.exam_results limit 1) <> '30000000-0000-0000-0000-000000000001'::uuid then raise exception 'Parent A received the wrong learner result'; end if;
end
$$;
reset role;

-- Learner 1 may read only their canonical learner result.
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.exam_results) <> 1 then raise exception 'Learner self-result boundary failed'; end if;
  if (select student_id from public.exam_results limit 1) <> '30000000-0000-0000-0000-000000000001'::uuid then raise exception 'Learner received another learner result'; end if;
end
$$;
reset role;

-- School Admin A sees School A results and never School B.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.exam_results) <> 2 then raise exception 'School Admin A result scope failed'; end if;
  if exists (select 1 from public.exam_results where school_id='40000000-0000-0000-0000-000000000002') then raise exception 'School Admin A can see School B results'; end if;
end
$$;
reset role;

rollback;
select 'PREPILOT_SYNTHETIC_SCHOOL_CORE_PASS' as certification;
