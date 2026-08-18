-- Task 3: Canonical Student Identity & Data Integrity
-- Canonical invariant: every public student_id is public.students(id).
-- This migration closes provisioning retry/concurrency gaps, prevents conflicting
-- current enrollment, hardens teacher relationship proof, and quarantines
-- ambiguous reused admission identifiers without guessing learner merges.

create table if not exists public.student_provisioning_receipts (
  actor_id uuid not null references public.profiles(id) on delete cascade,
  operation text not null check (operation in ('teacher_add_student','admin_add_student','parent_create_child')),
  payload_hash text not null,
  student_id uuid not null references public.students(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (actor_id, operation, payload_hash)
);

alter table public.student_provisioning_receipts enable row level security;
revoke all privileges on table public.student_provisioning_receipts from public, anon, authenticated;
grant all privileges on table public.student_provisioning_receipts to service_role;

create index if not exists student_provisioning_receipts_student_idx
  on public.student_provisioning_receipts(student_id);

create table if not exists public.student_external_identifier_conflicts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  namespace text not null check (namespace in ('admission_number')),
  normalized_value text not null,
  student_ids uuid[] not null,
  status text not null default 'open' check (status in ('open','resolved')),
  evidence jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (school_id, namespace, normalized_value),
  check (cardinality(student_ids) >= 2),
  check ((status='open' and resolved_at is null) or (status='resolved' and resolved_at is not null))
);

alter table public.student_external_identifier_conflicts enable row level security;
revoke all privileges on table public.student_external_identifier_conflicts from public, anon, authenticated;
grant all privileges on table public.student_external_identifier_conflicts to service_role;

-- Preserve historical ambiguity. Same-school reused admission numbers are not
-- treated as learner-merge evidence; they are quarantined for explicit review.
insert into public.student_external_identifier_conflicts(
  school_id, namespace, normalized_value, student_ids, evidence
)
select
  sc.school_id,
  'admission_number',
  lower(trim(s.admission_number)),
  array_agg(s.id order by s.created_at nulls last, s.id),
  jsonb_build_object(
    'policy','Reused admission identifiers are conflicts, not automatic learner merge evidence.',
    'source','current student_classes + students.admission_number',
    'detected_by','task3_student_identity_provisioning_integrity'
  )
from public.students s
join public.student_classes sc
  on sc.student_id=s.id and sc.is_current=true
where s.deleted_at is null
  and nullif(trim(s.admission_number),'') is not null
group by sc.school_id, lower(trim(s.admission_number))
having count(*) > 1
on conflict (school_id, namespace, normalized_value) do update
set student_ids=excluded.student_ids,
    evidence=excluded.evidence,
    detected_at=least(public.student_external_identifier_conflicts.detected_at, now());

-- A learner may have only one current class/school enrollment platform-wide.
-- Historical rows remain represented by is_current=false + left_at.
create unique index if not exists students_one_current_enrollment_uidx
  on public.student_classes(student_id)
  where is_current=true;

-- Parent retries must not manufacture duplicate pending relationship requests.
create unique index if not exists class_join_requests_one_pending_uidx
  on public.class_join_requests(student_id,class_id,parent_id)
  where status='pending';

-- Teacher authority requires both canonical assignment and live teacher school membership.
create or replace function public.is_teacher_of_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.student_classes sc
    join public.teacher_classes tc
      on tc.class_id=sc.class_id
     and tc.school_id=sc.school_id
    join public.school_members sm
      on sm.profile_id=tc.teacher_id
     and sm.school_id=tc.school_id
     and sm.role='teacher'
    where sc.student_id=p_student_id
      and sc.is_current=true
      and tc.teacher_id=auth.uid()
  );
$function$;

revoke all on function public.is_teacher_of_student(uuid) from public, anon;
grant execute on function public.is_teacher_of_student(uuid) to authenticated, service_role;

