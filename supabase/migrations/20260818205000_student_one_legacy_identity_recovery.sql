-- Student = 1 legacy identity recovery closure.
-- Canonical rule: an authenticated student account is product-ready only when it resolves to exactly one active public.students(id).
-- Historical ambiguous accounts are quarantined for claim/recovery; they are never guessed onto roster learners.
-- access: service-only public.student_identity_recovery_cases
-- authorization-test: public.student_identity_recovery_cases

create table if not exists public.student_identity_recovery_cases (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('legacy_missing_canonical_learner','identity_conflict')),
  status text not null default 'open' check (status in ('open','resolved')),
  evidence jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_student_id uuid references public.students(id) on delete restrict,
  check ((status='open' and resolved_at is null and resolved_student_id is null) or
         (status='resolved' and resolved_at is not null and resolved_student_id is not null))
);

alter table public.student_identity_recovery_cases enable row level security;
revoke all privileges on table public.student_identity_recovery_cases from public, anon, authenticated;
grant all privileges on table public.student_identity_recovery_cases to service_role;
create index if not exists student_identity_recovery_cases_status_idx
  on public.student_identity_recovery_cases(status, detected_at desc);

-- Deterministic quarantine of accounts created before atomic learner provisioning.
-- Scope requires all evidence of a school/learner binding to be absent.
insert into public.student_identity_recovery_cases(profile_id,reason,evidence)
select p.id,
       'legacy_missing_canonical_learner',
       jsonb_build_object(
         'profile_created_at',p.created_at,
         'profile_school_id',p.school_id,
         'school_memberships',0,
         'policy','No canonical learner target is provable; require claim/recovery.'
       )
from public.profiles p
where p.role::text='student'
  and p.account_status::text='active'
  and not p.is_anonymized
  and p.created_at < timestamptz '2026-08-16 15:32:38+00'
  and p.school_id is null
  and not exists (select 1 from public.students s where s.profile_id=p.id and s.deleted_at is null)
  and not exists (select 1 from public.school_members sm where sm.profile_id=p.id)
on conflict(profile_id) do nothing;

-- Product onboarding must never call a student profile ready without a canonical learner.
-- Recovery ledger details remain service-only; the client only receives an opaque recovery-required flag.
create or replace function public.get_my_onboarding_state()
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  p public.profiles%rowtype;
  school_count integer:=0;
  class_count integer:=0;
  child_count integer:=0;
  v_student_id uuid;
begin
  select * into p from public.profiles where id=auth.uid();
  if p.id is null then
    return jsonb_build_object('state','profile_missing','next_action','complete_profile');
  end if;

  if p.role='student' then
    select public.current_student_id() into v_student_id;
    if v_student_id is null then
      return jsonb_build_object(
        'state','needs_student_identity',
        'next_action','claim_student',
        'destination','/student/claim',
        'recovery_required',true
      );
    end if;
    return jsonb_build_object('state','ready','next_action','none','destination','/student','student_id',v_student_id);
  end if;

  if p.role='admin' then return jsonb_build_object('state','ready','next_action','none','destination','/admin'); end if;
  if p.role='global_user' then return jsonb_build_object('state','ready','next_action','none','destination','/global'); end if;
  if p.role='teacher' then
    select count(*) into school_count from public.school_members sm where sm.profile_id=p.id;
    select count(*) into class_count from public.teacher_classes tc where tc.teacher_id=p.id and coalesce(tc.is_active,true);
    if school_count=0 then return jsonb_build_object('state','needs_school','next_action','find_school','destination','/teacher/onboarding/school'); end if;
    if class_count=0 then return jsonb_build_object('state','needs_class','next_action','choose_class','destination','/teacher/onboarding/class'); end if;
    return jsonb_build_object('state','ready','next_action','none','destination','/teacher/pulse');
  end if;
  if p.role='parent' then
    select count(*) into child_count from public.parent_student_links psl where psl.parent_id=p.id;
    if child_count=0 then return jsonb_build_object('state','needs_child','next_action','connect_child','destination','/parent/students'); end if;
    return jsonb_build_object('state','ready','next_action','none','destination','/parent');
  end if;
  return jsonb_build_object('state','unknown_role','next_action','contact_support');
end;
$function$;

revoke all on function public.get_my_onboarding_state() from public, anon;
grant execute on function public.get_my_onboarding_state() to authenticated, service_role;

-- Recovery ledger closes automatically once an account is attached to a canonical learner.
create or replace function public.resolve_student_identity_recovery_case()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if new.profile_id is not null and new.deleted_at is null then
    update public.student_identity_recovery_cases
       set status='resolved', resolved_at=now(), resolved_student_id=new.id
     where profile_id=new.profile_id and status='open';
  end if;
  return new;
end;
$function$;

revoke all on function public.resolve_student_identity_recovery_case() from public, anon, authenticated;
grant execute on function public.resolve_student_identity_recovery_case() to service_role;

drop trigger if exists trg_resolve_student_identity_recovery_case on public.students;
create trigger trg_resolve_student_identity_recovery_case
after insert or update of profile_id,deleted_at on public.students
for each row execute function public.resolve_student_identity_recovery_case();

alter table public.student_identity_health_runs
  add column if not exists quarantined_student_profiles integer not null default 0;

