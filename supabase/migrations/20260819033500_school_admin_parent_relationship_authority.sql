-- Task 7: school-bound parent relationship administration.
-- Admin never links an arbitrary parent UUID to a learner. Instead an authorized
-- Admin issues a short-lived claim code for a learner currently enrolled in the
-- administered school. Parent self-redemption remains identity-bound to auth.uid().

create or replace function public.admin_generate_parent_claim(
  p_school_id uuid,
  p_student_id uuid
)
returns table (claim_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
  v_expires timestamptz := now() + interval '7 days';
  v_attempt integer := 0;
begin
  if auth.uid() is null or not public.is_school_admin(p_school_id) then
    raise exception 'school_admin_required' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.student_classes sc
    join public.students s on s.id = sc.student_id and s.deleted_at is null
    where sc.school_id = p_school_id
      and sc.student_id = p_student_id
      and sc.is_current = true
  ) then
    raise exception 'student_not_currently_enrolled_in_school' using errcode = '42501';
  end if;

  update public.student_claim_codes
  set expires_at = least(expires_at, now())
  where student_id = p_student_id
    and role = 'parent'
    and parent_claimed_at is null
    and expires_at > now();

  loop
    v_attempt := v_attempt + 1;
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.student_claim_codes (
        student_id, code, claimed, expires_at, role
      ) values (
        p_student_id, v_code, false, v_expires, 'parent'
      );
      exit;
    exception when unique_violation then
      if v_attempt >= 5 then raise; end if;
    end;
  end loop;

  return query select v_code, v_expires;
end;
$$;

revoke all on function public.admin_generate_parent_claim(uuid,uuid) from public, anon;
grant execute on function public.admin_generate_parent_claim(uuid,uuid) to authenticated, service_role;

create or replace function public.admin_revoke_parent_relationship(
  p_school_id uuid,
  p_student_id uuid,
  p_parent_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_school_admin(p_school_id) then
    raise exception 'school_admin_required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.student_classes sc
    where sc.school_id = p_school_id
      and sc.student_id = p_student_id
      and sc.is_current = true
  ) then
    raise exception 'student_not_currently_enrolled_in_school' using errcode = '42501';
  end if;

  update public.parent_student_links
  set access_level = 'none',
      receives_alerts = false,
      can_pickup = false,
      updated_at = clock_timestamp()
  where school_id = p_school_id
    and student_id = p_student_id
    and parent_id = p_parent_id;
end;
$$;

revoke all on function public.admin_revoke_parent_relationship(uuid,uuid,uuid) from public, anon;
grant execute on function public.admin_revoke_parent_relationship(uuid,uuid,uuid) to authenticated, service_role;
