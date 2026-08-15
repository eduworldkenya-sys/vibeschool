begin;

-- A shared claim is one credential with two independent redemption lanes.
-- Do not overload the legacy `claimed` bit: doing so lets the first claimant
-- consume the credential for the other intended claimant.
alter table public.students
  add column if not exists self_use_enabled boolean not null default false;

alter table public.student_claim_codes
  add column if not exists student_claimed_by uuid references auth.users(id) on delete set null,
  add column if not exists student_claimed_at timestamptz,
  add column if not exists parent_claimed_by uuid references auth.users(id) on delete set null,
  add column if not exists parent_claimed_at timestamptz;

-- Existing single-role claims are reconciled into their matching lane before
-- all active teacher-issued credentials use role=shared.
update public.student_claim_codes
set student_claimed_by = coalesce(student_claimed_by, claimed_by),
    student_claimed_at = coalesce(student_claimed_at, claimed_at, created_at)
where role = 'student' and claimed = true;

update public.student_claim_codes
set parent_claimed_by = coalesce(parent_claimed_by, claimed_by),
    parent_claimed_at = coalesce(parent_claimed_at, claimed_at, created_at)
where role = 'parent' and claimed = true;

update public.student_claim_codes
set role = 'shared'
where role in ('student','parent');

create or replace function public.parent_set_student_self_use(
  p_student_id uuid,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1
    from public.parent_student_links psl
    where psl.parent_id = auth.uid()
      and psl.student_id = p_student_id
  ) then
    raise exception 'parent_student_link_required';
  end if;

  update public.students
  set self_use_enabled = p_enabled
  where id = p_student_id
    and deleted_at is null;

  if not found then
    raise exception 'student_not_found';
  end if;

  return p_enabled;
end;
$function$;

revoke execute on function public.parent_set_student_self_use(uuid, boolean) from public, anon;
grant execute on function public.parent_set_student_self_use(uuid, boolean) to authenticated;

