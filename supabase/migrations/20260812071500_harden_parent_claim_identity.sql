begin;

create or replace function public.redeem_parent_claim(
  p_code text,
  p_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_code_row student_claim_codes%rowtype;
  v_student students%rowtype;
  v_school_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized_identity';
  end if;

  select * into v_code_row
  from student_claim_codes
  where code = upper(trim(p_code))
    and role = 'parent'
  limit 1
  for update;

  if not found then return 'not_found'; end if;
  if v_code_row.claimed then return 'already_claimed'; end if;
  if v_code_row.expires_at is not null and v_code_row.expires_at < now() then return 'expired'; end if;

  select * into v_student
  from students
  where id = v_code_row.student_id;

  if not found or v_student.deleted_at is not null then return 'student_not_found'; end if;

  select sc.school_id into v_school_id
  from student_classes sc
  where sc.student_id = v_student.id
    and sc.is_current = true
  limit 1;

  insert into parent_student_links (
    parent_id, student_id, school_id,
    relationship, is_primary, can_pickup, receives_alerts
  ) values (
    p_user_id, v_student.id, v_school_id,
    'parent', true, true, true
  ) on conflict (parent_id, student_id, school_id) do nothing;

  if v_school_id is not null then
    insert into school_members (school_id, profile_id, role, joined_at)
    values (v_school_id, p_user_id, 'parent', now())
    on conflict (school_id, profile_id) do nothing;

    update profiles
    set school_id = v_school_id,
        role = case when role is null or role = 'teacher' then 'parent' else role end,
        updated_at = now()
    where id = p_user_id;
  end if;

  update student_claim_codes
  set claimed = true,
      claimed_by = p_user_id,
      claimed_at = coalesce(claimed_at, now())
  where id = v_code_row.id;

  return 'success';
end;
$function$;

revoke execute on function public.redeem_parent_claim(text,uuid) from public, anon;
grant execute on function public.redeem_parent_claim(text,uuid) to authenticated, service_role;
alter function public.redeem_parent_claim(text,uuid) set search_path = public, extensions, pg_temp;

commit;
