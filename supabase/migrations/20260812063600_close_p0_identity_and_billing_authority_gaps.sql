begin;

-- P0 security boundary: every caller-controlled identity must be bound to auth.uid().
-- This migration also converts school-admin joining into a request flow so a public
-- school identifier cannot grant active admin privileges.

-- -----------------------------------------------------------------------------
-- 1. New-school registration: caller may create a school only for themselves.
-- -----------------------------------------------------------------------------
create or replace function public.create_school_with_admin(
  p_user_id uuid,
  p_full_name text,
  p_school_name text,
  p_subdomain text,
  p_county text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_school_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized_identity';
  end if;

  insert into schools (
    name, subdomain, timezone, status, country_code,
    requires_dual_approval, county, name_normalized
  ) values (
    p_school_name, p_subdomain, 'Africa/Nairobi', 'active', 'KE',
    false, p_county, lower(p_school_name)
  ) returning id into v_school_id;

  insert into profiles (id, full_name, school_id, role)
  values (p_user_id, p_full_name, v_school_id, 'admin')
  on conflict (id) do update set
    full_name = excluded.full_name,
    school_id = excluded.school_id,
    role = 'admin';

  insert into school_members (school_id, profile_id, role, joined_at)
  values (v_school_id, p_user_id, 'admin', now())
  on conflict (school_id, profile_id) do update set role = 'admin';

  return v_school_id;
end;
$function$;

-- -----------------------------------------------------------------------------
-- 2. Existing-school admin registration: NEVER grant admin directly from a
-- public school code. Create a pending request instead.
-- -----------------------------------------------------------------------------
create table if not exists public.school_admin_join_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  requester_name text not null,
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  constraint school_admin_join_requests_status_ck
    check (status in ('pending','approved','rejected')),
  constraint school_admin_join_requests_unique_pending
    unique (school_id, requester_id)
);

create index if not exists idx_school_admin_join_requests_school_status
  on public.school_admin_join_requests (school_id, status, created_at desc);

alter table public.school_admin_join_requests enable row level security;
revoke all on public.school_admin_join_requests from public, anon, authenticated;
grant all on public.school_admin_join_requests to service_role;

