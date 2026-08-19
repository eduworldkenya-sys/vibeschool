begin;

-- Legacy canonical-school teacher connection remains part of the Teacher onboarding UI.
-- It may create teacher membership only for a current, active canonical Teacher profile.
create or replace function public.connect_teacher_to_school(
  p_school_id uuid,
  p_level text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_status text;
  v_anonymized boolean;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;

  select p.role::text, p.account_status::text, coalesce(p.is_anonymized,false)
    into v_role, v_status, v_anonymized
  from public.profiles p
  where p.id=v_uid;

  if not found
     or v_role is distinct from 'teacher'
     or v_status is distinct from 'active'
     or v_anonymized then
    raise exception 'teacher_authority_required' using errcode='42501';
  end if;

  if p_level is not null and p_level not in ('PRIMARY','JUNIOR','SENIOR_SECONDARY') then
    raise exception 'invalid_education_level' using errcode='22023';
  end if;

  if not exists(
    select 1 from public.schools s
    where s.id=p_school_id
      and s.deleted_at is null
      and s.status in ('pending','active')
  ) then
    raise exception 'school_not_available' using errcode='22023';
  end if;

  insert into public.school_members(school_id,profile_id,role)
  values(p_school_id,v_uid,'teacher')
  on conflict(school_id,profile_id) do nothing;

  update public.profiles set school_id=p_school_id where id=v_uid;

  insert into public.teacher_profiles(profile_id,school_id)
  values(v_uid,p_school_id)
  on conflict(profile_id) do update set school_id=excluded.school_id;

  if p_level is not null then
    insert into public.school_levels(school_id,level)
    values(p_school_id,p_level)
    on conflict do nothing;
  end if;

  return p_school_id;
end;
$$;
revoke all on function public.connect_teacher_to_school(uuid,text) from public, anon, service_role;
grant execute on function public.connect_teacher_to_school(uuid,text) to authenticated;

-- Class onboarding is a teacher-only continuation. Profile/school_id text is not authority:
-- a current teacher membership for the same school is required at execution time.
create or replace function public.onboard_teacher_class(
  p_school_id uuid,
  p_teacher_id uuid,
  p_grade text,
  p_stream text,
  p_subject text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_class_id uuid;
  v_subject_id uuid;
  v_role text;
  v_status text;
  v_anonymized boolean;
begin
  if v_uid is null or v_uid <> p_teacher_id then
    raise exception 'unauthorized_identity' using errcode='42501';
  end if;

  select p.role::text, p.account_status::text, coalesce(p.is_anonymized,false)
    into v_role, v_status, v_anonymized
  from public.profiles p
  where p.id=v_uid;

  if not found
     or v_role is distinct from 'teacher'
     or v_status is distinct from 'active'
     or v_anonymized then
    raise exception 'teacher_authority_required' using errcode='42501';
  end if;

  if not exists(
    select 1 from public.school_members sm
    where sm.profile_id=v_uid
      and sm.school_id=p_school_id
      and sm.role::text='teacher'
  ) then
    raise exception 'teacher_school_membership_required' using errcode='42501';
  end if;

  select s.id into v_subject_id
  from public.subjects s
  where s.school_id=p_school_id and s.name=p_subject
  limit 1;

  if v_subject_id is null then
    insert into public.subjects(school_id,name)
    values(p_school_id,p_subject)
    returning id into v_subject_id;
  end if;

  select c.id into v_class_id
  from public.classes c
  where c.school_id=p_school_id
    and c.name=p_grade
    and coalesce(c.stream,'')=coalesce(p_stream,'')
  limit 1;

  if v_class_id is null then
    insert into public.classes(school_id,teacher_id,name,stream,subject)
    values(p_school_id,v_uid,p_grade,nullif(p_stream,''),p_subject)
    returning id into v_class_id;
  end if;

  insert into public.teacher_classes(school_id,teacher_id,class_id,subject_id,is_class_teacher)
  values(p_school_id,v_uid,v_class_id,v_subject_id,true)
  on conflict do nothing;

  return v_class_id;
end;
$$;
revoke all on function public.onboard_teacher_class(uuid,uuid,text,text,text) from public, anon, service_role;
grant execute on function public.onboard_teacher_class(uuid,uuid,text,text,text) to authenticated;

-- Parent claims must bind an already-established active Parent identity. They must never
-- rewrite Teacher/Admin/Student/HQ identities into Parent or manufacture arbitrary links.
create or replace function public.redeem_parent_claim(p_code text, p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_code_row public.student_claim_codes%rowtype;
  v_student public.students%rowtype;
  v_school_id uuid;
  v_role text;
  v_status text;
  v_anonymized boolean;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized_identity' using errcode='42501';
  end if;

  select p.role::text, p.account_status::text, coalesce(p.is_anonymized,false)
    into v_role, v_status, v_anonymized
  from public.profiles p
  where p.id=p_user_id
  for update;

  if not found
     or v_role is distinct from 'parent'
     or v_status is distinct from 'active'
     or v_anonymized then
    raise exception 'parent_authority_required' using errcode='42501';
  end if;

  select * into v_code_row
  from public.student_claim_codes
  where code=upper(trim(p_code))
  limit 1
  for update;

  if not found then return 'not_found'; end if;
  if v_code_row.parent_claimed_at is not null then return 'already_claimed'; end if;
  if v_code_row.expires_at is not null and v_code_row.expires_at<now() then return 'expired'; end if;

  select * into v_student
  from public.students
  where id=v_code_row.student_id
  for update;

  if not found or v_student.deleted_at is not null then return 'student_not_found'; end if;

  select sc.school_id into v_school_id
  from public.student_classes sc
  where sc.student_id=v_student.id and sc.is_current=true
  limit 1;

  insert into public.parent_student_links(parent_id,student_id,school_id,relationship,is_primary,can_pickup,receives_alerts)
  values(p_user_id,v_student.id,v_school_id,'parent',true,true,true)
  on conflict(parent_id,student_id,school_id) do nothing;

  if v_school_id is not null then
    insert into public.school_members(school_id,profile_id,role,joined_at)
    values(v_school_id,p_user_id,'parent',now())
    on conflict(school_id,profile_id) do nothing;
    update public.profiles set school_id=v_school_id,updated_at=now() where id=p_user_id;
  end if;

  update public.student_claim_codes
  set parent_claimed_at=now(), parent_claimed_by=p_user_id,
      claimed=true, claimed_by=coalesce(claimed_by,p_user_id),
      claimed_at=coalesce(claimed_at,now())
  where id=v_code_row.id;

  return 'success';
end;
$$;
revoke all on function public.redeem_parent_claim(text,uuid) from public, anon, service_role;
grant execute on function public.redeem_parent_claim(text,uuid) to authenticated;

-- Student claims may establish an unclaimed profile as Student, or idempotently reuse the
-- same Student profile. They may not rewrite another established role, steal a learner that
-- is already bound to another Auth profile, or create a second canonical learner identity.
create or replace function public.redeem_student_claim(p_code text, p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_row public.student_claim_codes%rowtype;
  v_student public.students%rowtype;
  v_school public.schools%rowtype;
  v_slug text;
  v_school_id uuid;
  v_user_id uuid := coalesce(p_user_id,auth.uid());
  v_class_name text;
  v_grade_num int;
  v_role text;
  v_status text;
  v_anonymized boolean;
  v_existing_student_count integer;
  v_existing_student_id uuid;
begin
  if v_user_id is null or auth.uid() is null or auth.uid() <> v_user_id then
    raise exception 'unauthorized_identity' using errcode='42501';
  end if;

  select p.role::text,p.account_status::text,coalesce(p.is_anonymized,false)
    into v_role,v_status,v_anonymized
  from public.profiles p
  where p.id=v_user_id
  for update;

  if not found
     or v_status is distinct from 'active'
     or v_anonymized
     or (v_role is not null and v_role <> 'student') then
    raise exception 'student_identity_claim_not_allowed' using errcode='42501';
  end if;

  select * into v_row
  from public.student_claim_codes
  where code=upper(trim(p_code))
  limit 1
  for update;

  if not found then return jsonb_build_object('status','not_found'); end if;
  if v_row.student_claimed_at is not null then return jsonb_build_object('status','already_claimed'); end if;
  if v_row.expires_at is not null and v_row.expires_at<now() then return jsonb_build_object('status','expired'); end if;

  select * into v_student
  from public.students
  where id=v_row.student_id
  for update;

  if not found or v_student.deleted_at is not null then
    return jsonb_build_object('status','student_not_found');
  end if;

  if v_student.profile_id is not null and v_student.profile_id <> v_user_id then
    raise exception 'learner_identity_already_bound' using errcode='42501';
  end if;

  select count(*), min(s.id)
    into v_existing_student_count,v_existing_student_id
  from public.students s
  where s.profile_id=v_user_id and s.deleted_at is null;

  if v_existing_student_count > 1
     or (v_existing_student_count=1 and v_existing_student_id <> v_student.id) then
    raise exception 'ambiguous_learner_identity' using errcode='42501';
  end if;

  select c.name into v_class_name from public.classes c where c.id=v_student.class_id limit 1;
  v_grade_num := nullif(regexp_replace(coalesce(v_class_name,''),'\D','','g'),'')::int;

  if (v_grade_num is null or v_grade_num < 6) and not v_student.self_use_enabled then
    return jsonb_build_object('status','below_grade_requires_parent_opt_in');
  end if;

  select c.school_id into v_school_id from public.classes c where c.id=v_student.class_id limit 1;
  select * into v_school from public.schools s where s.id=v_school_id limit 1;
  if v_school_id is null or not found then return jsonb_build_object('status','school_not_found'); end if;

  v_slug := lower(regexp_replace(coalesce(v_school.subdomain,v_school.id::text),'[^a-z0-9]','','g'));
  if v_slug='' then v_slug:='vs'; end if;

  update public.students
  set profile_id=v_user_id
  where id=v_student.id
    and (profile_id is null or profile_id=v_user_id);

  if not found then
    raise exception 'learner_identity_already_bound' using errcode='42501';
  end if;

  update public.profiles
  set role='student',school_id=v_school_id,updated_at=now()
  where id=v_user_id and (role is null or role::text='student');

  insert into public.school_members(school_id,profile_id,role)
  values(v_school_id,v_user_id,'student')
  on conflict(school_id,profile_id) do update set role='student';

  update public.student_claim_codes
  set student_claimed_at=now(),student_claimed_by=v_user_id,
      claimed=true,claimed_by=coalesce(claimed_by,v_user_id),claimed_at=coalesce(claimed_at,now())
  where id=v_row.id;

  return jsonb_build_object(
    'status','success',
    'admission_number',coalesce(v_student.admission_number,v_student.id::text),
    'school_code',v_slug,
    'student_id',v_student.id
  );
end;
$$;
revoke all on function public.redeem_student_claim(text,uuid) from public, anon, service_role;
grant execute on function public.redeem_student_claim(text,uuid) to authenticated;

-- Canonical learners and parent relationships must originate from verified school/claim
-- evidence. A parent may not manufacture a canonical learner and relationship directly.
revoke all on function public.create_child_for_parent(text,date,uuid) from public, anon, authenticated, service_role;
comment on function public.create_child_for_parent(text,date,uuid) is
  'Legacy direct canonical-child creation disabled for client roles. Use verified learner claim / relationship workflow.';

notify pgrst, 'reload schema';
commit;