-- Health is green when every noncanonical legacy account is explicitly quarantined for recovery.
create or replace function public.run_student_identity_health_check()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $function$
declare
  v_wrong_fk integer:=0;
  v_missing_fk integer:=0;
  v_duplicates integer:=0;
  v_role_mismatch integer:=0;
  v_unquarantined integer:=0;
  v_quarantined integer:=0;
  v_claimed integer:=0;
  v_unclaimed integer:=0;
  v_status text;
  v_id uuid;
begin
  if current_user not in ('postgres','service_role') then raise exception 'service_role_required'; end if;

  with student_cols as (
    select n.nspname schema_name,t.relname table_name,a.attname column_name,t.oid table_oid,a.attnum
    from pg_attribute a
    join pg_class t on t.oid=a.attrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relkind in ('r','p') and a.attname='student_id' and a.attnum>0 and not a.attisdropped
  ), fk_map as (
    select c.table_oid,c.attnum,fn.nspname foreign_schema,ft.relname foreign_table,fa.attname foreign_column
    from student_cols c
    join pg_constraint con on con.conrelid=c.table_oid and con.contype='f' and c.attnum=any(con.conkey)
    join pg_class ft on ft.oid=con.confrelid
    join pg_namespace fn on fn.oid=ft.relnamespace
    join lateral unnest(con.conkey,con.confkey) as k(local_attnum,foreign_attnum) on k.local_attnum=c.attnum
    join pg_attribute fa on fa.attrelid=con.confrelid and fa.attnum=k.foreign_attnum
  )
  select count(*) filter(where f.table_oid is not null and not(f.foreign_schema='public' and f.foreign_table='students' and f.foreign_column='id')),
         count(*) filter(where f.table_oid is null)
    into v_wrong_fk,v_missing_fk
  from student_cols c left join fk_map f on f.table_oid=c.table_oid and f.attnum=c.attnum;

  select count(*) into v_duplicates from (
    select profile_id from public.students where profile_id is not null and deleted_at is null group by profile_id having count(*)>1
  ) d;

  select count(*) into v_role_mismatch
  from public.students s join public.profiles p on p.id=s.profile_id
  where s.deleted_at is null and s.profile_id is not null and p.role::text<>'student';

  select count(*) into v_quarantined
  from public.profiles p
  where p.role::text='student' and p.account_status::text='active' and not p.is_anonymized
    and not exists(select 1 from public.students s where s.profile_id=p.id and s.deleted_at is null)
    and exists(select 1 from public.student_identity_recovery_cases r where r.profile_id=p.id and r.status='open');

  select count(*) into v_unquarantined
  from public.profiles p
  where p.role::text='student' and p.account_status::text='active' and not p.is_anonymized
    and not exists(select 1 from public.students s where s.profile_id=p.id and s.deleted_at is null)
    and not exists(select 1 from public.student_identity_recovery_cases r where r.profile_id=p.id and r.status='open');

  select count(*) filter(where profile_id is not null),count(*) filter(where profile_id is null)
    into v_claimed,v_unclaimed from public.students where deleted_at is null;

  v_status:=case
    when v_wrong_fk>0 or v_missing_fk>0 or v_duplicates>0 or v_role_mismatch>0 or v_unquarantined>0 then 'blocked'
    else 'healthy'
  end;

  insert into public.student_identity_health_runs(
    wrong_student_fk_domains,missing_student_fk_constraints,duplicate_active_profile_mappings,
    active_profile_role_mismatches,active_student_profiles_without_learner,quarantined_student_profiles,
    claimed_active_learners,unclaimed_active_learners,status,details
  ) values(
    v_wrong_fk,v_missing_fk,v_duplicates,v_role_mismatch,v_unquarantined,v_quarantined,v_claimed,v_unclaimed,v_status,
    jsonb_build_object(
      'canonical_rule','public student_id columns must FK to public.students(id)',
      'recovery_rule','Ambiguous legacy student accounts remain active but are routed to canonical claim/recovery and never guessed onto roster learners.',
      'quarantined_legacy_accounts',v_quarantined
    )
  ) returning id into v_id;

  return jsonb_build_object(
    'run_id',v_id,'status',v_status,
    'wrong_student_fk_domains',v_wrong_fk,'missing_student_fk_constraints',v_missing_fk,
    'duplicate_active_profile_mappings',v_duplicates,'active_profile_role_mismatches',v_role_mismatch,
    'active_student_profiles_without_learner',v_unquarantined,'quarantined_student_profiles',v_quarantined,
    'claimed_active_learners',v_claimed,'unclaimed_active_learners',v_unclaimed
  );
end;
$function$;

revoke all on function public.run_student_identity_health_check() from public, anon, authenticated;
grant execute on function public.run_student_identity_health_check() to service_role;

-- Migration-level closure: every active student profile lacking a canonical learner must now have an open recovery case.
do $block$
declare v_bad integer;
begin
  select count(*) into v_bad
  from public.profiles p
  where p.role::text='student' and p.account_status::text='active' and not p.is_anonymized
    and not exists(select 1 from public.students s where s.profile_id=p.id and s.deleted_at is null)
    and not exists(select 1 from public.student_identity_recovery_cases r where r.profile_id=p.id and r.status='open');
  if v_bad>0 then raise exception 'student_one_unquarantined_missing_identity:%',v_bad; end if;
end;
$block$;
