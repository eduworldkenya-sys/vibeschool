-- VibeSchool Task 6: Parent claim codes establish a family relationship only.
-- They must not silently grant pickup authority, fabricate a primary guardian,
-- or destroy an existing professional/student account role.
-- authorization-test: public.redeem_parent_claim
-- authorization-test: public.parent_student_links

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
  v_code_row public.student_claim_codes%rowtype;
  v_student public.students%rowtype;
  v_school_id uuid;
  v_existing_link_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized_identity';
  end if;

  select * into v_code_row
  from public.student_claim_codes
  where code = upper(trim(p_code))
    and role = 'parent'
  limit 1
  for update;

  if not found then return 'not_found'; end if;
  if v_code_row.claimed then return 'already_claimed'; end if;
  if v_code_row.expires_at is not null and v_code_row.expires_at < now() then return 'expired'; end if;

  select * into v_student
  from public.students
  where id = v_code_row.student_id;

  if not found or v_student.deleted_at is not null then return 'student_not_found'; end if;

  select sc.school_id into v_school_id
  from public.student_classes sc
  where sc.student_id = v_student.id
    and sc.is_current = true
  order by sc.created_at desc nulls last
  limit 1;

  -- A fresh school-issued parent code is sufficient evidence to restore the
  -- same parent's revoked link, but it is not evidence of pickup permission or
  -- of being the learner's primary guardian.
  select psl.id into v_existing_link_id
  from public.parent_student_links psl
  where psl.parent_id = p_user_id
    and psl.student_id = v_student.id
  order by psl.created_at desc
  limit 1
  for update;

  if v_existing_link_id is not null then
    update public.parent_student_links
    set school_id = coalesce(v_school_id, school_id),
        access_level = 'full',
        receives_alerts = true,
        updated_at = now()
    where id = v_existing_link_id;
  else
    insert into public.parent_student_links (
      parent_id,
      student_id,
      school_id,
      relationship,
      is_primary,
      can_pickup,
      receives_alerts,
      access_level
    ) values (
      p_user_id,
      v_student.id,
      v_school_id,
      'parent',
      false,
      false,
      true,
      'full'
    );
  end if;

  if v_school_id is not null then
    insert into public.school_members (school_id, profile_id, role, joined_at)
    values (v_school_id, p_user_id, 'parent', now())
    on conflict (school_id, profile_id) do nothing;

    update public.profiles
    set school_id = coalesce(school_id, v_school_id),
        role = case when role is null then 'parent' else role end,
        updated_at = now()
    where id = p_user_id;
  end if;

  update public.student_claim_codes
  set claimed = true,
      claimed_by = p_user_id,
      claimed_at = coalesce(claimed_at, now())
  where id = v_code_row.id;

  return case when v_existing_link_id is null then 'success' else 'already_linked' end;
end;
$function$;

revoke all on function public.redeem_parent_claim(text,uuid) from public, anon;
grant execute on function public.redeem_parent_claim(text,uuid) to authenticated, service_role;

comment on function public.redeem_parent_claim(text,uuid) is
  'Redeems a one-time parent-role claim code for the authenticated account. Establishes/reactivates only the parent-student relationship; pickup/primary-guardian authority remains separately verified and existing account roles are preserved.';

commit;