create or replace function public.redeem_parent_claim(
  p_code text,
  p_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_code_row public.student_claim_codes%rowtype;
  v_student public.students%rowtype;
  v_school_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized_identity';
  end if;

  select * into v_code_row
  from public.student_claim_codes
  where code = upper(trim(p_code))
    and role = 'shared'
  limit 1
  for update;

  if not found then return 'not_found'; end if;
  if v_code_row.expires_at is not null and v_code_row.expires_at < now() then return 'expired'; end if;

  -- Idempotent for the same parent, fail closed for a second parent account.
  if v_code_row.parent_claimed_by = p_user_id then return 'success'; end if;
  if v_code_row.parent_claimed_by is not null then return 'already_claimed'; end if;

  select * into v_student
  from public.students
  where id = v_code_row.student_id
    and deleted_at is null;

  if not found then return 'student_not_found'; end if;

  select sc.school_id into v_school_id
  from public.student_classes sc
  where sc.student_id = v_student.id
    and sc.is_current = true
  limit 1;

  if v_school_id is null then
    select c.school_id into v_school_id
    from public.classes c
    where c.id = v_student.class_id;
  end if;

  if v_school_id is null then return 'student_not_found'; end if;

  insert into public.parent_student_links (
    parent_id, student_id, school_id, relationship, is_primary, can_pickup, receives_alerts
  ) values (
    p_user_id, v_student.id, v_school_id, 'parent', true, true, true
  ) on conflict (parent_id, student_id, school_id) do nothing;

  insert into public.school_members (school_id, profile_id, role, joined_at)
  values (v_school_id, p_user_id, 'parent', now())
  on conflict (school_id, profile_id) do nothing;

  -- Preserve an existing teacher/admin/student identity. A claim adds the
  -- family relationship; it must not silently rewrite another primary role.
  update public.profiles
  set school_id = coalesce(school_id, v_school_id),
      role = coalesce(role, 'parent'),
      updated_at = now()
  where id = p_user_id;

  update public.student_claim_codes
  set parent_claimed_by = p_user_id,
      parent_claimed_at = now(),
      claimed = (student_claimed_by is not null),
      claimed_by = case when student_claimed_by is not null then coalesce(claimed_by, p_user_id) else claimed_by end,
      claimed_at = case when student_claimed_by is not null then coalesce(claimed_at, now()) else claimed_at end
  where id = v_code_row.id;

  return 'success';
end;
$function$;

revoke execute on function public.redeem_parent_claim(text, uuid) from public, anon;
grant execute on function public.redeem_parent_claim(text, uuid) to authenticated, service_role;

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
  v_row public.student_claim_codes%rowtype;
  v_student public.students%rowtype;
  v_school public.schools%rowtype;
  v_class_name text;
  v_grade integer;
  v_slug text;
  v_school_id uuid;
  v_user_id uuid := coalesce(p_user_id, auth.uid());
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if auth.uid() is null or auth.uid() <> v_user_id then raise exception 'unauthorized_identity'; end if;

  select * into v_row
  from public.student_claim_codes
  where code = upper(trim(p_code))
    and role = 'shared'
  limit 1
  for update;

  if not found then return jsonb_build_object('status','not_found'); end if;
  if v_row.expires_at is not null and v_row.expires_at < now() then return jsonb_build_object('status','expired'); end if;
  if v_row.student_claimed_by = v_user_id then return jsonb_build_object('status','success','student_id',v_row.student_id); end if;
  if v_row.student_claimed_by is not null then return jsonb_build_object('status','already_claimed'); end if;

  select * into v_student
  from public.students
  where id = v_row.student_id
    and deleted_at is null;

  if not found then return jsonb_build_object('status','student_not_found'); end if;

  -- Never let one authenticated account take over two learner identities.
  if exists (select 1 from public.students s where s.profile_id = v_user_id and s.id <> v_student.id and s.deleted_at is null) then
    raise exception 'identity_already_bound';
  end if;
  if v_student.profile_id is not null and v_student.profile_id <> v_user_id then
    return jsonb_build_object('status','already_claimed');
  end if;

  select c.name, c.school_id into v_class_name, v_school_id
  from public.classes c
  where c.id = v_student.class_id;

  if v_school_id is null then
    select sc.school_id into v_school_id
    from public.student_classes sc
    where sc.student_id = v_student.id and sc.is_current = true
    limit 1;
  end if;

  select * into v_school from public.schools where id = v_school_id;
  if v_school_id is null or not found then return jsonb_build_object('status','school_not_found'); end if;

  -- Grades below 6 require an already-linked parent to opt in. Unknown class
  -- labels fail closed rather than guessing that a child may self-activate.
  if v_class_name is not null and v_class_name ~* '(grade|class)[[:space:]]*[0-9]+' then
    v_grade := substring(v_class_name from '(?i)(?:grade|class)[[:space:]]*([0-9]+)')::integer;
  else
    v_grade := null;
  end if;

  if (v_grade is null or v_grade < 6) and not v_student.self_use_enabled then
    return jsonb_build_object('status','below_grade_requires_parent_opt_in');
  end if;

  v_slug := lower(regexp_replace(coalesce(v_school.subdomain, v_school.id::text), '[^a-z0-9]', '', 'g'));
  if v_slug = '' then v_slug := 'vs'; end if;

  update public.students set profile_id = v_user_id where id = v_student.id;

  update public.profiles
  set role = 'student', school_id = v_school_id, updated_at = now()
  where id = v_user_id;

  insert into public.school_members (school_id, profile_id, role)
  values (v_school_id, v_user_id, 'student')
  on conflict (school_id, profile_id) do update set role = 'student';

  update public.student_claim_codes
  set student_claimed_by = v_user_id,
      student_claimed_at = now(),
      claimed = (parent_claimed_by is not null),
      claimed_by = case when parent_claimed_by is not null then coalesce(claimed_by, v_user_id) else claimed_by end,
      claimed_at = case when parent_claimed_by is not null then coalesce(claimed_at, now()) else claimed_at end
  where id = v_row.id;

  return jsonb_build_object(
    'status','success',
    'admission_number',coalesce(v_student.admission_number,v_student.id::text),
    'school_code',v_slug,
    'student_id',v_student.id
  );
end;
$function$;

revoke execute on function public.redeem_student_claim(text, uuid) from public, anon;
grant execute on function public.redeem_student_claim(text, uuid) to authenticated, service_role;

commit;
