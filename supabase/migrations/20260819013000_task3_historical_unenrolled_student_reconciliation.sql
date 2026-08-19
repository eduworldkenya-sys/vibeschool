-- Task 3: historical unenrolled learner reconciliation.
-- Deterministic evidence only. Parent creation provenance restores the exact
-- parent relationship; records without authoritative ownership/enrollment proof
-- are quarantined rather than deleted, merged, or assigned to a guessed class.

-- Access: service-only public.student_enrollment_recovery_cases
-- Authorization-test: public.student_enrollment_recovery_cases
create table if not exists public.student_enrollment_recovery_cases (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.students(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check(status in ('open','resolved')),
  evidence jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  check((status='open' and resolved_at is null) or (status='resolved' and resolved_at is not null))
);

alter table public.student_enrollment_recovery_cases enable row level security;
revoke all privileges on table public.student_enrollment_recovery_cases from public,anon,authenticated;
grant all privileges on table public.student_enrollment_recovery_cases to service_role;

-- A parent account recorded as students.created_by is authenticated creation
-- provenance, not a name-based heuristic. Restore only that exact relationship.
insert into public.parent_student_links(
  parent_id,
  student_id,
  school_id,
  relationship,
  is_primary,
  can_pickup,
  receives_alerts,
  access_level
)
select
  s.created_by,
  s.id,
  p.school_id,
  'parent',
  true,
  true,
  true,
  'full'
from public.students s
join public.profiles p
  on p.id=s.created_by
 and p.role='parent'
where s.deleted_at is null
  and not exists(
    select 1 from public.student_classes sc
    where sc.student_id=s.id and sc.is_current=true
  )
  and not exists(
    select 1 from public.parent_student_links psl
    where psl.parent_id=s.created_by and psl.student_id=s.id
  );

-- Quarantine only inactive-context learners with no canonical account, current
-- enrollment, parent relationship, or learning history. This is containment,
-- not a learner merge or deletion.
insert into public.student_enrollment_recovery_cases(student_id,reason,evidence)
select
  s.id,
  'historical_unenrolled_without_authoritative_owner',
  jsonb_build_object(
    'policy','No class/school/parent target is provable; preserve learner and require explicit recovery evidence.',
    'created_by_present',s.created_by is not null,
    'created_at',s.created_at,
    'has_profile',s.profile_id is not null
  )
from public.students s
where s.deleted_at is null
  and s.profile_id is null
  and not exists(select 1 from public.student_classes sc where sc.student_id=s.id and sc.is_current=true)
  and not exists(select 1 from public.parent_student_links psl where psl.student_id=s.id)
  and not exists(select 1 from public.student_learning_events e where e.student_id=s.id)
  and not exists(select 1 from public.attendance a where a.student_id=s.id)
  and not exists(select 1 from public.homework_submissions h where h.student_id=s.id)
  and not exists(select 1 from public.exam_results r where r.student_id=s.id)
  and not exists(select 1 from public.assessment_attempts a where a.student_id=s.id)
on conflict(student_id) do update
set evidence=excluded.evidence,
    detected_at=least(public.student_enrollment_recovery_cases.detected_at,now());

-- Parent-created pre-enrollment learners are now explicitly owned; they remain
-- unenrolled until a legitimate class/school workflow supplies that authority.
-- Every other inert unenrolled learner must be represented in quarantine.
do $block$
declare v_uncontained integer;
begin
  select count(*) into v_uncontained
  from public.students s
  where s.deleted_at is null
    and s.profile_id is null
    and not exists(select 1 from public.student_classes sc where sc.student_id=s.id and sc.is_current=true)
    and not exists(select 1 from public.parent_student_links psl where psl.student_id=s.id)
    and not exists(select 1 from public.student_enrollment_recovery_cases r where r.student_id=s.id and r.status='open')
    and not exists(select 1 from public.student_learning_events e where e.student_id=s.id)
    and not exists(select 1 from public.attendance a where a.student_id=s.id)
    and not exists(select 1 from public.homework_submissions h where h.student_id=s.id)
    and not exists(select 1 from public.exam_results e where e.student_id=s.id)
    and not exists(select 1 from public.assessment_attempts a where a.student_id=s.id);
  if v_uncontained>0 then
    raise exception 'task3_uncontained_unenrolled_learners:%',v_uncontained;
  end if;
end;
$block$;
