begin;

-- Task 6 reconciliation after Task 1 identity-role guards.
-- A Parent claim may establish/reactivate only a verified family relationship.
-- It must not convert another established role, accept a student-only code,
-- or silently grant primary-guardian / pickup authority.
create or replace function public.redeem_parent_claim(
  p_code text,
  p_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_code_row public.student_claim_codes%rowtype;
  v_student public.students%rowtype;
  v_school_id uuid;
  v_existing_link_id uuid;
  v_role text;
  v_status text;
  v_anonymized boolean;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized_identity' using errcode='42501';
  end if;

  select p.role::text, p.account_status::text, coalesce(p.is_anonymized, false)
    into v_role, v_status, v_anonymized
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found
     or v_role is distinct from 'parent'
     or v_status is distinct from 'active'
     or v_anonymized then
    raise exception 'parent_authority_required' using errcode='42501';
  end if;

  select * into v_code_row
  from public.student_claim_codes
  where code = upper(trim(p_code))
    and role in ('parent', 'shared')
  limit 1
  for update;

  if not found then return 'not_found'; end if;
  if v_code_row.parent_claimed_at is not null then return 'already_claimed'; end if;
  if v_code_row.expires_at is not null and v_code_row.expires_at < now() then return 'expired'; end if;

  select * into v_student
  from public.students
  where id = v_code_row.student_id
  for update;

  if not found or v_student.deleted_at is not null then return 'student_not_found'; end if;

  select sc.school_id into v_school_id
  from public.student_classes sc
  where sc.student_id = v_student.id
    and sc.is_current = true
  order by sc.created_at desc nulls last
  limit 1;

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
        updated_at = now()
    where id = p_user_id;
  end if;

  update public.student_claim_codes
  set parent_claimed_at = now(),
      parent_claimed_by = p_user_id,
      claimed = true,
      claimed_by = coalesce(claimed_by, p_user_id),
      claimed_at = coalesce(claimed_at, now())
  where id = v_code_row.id;

  return case when v_existing_link_id is null then 'success' else 'already_linked' end;
end;
$function$;

revoke all on function public.redeem_parent_claim(text,uuid)
  from public, anon, service_role;
grant execute on function public.redeem_parent_claim(text,uuid) to authenticated;

comment on function public.redeem_parent_claim(text,uuid) is
  'Parent-only/shared-code relationship redemption. Requires an active Parent identity; never grants pickup/primary authority or rewrites account role.';

commit;
