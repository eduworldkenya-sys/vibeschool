begin;

-- A school-issued shared claim proves the learner has already been identified by
-- an authorized teacher/admin against a current school enrollment. Parent linking
-- is an independent family-access relationship and must not be a prerequisite for
-- the learner to activate that existing school identity.
create or replace function public.finalize_student_provisioning(
  p_code text,
  p_user_id uuid,
  p_full_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.student_claim_codes%rowtype;
  v_student public.students%rowtype;
  v_class_id uuid;
  v_school_id uuid;
  v_profile_role text;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'service_role_required';
  end if;
  if p_user_id is null then
    raise exception 'user_id_required';
  end if;

  select * into v_row
  from public.student_claim_codes
  where code=upper(trim(p_code))
    and role='shared'
    and revoked_at is null
  limit 1
  for update;

  if not found then
    return jsonb_build_object(
      'status',
      case when exists(
        select 1 from public.student_claim_codes
        where code=upper(trim(p_code)) and revoked_at is not null
      ) then 'replaced' else 'not_found' end
    );
  end if;

  select * into v_student
  from public.students
  where id=v_row.student_id
  limit 1
  for update;

  if not found or v_student.deleted_at is not null then
    return jsonb_build_object('status','student_not_found');
  end if;
  if v_student.profile_id=p_user_id and v_row.student_claimed_at is not null then
    return jsonb_build_object('status','success','student_id',v_student.id,'replayed',true);
  end if;
  if v_row.student_claimed_at is not null or v_student.profile_id is not null then
    return jsonb_build_object('status','already_claimed');
  end if;
  if v_row.expires_at is not null and v_row.expires_at<now() then
    return jsonb_build_object('status','expired');
  end if;

  select sc.class_id, sc.school_id
    into v_class_id, v_school_id
  from public.student_classes sc
  where sc.student_id=v_student.id
    and sc.is_current=true
  order by sc.joined_at desc nulls last, sc.id desc
  limit 1;

  if v_class_id is null then
    return jsonb_build_object('status','class_not_found');
  end if;
  if v_school_id is null then
    return jsonb_build_object('status','school_not_found');
  end if;
  if v_student.class_id is distinct from v_class_id then
    return jsonb_build_object('status','enrollment_conflict');
  end if;

  -- Parent/guardian linkage is intentionally NOT checked here. Family access is
  -- governed by parent_student_links and its own authority/RLS path.
  select p.role::text into v_profile_role
  from public.profiles p
  where p.id=p_user_id
  for update;

  if not found then
    return jsonb_build_object('status','profile_missing');
  end if;
  if v_profile_role is not null and v_profile_role<>'student' then
    return jsonb_build_object('status','profile_role_conflict');
  end if;

  update public.students
  set profile_id=p_user_id
  where id=v_student.id and profile_id is null;
  if not found then
    return jsonb_build_object('status','already_claimed');
  end if;

  update public.profiles
  set role='student', school_id=v_school_id, full_name=v_student.name, updated_at=now()
  where id=p_user_id;

  insert into public.school_members(school_id,profile_id,role)
  values(v_school_id,p_user_id,'student')
  on conflict(school_id,profile_id) do update set role=excluded.role;

  update public.student_claim_codes
  set student_claimed_at=coalesce(student_claimed_at,now()),
      student_claimed_by=coalesce(student_claimed_by,p_user_id),
      claimed=true,
      claimed_at=coalesce(claimed_at,now()),
      claimed_by=coalesce(claimed_by,p_user_id)
  where id=v_row.id and student_claimed_at is null;

  return jsonb_build_object(
    'status','success',
    'student_id',v_student.id,
    'student_name',v_student.name,
    'guardian_linked',exists(
      select 1 from public.parent_student_links psl
      where psl.student_id=v_student.id
        and psl.school_id=v_school_id
        and coalesce(psl.access_level::text,'') <> 'none'
    ),
    'replayed',false
  );
end;
$$;

revoke all on function public.finalize_student_provisioning(text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.finalize_student_provisioning(text,uuid,text)
  to service_role;

comment on function public.finalize_student_provisioning(text,uuid,text) is
  'Atomically activates an existing school learner from an authorized shared claim. Requires a current class+school enrollment; parent linking is independent and optional.';

commit;
