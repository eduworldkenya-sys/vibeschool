-- #1984: Activate an already guardian-created managed learner as a canonical
-- school-optional Student. One guardian authorization, no school gate and
-- no new role authority. Auth user creation happens in the API and is rolled
-- back if this all-or-nothing Postgres transaction rejects the child.
begin;

create or replace function public.vs_activate_managed_student(
  p_identity_id uuid,
  p_child_auth_user_id uuid,
  p_grade text
) returns jsonb
language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare
  v_guardian uuid := auth.uid();
  v_auth jsonb;
  v_ml public.vs_managed_learners%rowtype;
  v_child public.vs_identities%rowtype;
  v_student uuid;
  v_email text;
begin
  if v_guardian is null or p_identity_id is null or p_child_auth_user_id is null then
    raise exception 'Authenticated guardian required' using errcode='42501';
  end if;
  v_auth := public.get_my_auth_access_state();
  if v_auth->>'account_status' is distinct from 'active'
     or v_auth->>'is_anonymized' is distinct from 'false'
     or coalesce(v_auth->>'role','') not in ('parent','teacher') then
    raise exception 'Guardian account unavailable' using errcode='42501';
  end if;
  if not exists(select 1 from auth.users
                where id=v_guardian and email_confirmed_at is not null) then
    raise exception 'Verified guardian required' using errcode='42501';
  end if;
  select l.* into v_ml
    from public.vs_managed_learners l
    join public.vs_identities guardian on guardian.id=l.guardian_identity_id
   where l.learner_identity_id=p_identity_id
     and guardian.auth_user_id=v_guardian and guardian.kind='person'
   for update of l;
  if v_ml.learner_identity_id is null or v_ml.guardian_confirmed_at is null
     or v_ml.status<>'managed' or v_ml.linked_student_id is not null then
    raise exception 'Managed learner is not available for activation' using errcode='42501';
  end if;
  select * into v_child from public.vs_identities
   where id=p_identity_id for update;
  if v_child.kind<>'managed_learner' or v_child.auth_user_id is not null
     or v_child.username is null or nullif(btrim(v_child.display_name),'') is null then
    raise exception 'Child identity unavailable' using errcode='42501';
  end if;
  if p_grade not in ('PP1','PP2','Grade 1','Grade 2','Grade 3','Grade 4',
    'Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10',
    'Grade 11','Grade 12','Form 1','Form 2','Form 3','Form 4') then
    raise exception 'Choose a valid learning level' using errcode='22023';
  end if;
  v_email:=v_child.username||'@vs.internal';
  if not exists (
    select 1 from auth.users u
    where u.id=p_child_auth_user_id and lower(u.email)=v_email
      and u.email_confirmed_at is not null
  ) then
    raise exception 'Child sign-in identity not verified' using errcode='42501';
  end if;
  if exists(select 1 from public.students s where s.profile_id=p_child_auth_user_id) then
    raise exception 'Existing learner identity conflict' using errcode='23505';
  end if;

  -- The Auth user trigger usually created the profile; handle either case.
  insert into public.profiles(id,full_name,role,account_status,school_id,
      parental_consent_at,parental_consent_by)
  values(p_child_auth_user_id,v_child.display_name,'student','active',null,
      v_ml.guardian_confirmed_at,v_guardian)
  on conflict(id) do nothing;
  update public.profiles
     set role='student',full_name=v_child.display_name,
         parental_consent_at=v_ml.guardian_confirmed_at,
         parental_consent_by=v_guardian
   where id=p_child_auth_user_id and role is null
     and account_status::text='active' and not is_anonymized
     and school_id is null;
  -- If the insert succeeded, role is already student; otherwise the
  -- existing profile must be an untouched, valid account.
  if not exists (
     select 1 from public.profiles p where p.id=p_child_auth_user_id
       and p.role='student' and p.account_status::text='active'
       and not p.is_anonymized and p.school_id is null
       and p.parental_consent_by=v_guardian
  ) then
    raise exception 'Child account role conflict' using errcode='42501';
  end if;

  insert into public.students(profile_id,name,class_id,created_by)
  values(p_child_auth_user_id,v_child.display_name,null,v_guardian)
  returning id into v_student;

  insert into public.parent_student_links
   (parent_id,student_id,school_id,relationship,is_primary,access_level,
    can_pickup,receives_alerts,can_view_medical,can_view_finance)
  values(v_guardian,v_student,null,'guardian',true,'full',
         false,false,false,false);

  insert into public.independent_learner_identities
    (user_id,account_state,age_band,grade_label)
  values(p_child_auth_user_id,'restricted','under_18',p_grade);

  update public.vs_identities
     set kind='person',auth_user_id=p_child_auth_user_id,updated_at=now()
   where id=p_identity_id and kind='managed_learner' and auth_user_id is null;
  if not found then raise exception 'Child identity changed' using errcode='40001'; end if;

  update public.vs_managed_learners
     set status='linked',linked_student_id=v_student,grade_label=p_grade
   where learner_identity_id=p_identity_id and guardian_identity_id=v_ml.guardian_identity_id
     and status='managed';
  if not found then raise exception 'Guardian relationship changed' using errcode='40001'; end if;
  return jsonb_build_object('student_id',v_student,'username',v_child.username);
end;
$$;
revoke all on function public.vs_activate_managed_student(uuid,uuid,text) from public,anon;
grant execute on function public.vs_activate_managed_student(uuid,uuid,text) to authenticated;