create or replace function public.join_school_as_admin(
  p_user_id uuid,
  p_full_name text,
  p_school_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized_identity';
  end if;

  if not exists (
    select 1 from public.schools
    where id = p_school_id
      and status not in ('suspended', 'closed')
  ) then
    raise exception 'invalid_school';
  end if;

  insert into public.school_admin_join_requests (
    school_id, requester_id, requester_name, status
  ) values (
    p_school_id, p_user_id, p_full_name, 'pending'
  )
  on conflict (school_id, requester_id)
  do update set
    requester_name = excluded.requester_name,
    status = case
      when public.school_admin_join_requests.status = 'rejected' then 'pending'
      else public.school_admin_join_requests.status
    end,
    reviewed_by = case
      when public.school_admin_join_requests.status = 'rejected' then null
      else public.school_admin_join_requests.reviewed_by
    end,
    reviewed_at = case
      when public.school_admin_join_requests.status = 'rejected' then null
      else public.school_admin_join_requests.reviewed_at
    end,
    review_note = case
      when public.school_admin_join_requests.status = 'rejected' then null
      else public.school_admin_join_requests.review_note
    end;
end;
$function$;

-- Only an already-authorized school admin/owner can approve the request.
create or replace function public.approve_school_admin_join_request(
  p_request_id uuid,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_school_id uuid;
  v_requester_id uuid;
begin
  select school_id, requester_id
    into v_school_id, v_requester_id
  from public.school_admin_join_requests
  where id = p_request_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'request_not_pending';
  end if;

  if not exists (
    select 1
    from public.school_members
    where school_id = v_school_id
      and profile_id = auth.uid()
      and role in ('admin','owner')
  ) then
    raise exception 'forbidden_school_admin';
  end if;

  update public.profiles
  set school_id = v_school_id,
      role = 'admin',
      updated_at = now()
  where id = v_requester_id;

  insert into public.school_members (school_id, profile_id, role, joined_at)
  values (v_school_id, v_requester_id, 'admin', now())
  on conflict (school_id, profile_id)
  do update set role = 'admin';

  update public.school_admin_join_requests
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = p_review_note
  where id = p_request_id;
end;
$function$;

revoke execute on function public.join_school_as_admin(uuid, text, uuid) from public, anon;
grant execute on function public.join_school_as_admin(uuid, text, uuid) to authenticated, service_role;
revoke execute on function public.approve_school_admin_join_request(uuid, text) from public, anon;
grant execute on function public.approve_school_admin_join_request(uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Teacher onboarding: caller identity and tenant must both come from the
-- authenticated user's established school relationship.
-- -----------------------------------------------------------------------------
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
set search_path = public, pg_temp
as $function$
declare
  v_class_id uuid;
  v_subject_id uuid;
  v_bound_school_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_teacher_id then
    raise exception 'unauthorized_identity';
  end if;

  select coalesce(
    (select tp.school_id from public.teacher_profiles tp where tp.profile_id = auth.uid()),
    (select sm.school_id from public.school_members sm where sm.profile_id = auth.uid() limit 1),
    (select p.school_id from public.profiles p where p.id = auth.uid())
  ) into v_bound_school_id;

  if v_bound_school_id is null or v_bound_school_id <> p_school_id then
    raise exception 'unauthorized_school';
  end if;

  insert into public.school_members (school_id, profile_id, role)
  values (p_school_id, p_teacher_id, 'teacher')
  on conflict (school_id, profile_id) do nothing;

  insert into public.teacher_profiles (profile_id, school_id)
  values (p_teacher_id, p_school_id)
  on conflict (profile_id) do nothing;

  select id into v_subject_id
  from public.subjects
  where school_id = p_school_id and name = p_subject
  limit 1;

  if v_subject_id is null then
    insert into public.subjects (school_id, name)
    values (p_school_id, p_subject)
    returning id into v_subject_id;
  end if;

  select id into v_class_id
  from public.classes
  where school_id = p_school_id
    and name = p_grade
    and coalesce(stream, '') = coalesce(p_stream, '')
  limit 1;

  if v_class_id is null then
    insert into public.classes (school_id, teacher_id, name, stream, subject)
    values (p_school_id, p_teacher_id, p_grade, nullif(p_stream, ''), p_subject)
    returning id into v_class_id;
  end if;

  insert into public.teacher_classes (school_id, teacher_id, class_id, subject_id, is_class_teacher)
  values (p_school_id, p_teacher_id, v_class_id, v_subject_id, true)
  on conflict do nothing;

  return v_class_id;
end;
$function$;

-- -----------------------------------------------------------------------------
-- 4. Billing: direct credit minting must never be a client-callable operation.
-- Spending is self-bound to auth.uid().
-- -----------------------------------------------------------------------------
revoke execute on function public.purchase_credits(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.purchase_credits(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.purchase_credits(uuid, integer, text) to service_role;
grant execute on function public.purchase_credits(uuid, uuid, text) to service_role;

create or replace function public.spend_credit(
  p_teacher_id uuid,
  p_feature text,
  p_amount integer,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_balance integer;
begin
  if auth.uid() is null or auth.uid() <> p_teacher_id then
    raise exception 'unauthorized_identity';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_credit_amount';
  end if;

  perform public.hq_assert_product_enabled('billing','billing.enabled');

  select coalesce(sum(amount),0)
    into v_balance
  from public.vibe_credit_transactions
  where teacher_id = auth.uid();

  if v_balance < p_amount then
    return jsonb_build_object('success',false,'error','insufficient_credits','balance',v_balance);
  end if;

  v_balance := v_balance - p_amount;

  insert into public.vibe_credit_transactions(
    teacher_id,type,feature,amount,balance_after,notes
  ) values (
    auth.uid(),'spend',p_feature,-p_amount,v_balance,p_notes
  );

  return jsonb_build_object('success',true,'balance',v_balance);
end;
$function$;

revoke execute on function public.spend_credit(uuid, text, integer, text) from public, anon;
grant execute on function public.spend_credit(uuid, text, integer, text) to authenticated, service_role;

-- Explicitly keep hardened search paths on all affected functions.
alter function public.create_school_with_admin(uuid, text, text, text, text) set search_path = public, pg_temp;
alter function public.join_school_as_admin(uuid, text, uuid) set search_path = public, pg_temp;
alter function public.onboard_teacher_class(uuid, uuid, text, text, text) set search_path = public, pg_temp;
alter function public.spend_credit(uuid, text, integer, text) set search_path = public, pg_temp;

commit;
