-- Task 3 exact-head concurrency repair.
-- PostgreSQL does not provide min(uuid) on the supported disposable runtime.
-- Preserve the Task 1 identity invariant without relying on an unsupported UUID
-- aggregate: count matching canonical learners and resolve one deterministically.

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

  select count(*)
    into v_existing_student_count
  from public.students s
  where s.profile_id=v_user_id and s.deleted_at is null;

  select s.id
    into v_existing_student_id
  from public.students s
  where s.profile_id=v_user_id and s.deleted_at is null
  order by s.id::text
  limit 1;

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
