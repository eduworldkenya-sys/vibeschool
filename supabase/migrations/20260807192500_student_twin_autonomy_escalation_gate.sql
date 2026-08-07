-- TWIN-AUTONOMY-007 minimum production gate.
-- Sensitive learner chat text is deliberately NOT stored. The event records only
-- category/severity and routes a private support notification to assigned teachers.

create table if not exists public.student_twin_escalations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  category text not null check (category in ('self_harm_welfare','safeguarding','immediate_danger','specialist_support','high_stakes')),
  severity text not null check (severity in ('high','urgent')),
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  source text not null default 'student_twin' check (source = 'student_twin'),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);

alter table public.student_twin_escalations enable row level security;

revoke all on table public.student_twin_escalations from public, anon;
grant select on table public.student_twin_escalations to authenticated;

create policy "assigned teachers can read twin escalations"
on public.student_twin_escalations
for select
to authenticated
using (
  exists (
    select 1
    from public.teacher_classes tc
    where tc.teacher_id = (select auth.uid())
      and tc.class_id = student_twin_escalations.class_id
      and (student_twin_escalations.school_id is null or tc.school_id = student_twin_escalations.school_id)
  )
);

create or replace function public.student_create_twin_escalation(
  p_category text,
  p_severity text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_class_id uuid;
  v_school_id uuid;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_category not in ('self_harm_welfare','safeguarding','immediate_danger','specialist_support','high_stakes') then
    raise exception 'invalid_escalation_category';
  end if;
  if p_severity not in ('high','urgent') then
    raise exception 'invalid_escalation_severity';
  end if;

  select s.id, coalesce(sc.class_id, s.class_id), sc.school_id
    into v_student_id, v_class_id, v_school_id
  from public.students s
  left join public.student_classes sc
    on sc.student_id = s.id and sc.is_current = true
  where s.profile_id = v_uid and s.deleted_at is null
  order by sc.joined_at desc nulls last
  limit 1;

  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;

  if v_school_id is null and v_class_id is not null then
    select c.school_id into v_school_id from public.classes c where c.id = v_class_id;
  end if;

  insert into public.student_twin_escalations(student_id, school_id, class_id, category, severity)
  values(v_student_id, v_school_id, v_class_id, p_category, p_severity)
  returning id into v_id;

  insert into public.notifications(school_id, user_id, title, body, type, related_id)
  select distinct
    tc.school_id,
    tc.teacher_id,
    case when p_severity = 'urgent' then 'Urgent learner support needed' else 'Learner support needed' end,
    'A learner in your assigned class asked VibeTwin for support that requires a human. Please follow up privately.',
    'general',
    v_id
  from public.teacher_classes tc
  where tc.class_id = v_class_id
    and (v_school_id is null or tc.school_id = v_school_id);

  return v_id;
end;
$function$;

revoke all on function public.student_create_twin_escalation(text,text) from public, anon;
grant execute on function public.student_create_twin_escalation(text,text) to authenticated;
