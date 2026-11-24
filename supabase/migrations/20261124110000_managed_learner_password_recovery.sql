-- #1984: Guardian-owned password recovery without a school, approval queue,
-- or a parallel auth system. Does not alter learner progress or enrollment.
begin;
alter table public.vs_managed_learners
  add column last_password_reset_at timestamptz,
  add column password_reset_window_started_at timestamptz,
  add column password_reset_window_count integer not null default 0
    check(password_reset_window_count between 0 and 5);

-- SECURITY DEFINER is required to lock an existing guardian-owned child and
-- enforce the per-child recovery budget atomically. It does not grant account
-- access: the existing verified-guardian RPC provides that authority.
create function public.vs_authorize_managed_password_reset(p_identity_id uuid)
returns uuid
language plpgsql security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_learner_user uuid;
  v_record public.vs_managed_learners%rowtype;
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_window_count integer;
begin
  if v_uid is null or p_identity_id is null then
    raise exception 'Verified guardian required' using errcode='42501';
  end if;

  select * into v_record
    from public.vs_managed_learners
   where learner_identity_id=p_identity_id
   for update;

  -- A stale account, revoked relationship, wrong guardian, unverified
  -- guardian email, or non-linked learner can never reset credentials.
  v_learner_user := public.vs_my_managed_student_login(p_identity_id);
  if v_record.learner_identity_id is null or v_record.status<>'linked'
     or v_record.guardian_confirmed_at is null
     or v_record.linked_student_id is null
     or v_learner_user is null then
    raise exception 'Learner is not available to this guardian' using errcode='42501';
  end if;
  if v_record.last_password_reset_at is not null
    and v_record.last_password_reset_at > v_now - interval '15 minutes' then
    raise exception 'Please try again later' using errcode='54000';
  end if;
  v_window_start := v_record.password_reset_window_started_at;
  v_window_count := v_record.password_reset_window_count;
  if v_window_start is null or v_window_start <= v_now - interval '24 hours' then
    v_window_start := v_now;
    v_window_count := 0;
  end if;
  if v_window_count>=5 then
    raise exception 'Daily reset limit reached' using errcode='54000';
  end if;
  update public.vs_managed_learners
     set last_password_reset_at=v_now,
         password_reset_window_started_at=v_window_start,
         password_reset_window_count=v_window_count+1
   where learner_identity_id=p_identity_id;
  return v_learner_user;
end;
$$;
revoke all on function public.vs_authorize_managed_password_reset(uuid)
  from public,anon;
grant execute on function public.vs_authorize_managed_password_reset(uuid)
  to authenticated;
notify pgrst,'reload schema';
commit;
