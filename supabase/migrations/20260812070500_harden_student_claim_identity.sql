begin;

-- Historical production schema contains claimed_at, but the replayable baseline
-- predates that column. Establish the column before any function references it
-- so blank-database rebuilds and upgraded databases converge on one shape.
alter table public.student_claim_codes
  add column if not exists claimed_at timestamptz;

create or replace function public.redeem_student_claim(
  p_code text,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_row student_claim_codes%rowtype;
  v_student students%rowtype;
  v_school schools%rowtype;
  v_slug text;
  v_school_id uuid;
  v_user_id uuid := coalesce(p_user_id, auth.uid());
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if auth.uid() is null or auth.uid() <> v_user_id then
    raise exception 'unauthorized_identity';
  end if;

  select * into v_row
  from student_claim_codes
  where code = upper(trim(p_code))
    and role = 'student'
  limit 1
  for update;

  if not found then
    return jsonb_build_object('status','not_found');
  end if;

  if v_row.claimed then
    return jsonb_build_object('status','already_claimed');
  end if;

  if v_row.expires_at is not null and v_row.expires_at < now() then
    return jsonb_build_object('status','expired');
  end if;

  select * into v_student
  from students
  where id = v_row.student_id
  limit 1;

  if not found or v_student.deleted_at is not null then
    return jsonb_build_object('status','student_not_found');
  end if;

  select school_id into v_school_id
  from classes
  where id = v_student.class_id
  limit 1;

  select * into v_school
  from schools
  where id = v_school_id
  limit 1;

  if v_school_id is null or not found then
    return jsonb_build_object('status','school_not_found');
  end if;

  v_slug := lower(regexp_replace(coalesce(v_school.subdomain, v_school.id::text), '[^a-z0-9]', '', 'g'));
  if v_slug = '' then v_slug := 'vs'; end if;

  -- The lookup-only branch is retained for compatibility, but it never grants
  -- identity. The authenticated branch below performs the actual binding.
  update student_claim_codes
  set claimed = true,
      claimed_at = now()
  where id = v_row.id;

  update students
  set profile_id = v_user_id
  where id = v_student.id;

  update profiles
  set role = 'student',
      school_id = v_school_id,
      updated_at = now()
  where id = v_user_id;

  insert into school_members (school_id, profile_id, role)
  values (v_school_id, v_user_id, 'student')
  on conflict (school_id, profile_id) do update set role = 'student';

  return jsonb_build_object(
    'status','success',
    'admission_number',coalesce(v_student.admission_number,v_student.id::text),
    'school_code',v_slug,
    'student_id',v_student.id
  );
end;
$function$;

revoke execute on function public.redeem_student_claim(text,uuid) from public,anon;
grant execute on function public.redeem_student_claim(text,uuid) to authenticated,service_role;
alter function public.redeem_student_claim(text,uuid) set search_path = public, pg_temp;

commit;