-- Teacher/admin roster creation is idempotent on the strongest identifier the
-- existing contract supplies: same-school admission number. The receipt is what
-- makes a retry return the exact same canonical learner; an older conflicting
-- admission identifier fails closed rather than guessing which learner is meant.
create or replace function public.teacher_add_student(
  p_name text,
  p_admission_number text default null,
  p_class_id uuid default null,
  p_school_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_student_id uuid;
  v_uid uuid := auth.uid();
  v_role text;
  v_admission text := nullif(lower(trim(p_admission_number)), '');
  v_payload_hash text;
  v_conflicts integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_school_id is null then raise exception 'school_required'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'student_name_required'; end if;
  if v_admission is null then raise exception 'admission_identifier_required_for_retry_safe_provisioning'; end if;

  select sm.role into v_role
  from public.school_members sm
  where sm.school_id=p_school_id
    and sm.profile_id=v_uid
    and sm.role in ('teacher','admin','owner')
  limit 1;
  if v_role is null then raise exception 'not_authorized'; end if;

  if p_class_id is not null then
    if not exists(select 1 from public.classes c where c.id=p_class_id and c.school_id=p_school_id) then
      raise exception 'class_school_mismatch';
    end if;
    if v_role='teacher' and not exists(
      select 1 from public.teacher_classes tc
      where tc.teacher_id=v_uid and tc.school_id=p_school_id and tc.class_id=p_class_id
    ) then
      raise exception 'teacher_not_assigned_to_class';
    end if;
  end if;

  v_payload_hash := md5(jsonb_build_object(
    'school_id',p_school_id,'class_id',p_class_id,'name',trim(p_name),'admission',v_admission
  )::text);

  perform pg_advisory_xact_lock(hashtextextended(
    v_uid::text || ':teacher_add_student:' || p_school_id::text || ':' || v_admission, 0
  ));

  select r.student_id into v_student_id
  from public.student_provisioning_receipts r
  where r.actor_id=v_uid and r.operation='teacher_add_student' and r.payload_hash=v_payload_hash;
  if v_student_id is not null then return v_student_id; end if;

  select count(*) into v_conflicts
  from public.students s
  join public.student_classes sc on sc.student_id=s.id and sc.is_current=true
  where sc.school_id=p_school_id
    and s.deleted_at is null
    and lower(trim(s.admission_number))=v_admission;
  if v_conflicts > 0 then raise exception 'admission_identifier_conflict'; end if;

  insert into public.students(name,admission_number,class_id,created_by)
  values(trim(p_name),trim(p_admission_number),p_class_id,v_uid)
  returning id into v_student_id;

  if p_class_id is not null then
    insert into public.student_classes(student_id,class_id,school_id,is_current,joined_at)
    values(v_student_id,p_class_id,p_school_id,true,now());
  end if;

  insert into public.student_claim_codes(student_id,code,claimed,role)
  values(v_student_id,upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),false,'both');

  insert into public.student_provisioning_receipts(actor_id,operation,payload_hash,student_id)
  values(v_uid,'teacher_add_student',v_payload_hash,v_student_id);

  return v_student_id;
end;
$function$;

revoke all on function public.teacher_add_student(text,text,uuid,uuid) from public, anon;
grant execute on function public.teacher_add_student(text,text,uuid,uuid) to authenticated, service_role;

