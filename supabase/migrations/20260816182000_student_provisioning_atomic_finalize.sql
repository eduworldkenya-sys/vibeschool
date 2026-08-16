begin;

create or replace function public.finalize_student_provisioning(
  p_code text,
  p_user_id uuid,
  p_full_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_row public.student_claim_codes%rowtype;
  v_student public.students%rowtype;
  v_school_id uuid;
  v_parent_linked boolean;
  v_profile_role text;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'service_role_required';
  end if;
  if p_user_id is null then raise exception 'user_id_required'; end if;
  if nullif(btrim(p_full_name),'') is null then raise exception 'full_name_required'; end if;

  select * into v_row
  from public.student_claim_codes
  where code = upper(trim(p_code)) and role = 'student'
  limit 1
  for update;

  if not found then return jsonb_build_object('status','not_found'); end if;

  select * into v_student
  from public.students
  where id = v_row.student_id
  limit 1
  for update;

  if not found or v_student.deleted_at is not null then
    return jsonb_build_object('status','student_not_found');
  end if;

  if v_student.profile_id = p_user_id and v_row.claimed then
    return jsonb_build_object('status','success','student_id',v_student.id,'replayed',true);
  end if;

  if v_row.claimed or v_student.profile_id is not null then
    return jsonb_build_object('status','already_claimed');
  end if;

  if v_row.expires_at is not null and v_row.expires_at < now() then
    return jsonb_build_object('status','expired');
  end if;

  v_parent_linked := v_student.parent_linked_at is not null and exists (
    select 1 from public.parent_student_links psl where psl.student_id = v_student.id
  );
  if not v_parent_linked then
    return jsonb_build_object('status','guardian_required');
  end if;

  select c.school_id into v_school_id
  from public.classes c
  where c.id = v_student.class_id;
  if v_school_id is null then return jsonb_build_object('status','school_not_found'); end if;

  select p.role::text into v_profile_role
  from public.profiles p
  where p.id = p_user_id
  for update;
  if not found then return jsonb_build_object('status','profile_missing'); end if;
  if v_profile_role is not null and v_profile_role <> 'student' then
    return jsonb_build_object('status','profile_role_conflict');
  end if;

  update public.students
  set profile_id = p_user_id
  where id = v_student.id and profile_id is null;
  if not found then return jsonb_build_object('status','already_claimed'); end if;

  update public.profiles
  set role = 'student', school_id = v_school_id, full_name = btrim(p_full_name), updated_at = now()
  where id = p_user_id;

  insert into public.school_members(school_id, profile_id, role)
  values(v_school_id, p_user_id, 'student')
  on conflict(school_id, profile_id) do update set role = excluded.role;

  update public.student_claim_codes
  set claimed = true,
      claimed_at = coalesce(claimed_at, now()),
      claimed_by = coalesce(claimed_by, p_user_id),
      student_claimed_at = coalesce(student_claimed_at, now()),
      student_claimed_by = coalesce(student_claimed_by, p_user_id)
  where id = v_row.id and claimed = false;
  if not found then raise exception 'claim_concurrency_conflict'; end if;

  return jsonb_build_object('status','success','student_id',v_student.id,'replayed',false);
end;
$function$;

revoke execute on function public.finalize_student_provisioning(text,uuid,text) from public,anon,authenticated;
grant execute on function public.finalize_student_provisioning(text,uuid,text) to service_role;

commit;