-- Child access must be checked against the same guardian-owned, active
-- relationship that supplied the account. Never infer a school membership.
create or replace function public.vs_my_managed_student_login(p_identity_id uuid)
returns uuid
language sql stable security definer set search_path=public,auth,pg_temp as $$
  select child.auth_user_id
    from public.vs_managed_learners ml
    join public.vs_identities guardian on guardian.id=ml.guardian_identity_id
    join public.vs_identities child on child.id=ml.learner_identity_id
    join public.students student on student.id=ml.linked_student_id
    join public.parent_student_links link
      on link.student_id=student.id and link.parent_id=guardian.auth_user_id
     and link.access_level is distinct from 'none'
    join public.profiles guardian_profile on guardian_profile.id=guardian.auth_user_id
    join auth.users guardian_auth on guardian_auth.id=guardian.auth_user_id
   where guardian.auth_user_id=(select auth.uid()) and guardian.kind='person'
     and guardian_profile.account_status::text='active'
     and not guardian_profile.is_anonymized
     and guardian_profile.role in ('teacher','parent')
     and guardian_auth.email_confirmed_at is not null
     and ml.guardian_confirmed_at is not null
     and ml.learner_identity_id=p_identity_id and ml.status='linked'
     and student.profile_id=child.auth_user_id and student.deleted_at is null
   limit 1;
$$;
revoke all on function public.vs_my_managed_student_login(uuid) from public,anon;
grant execute on function public.vs_my_managed_student_login(uuid) to authenticated;

-- Return status and learning level to the guardian-owned profile list;
-- never return child credentials or another guardian's records.
create or replace function public.vs_list_my_identities()
returns jsonb language sql stable security definer set search_path=public,auth,pg_temp as $$
with mine as (
 select id,username,display_name,kind from public.vs_identities
  where auth_user_id=(select auth.uid()) and kind='person'
), kids as (
 select child.id,child.username,child.display_name,child.kind,
        ml.status,ml.grade_label,ml.linked_student_id
 from public.vs_managed_learners ml
 join mine m on ml.guardian_identity_id=m.id
 join public.vs_identities child on child.id=ml.learner_identity_id
)
select jsonb_build_object('self',(select to_jsonb(m) from mine m),
 'managed_learners',coalesce((select jsonb_agg(to_jsonb(k)) from kids k),'[]'::jsonb));
$$;
revoke all on function public.vs_list_my_identities() from public,anon;
grant execute on function public.vs_list_my_identities() to authenticated;

-- Existing learner onboarding resolution is retained, with a narrow
-- exception for this verified, school-optional, guardian-created account.
create or replace function public.get_my_onboarding_state()
returns jsonb language sql stable security definer set search_path=public,auth,pg_temp as $$
with base as (select public.get_my_auth_journey_state() as j),
eligible as (
 select i.grade_label from public.independent_learner_identities i
 join public.profiles p on p.id=i.user_id
 where i.user_id=(select auth.uid()) and i.account_state='restricted'
   and i.learner_email_verified_at is not null and i.grade_label is not null
   and p.role is null and p.account_status::text='active' and not p.is_anonymized
   and (select count(*) from public.students s where s.profile_id=i.user_id and s.deleted_at is null)<=1
   and not exists (select 1 from public.students s
       join public.student_classes sc on sc.student_id=s.id and sc.is_current=true
       where s.profile_id=i.user_id and s.deleted_at is null)
   and not exists (select 1 from public.students s where s.profile_id=i.user_id
       and s.deleted_at is null and s.class_id is not null)
 limit 1
), managed as (
 select ml.grade_label from public.vs_managed_learners ml
 join public.vs_identities child on child.id=ml.learner_identity_id
 join public.vs_identities guardian on guardian.id=ml.guardian_identity_id
 join public.parent_student_links link
   on link.student_id=ml.linked_student_id and link.parent_id=guardian.auth_user_id
 join public.students student on student.id=ml.linked_student_id
 join public.profiles profile on profile.id=child.auth_user_id
 where child.auth_user_id=(select auth.uid()) and ml.status='linked'
   and ml.guardian_confirmed_at is not null and ml.grade_label is not null
   and link.access_level is distinct from 'none'
   and student.profile_id=(select auth.uid()) and student.deleted_at is null
   and student.class_id is null and profile.role='student'
   and profile.account_status::text='active' and not profile.is_anonymized
   and not exists (select 1 from public.student_classes sc
     where sc.student_id=student.id and sc.is_current)
 limit 1
)
select case
 when (j->>'role')='teacher' and (j->>'reason_code')='TEACHER_SCHOOL_REQUIRED'
 then j || jsonb_build_object('state','ready','destination','/teacher/pulse',
      'reason_code','INDEPENDENT_TEACHER_READY','school_link_optional',true)
 when (j->>'role')='parent' and (j->>'reason_code')='PARENT_CHILD_REQUIRED'
 then j || jsonb_build_object('state','ready','destination','/parent',
      'reason_code','PARENT_READY_TO_LINK','child_link_optional',true)
 when (j->>'role')='student' and exists(select 1 from managed)
 then j || jsonb_build_object('state','ready','destination','/student',
      'reason_code','GUARDIAN_MANAGED_LEARNER_READY','school_link_optional',true)
 when (j->>'reason_code')='ROLE_UNCLAIMED' and exists(select 1 from eligible)
 then jsonb_build_object('authenticated',true,'role','student','state','ready',
      'destination','/student','independent',true,
      'grade_label',(select grade_label from eligible),
      'reason_code','INDEPENDENT_LEARNER_VERIFIED')
 else j end from base;
$$;
revoke all on function public.get_my_onboarding_state() from public,anon;
grant execute on function public.get_my_onboarding_state() to authenticated,service_role;
notify pgrst,'reload schema';
commit;