create or replace function public.admin_add_student(
  p_name text,
  p_admission_number text,
  p_gender text,
  p_date_of_birth text,
  p_class_id uuid,
  p_school_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_student_id uuid;
  v_uid uuid := auth.uid();
  v_admission text := nullif(lower(trim(p_admission_number)), '');
  v_payload_hash text;
  v_conflicts integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_school_id is null or not public.is_school_admin(p_school_id) then raise exception 'not_authorized'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'student_name_required'; end if;
  if v_admission is null then raise exception 'admission_identifier_required_for_retry_safe_provisioning'; end if;
  if p_class_id is not null and not exists(select 1 from public.classes where id=p_class_id and school_id=p_school_id) then
    raise exception 'class_school_mismatch';
  end if;

  v_payload_hash := md5(jsonb_build_object(
    'school_id',p_school_id,'class_id',p_class_id,'name',trim(p_name),'admission',v_admission,
    'gender',p_gender,'date_of_birth',p_date_of_birth
  )::text);

  perform pg_advisory_xact_lock(hashtextextended(
    v_uid::text || ':admin_add_student:' || p_school_id::text || ':' || v_admission, 0
  ));

  select r.student_id into v_student_id
  from public.student_provisioning_receipts r
  where r.actor_id=v_uid and r.operation='admin_add_student' and r.payload_hash=v_payload_hash;
  if v_student_id is not null then return v_student_id; end if;

  select count(*) into v_conflicts
  from public.students s
  join public.student_classes sc on sc.student_id=s.id and sc.is_current=true
  where sc.school_id=p_school_id
    and s.deleted_at is null
    and lower(trim(s.admission_number))=v_admission;
  if v_conflicts > 0 then raise exception 'admission_identifier_conflict'; end if;

  insert into public.students(name,admission_number,gender,date_of_birth,class_id,created_by)
  values(
    trim(p_name),trim(p_admission_number),nullif(trim(p_gender),''),
    case when nullif(trim(p_date_of_birth),'') is null then null else p_date_of_birth::date end,
    p_class_id,v_uid
  ) returning id into v_student_id;

  if p_class_id is not null then
    insert into public.student_classes(student_id,class_id,school_id,joined_at,is_current)
    values(v_student_id,p_class_id,p_school_id,now(),true);
  end if;

  insert into public.student_provisioning_receipts(actor_id,operation,payload_hash,student_id)
  values(v_uid,'admin_add_student',v_payload_hash,v_student_id);

  return v_student_id;
end;
$function$;

revoke all on function public.admin_add_student(text,text,text,text,uuid,uuid) from public, anon;
grant execute on function public.admin_add_student(text,text,text,text,uuid,uuid) to authenticated, service_role;

-- Parent child creation is retry-safe on the exact parent+child request payload.
-- Crucially, selecting a class creates no current enrollment. The existing UI
-- sends a class_join_request separately, and teacher approval is the authority
-- transition that may create the current student_classes relationship.
create or replace function public.create_child_for_parent(
  p_name text,
  p_dob date,
  p_class_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_student_id uuid;
  v_user_id uuid := auth.uid();
  v_school_id uuid;
  v_profile_school_id uuid;
  v_role text;
  v_payload_hash text;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'student_name_required'; end if;
  if p_dob is null then raise exception 'student_date_of_birth_required'; end if;

  select role,school_id into v_role,v_profile_school_id from public.profiles where id=v_user_id;
  if coalesce(v_role,'') <> 'parent' and not public.is_platform_owner() then
    raise exception 'parent_identity_required';
  end if;

  if p_class_id is not null then
    select c.school_id into v_school_id from public.classes c where c.id=p_class_id;
    if v_school_id is null then raise exception 'class_not_found'; end if;
    if v_profile_school_id is distinct from v_school_id
       and not exists(
         select 1 from public.school_members sm
         where sm.school_id=v_school_id and sm.profile_id=v_user_id and sm.role='parent'
       ) then
      raise exception 'parent_school_mismatch';
    end if;
  end if;

  v_payload_hash := md5(jsonb_build_object(
    'parent_id',v_user_id,'name',trim(p_name),'dob',p_dob,'class_id',p_class_id
  )::text);

  perform pg_advisory_xact_lock(hashtextextended(
    v_user_id::text || ':parent_create_child:' || v_payload_hash, 0
  ));

  select r.student_id into v_student_id
  from public.student_provisioning_receipts r
  where r.actor_id=v_user_id and r.operation='parent_create_child' and r.payload_hash=v_payload_hash;
  if v_student_id is not null then return v_student_id; end if;

  insert into public.students(name,date_of_birth,class_id,created_by)
  values(trim(p_name),p_dob,null,v_user_id)
  returning id into v_student_id;

  insert into public.parent_student_links(
    parent_id,student_id,school_id,relationship,is_primary,can_pickup,receives_alerts
  ) values(v_user_id,v_student_id,v_school_id,'parent',true,true,true)
  on conflict(parent_id,student_id,school_id) do nothing;

  insert into public.student_provisioning_receipts(actor_id,operation,payload_hash,student_id)
  values(v_user_id,'parent_create_child',v_payload_hash,v_student_id);

  return v_student_id;
end;
$function$;

revoke all on function public.create_child_for_parent(text,date,uuid) from public, anon;
grant execute on function public.create_child_for_parent(text,date,uuid) to authenticated, service_role;

-- Fail closed if the migration would leave a structurally ambiguous current enrollment.
do $block$
declare
  v_bad integer;
begin
  select count(*) into v_bad
  from (
    select student_id from public.student_classes where is_current=true group by student_id having count(*)>1
  ) d;
  if v_bad > 0 then raise exception 'task3_multiple_current_enrollments:%',v_bad; end if;

  select count(*) into v_bad
  from public.student_classes sc
  join public.classes c on c.id=sc.class_id
  where sc.is_current=true and c.school_id<>sc.school_id;
  if v_bad > 0 then raise exception 'task3_current_enrollment_school_mismatch:%',v_bad; end if;
end;
$block$;
