-- Harden formal student assessment lifecycle and curriculum evidence authority.

create table if not exists public.assessment_attempt_audit_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  assignment_id uuid not null references public.assessment_assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  event_type text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  client_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint assessment_attempt_audit_event_type_chk check (event_type = any(array[
    'started','resumed','client_claimed','client_takeover','response_saved','response_conflict','submitted','expired_submit','released'
  ]))
);

create index if not exists assessment_attempt_audit_events_attempt_created_idx
  on public.assessment_attempt_audit_events(attempt_id, created_at desc);
create index if not exists assessment_attempt_audit_events_student_created_idx
  on public.assessment_attempt_audit_events(student_id, created_at desc);

alter table public.assessment_attempt_audit_events enable row level security;

revoke all on public.assessment_attempt_audit_events from anon, public;
grant select on public.assessment_attempt_audit_events to authenticated;

create policy assessment_attempt_audit_events_learner_read
on public.assessment_attempt_audit_events
for select
to authenticated
using (exists (
  select 1 from public.students s
  where s.id = assessment_attempt_audit_events.student_id
    and s.profile_id = auth.uid()
));

create or replace function public.exq_approve_assessment(p_assessment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  caller uuid := auth.uid();
  ad public.assessment_definitions%rowtype;
  item_count integer;
  total numeric;
  unlinked_count integer;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into ad from public.assessment_definitions where id = p_assessment_id for update;
  if not found then raise exception 'assessment_not_found'; end if;
  if ad.teacher_id is distinct from caller then raise exception 'assessment_not_owned'; end if;
  if ad.status not in ('draft','review') then raise exception 'invalid_assessment_state'; end if;

  select count(*),coalesce(sum(marks),0) into item_count,total
  from public.assessment_items
  where assessment_id = p_assessment_id and status <> 'retired';
  if item_count = 0 then raise exception 'assessment_has_no_items'; end if;

  if ad.assessment_type in ('quiz','test','exam','diagnostic') then
    select count(*) into unlinked_count
    from public.assessment_items ai
    where ai.assessment_id=p_assessment_id
      and ai.status <> 'retired'
      and not exists (
        select 1 from public.assessment_item_outcomes aio
        where aio.assessment_item_id=ai.id
      );
    if unlinked_count > 0 then
      raise exception 'assessment_items_missing_outcome_links:%', unlinked_count;
    end if;
  end if;

  update public.assessment_items
  set status='approved',teacher_approved_at=now(),updated_at=now()
  where assessment_id=p_assessment_id and status='draft';

  update public.assessment_definitions
  set status='approved',approved_by=caller,approved_at=now(),total_marks=total,updated_at=now()
  where id=p_assessment_id;

  return jsonb_build_object('ok',true,'assessment_id',p_assessment_id,'item_count',item_count,'total_marks',total,'outcome_links_required',ad.assessment_type in ('quiz','test','exam','diagnostic'));
end;
$function$;

create or replace function public.exq_assign_assessment(
  p_assessment_id uuid,
  p_class_id uuid,
  p_target_group_id uuid default null,
  p_opens_at timestamptz default null,
  p_closes_at timestamptz default null,
  p_time_limit_minutes integer default null,
  p_max_attempts integer default 1,
  p_randomize_items boolean default false,
  p_randomize_options boolean default false,
  p_show_score_policy text default 'after_review'
)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  caller uuid:=auth.uid();
  ad public.assessment_definitions%rowtype;
  iv public.assessment_interventions%rowtype;
  result_id uuid;
  assignment_status text;
  resolved_group uuid:=p_target_group_id;
  unlinked_count integer;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into ad from public.assessment_definitions where id=p_assessment_id for update;
  if not found then raise exception 'assessment_not_found'; end if;
  if ad.teacher_id is distinct from caller then raise exception 'assessment_not_owned'; end if;
  if ad.status<>'approved' then raise exception 'assessment_not_approved'; end if;
  if ad.class_id is not null and ad.class_id is distinct from p_class_id then raise exception 'assessment_class_mismatch'; end if;
  if not exists (
    select 1 from public.teacher_classes tc
    where tc.teacher_id=caller and tc.school_id=ad.school_id and tc.class_id=p_class_id and tc.subject_id=ad.subject_id
  ) then raise exception 'teacher_not_assigned'; end if;

  if ad.assessment_type in ('quiz','test','exam','diagnostic') then
    select count(*) into unlinked_count
    from public.assessment_items ai
    where ai.assessment_id=p_assessment_id
      and ai.status='approved'
      and not exists (
        select 1 from public.assessment_item_outcomes aio where aio.assessment_item_id=ai.id
      );
    if unlinked_count > 0 then raise exception 'assessment_items_missing_outcome_links:%', unlinked_count; end if;
  end if;

  if ad.intervention_id is not null then
    select * into iv from public.assessment_interventions where id=ad.intervention_id for update;
    if not found then raise exception 'intervention_not_found'; end if;
    if iv.teacher_id is distinct from caller or iv.class_id is distinct from p_class_id then raise exception 'intervention_mismatch'; end if;
    if iv.status in ('completed','dismissed') then raise exception 'intervention_closed'; end if;
    resolved_group:=iv.intervention_group_id;
    if resolved_group is null then
      insert into public.class_groups(class_id,name,type,color)
      values(iv.class_id,'Intervention '||left(iv.id::text,8),'intervention','#dc2626')
      returning id into resolved_group;
      insert into public.class_group_members(group_id,student_id)
      values(resolved_group,iv.student_id) on conflict do nothing;
      update public.assessment_interventions set intervention_group_id=resolved_group,updated_at=now() where id=iv.id;
    elsif not exists(select 1 from public.class_group_members where group_id=resolved_group and student_id=iv.student_id) then
      insert into public.class_group_members(group_id,student_id) values(resolved_group,iv.student_id) on conflict do nothing;
    end if;
  elsif resolved_group is not null and not exists (
    select 1 from public.class_groups cg where cg.id=resolved_group and cg.class_id=p_class_id
  ) then raise exception 'target_group_mismatch'; end if;

  assignment_status:=case when p_opens_at is null or p_opens_at<=now() then 'open' else 'assigned' end;

  insert into public.assessment_assignments(
    assessment_id,school_id,class_id,teacher_id,target_group_id,status,opens_at,closes_at,
    time_limit_minutes,max_attempts,randomize_items,randomize_options,show_score_policy,
    assigned_at,intervention_id
  ) values (
    p_assessment_id,ad.school_id,p_class_id,caller,resolved_group,assignment_status,p_opens_at,p_closes_at,
    p_time_limit_minutes,p_max_attempts,p_randomize_items,p_randomize_options,p_show_score_policy,
    now(),ad.intervention_id
  ) returning id into result_id;

  update public.assessment_definitions
  set status=case when assignment_status='open' then 'open' else 'assigned' end,
      published_at=coalesce(published_at,now()),updated_at=now()
  where id=p_assessment_id;

  if ad.intervention_id is not null then
    update public.assessment_interventions
    set remedial_assignment_id=result_id,status='in_progress',updated_at=now()
    where id=ad.intervention_id;
  end if;

  return result_id;
end;
$function$;

create or replace function public.exq_start_or_resume_attempt(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  caller uuid:=auth.uid();
  aa public.assessment_assignments%rowtype;
  ad public.assessment_definitions%rowtype;
  student_row public.students%rowtype;
  existing_attempt public.assessment_attempts%rowtype;
  new_attempt public.assessment_attempts%rowtype;
  next_attempt integer;
  resolved_expires_at timestamptz;
  item_payload jsonb;
  response_payload jsonb;
  was_resume boolean:=false;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into aa from public.assessment_assignments where id=p_assignment_id for update;
  if not found then raise exception 'assignment_not_found'; end if;
  if aa.status not in ('assigned','open') then raise exception 'assignment_not_open'; end if;
  if aa.opens_at is not null and aa.opens_at>now() then raise exception 'assignment_not_open_yet'; end if;
  if aa.closes_at is not null and aa.closes_at<=now() then raise exception 'assignment_closed'; end if;

  select s.* into student_row
  from public.students s
  join public.student_classes sc on sc.student_id=s.id and sc.is_current=true
  where s.profile_id=caller and sc.class_id=aa.class_id and sc.school_id=aa.school_id
  limit 1;
  if not found then raise exception 'learner_not_in_class'; end if;
  if aa.target_group_id is not null and not exists (
    select 1 from public.class_group_members cgm where cgm.group_id=aa.target_group_id and cgm.student_id=student_row.id
  ) then raise exception 'learner_not_in_target_group'; end if;

  select * into existing_attempt
  from public.assessment_attempts
  where assignment_id=aa.id and student_id=student_row.id and status='in_progress'
  limit 1 for update;

  if found then
    was_resume:=true;
    if existing_attempt.expires_at is not null and existing_attempt.expires_at<=now() then
      update public.assessment_attempts
      set status='submitted',submitted_at=coalesce(submitted_at,now()),locked_at=now(),lock_reason='time_expired',updated_at=now()
      where id=existing_attempt.id;
      insert into public.assessment_attempt_audit_events(attempt_id,assignment_id,student_id,school_id,class_id,event_type,actor_profile_id,metadata)
      values(existing_attempt.id,aa.id,student_row.id,aa.school_id,aa.class_id,'expired_submit',caller,jsonb_build_object('source','resume_guard'));
      raise exception 'attempt_time_expired';
    end if;
    new_attempt:=existing_attempt;
  else
    select coalesce(max(attempt_number),0)+1 into next_attempt
    from public.assessment_attempts where assignment_id=aa.id and student_id=student_row.id;
    if next_attempt>aa.max_attempts then raise exception 'attempt_limit_reached'; end if;
    resolved_expires_at:=case
      when aa.time_limit_minutes is null then aa.closes_at
      when aa.closes_at is null then now()+make_interval(mins=>aa.time_limit_minutes)
      else least(aa.closes_at,now()+make_interval(mins=>aa.time_limit_minutes))
    end;
    insert into public.assessment_attempts(assignment_id,assessment_id,student_id,school_id,class_id,attempt_number,status,expires_at)
    values(aa.id,aa.assessment_id,student_row.id,aa.school_id,aa.class_id,next_attempt,'in_progress',resolved_expires_at)
    returning * into new_attempt;
    insert into public.assessment_attempt_audit_events(attempt_id,assignment_id,student_id,school_id,class_id,event_type,actor_profile_id,metadata)
    values(new_attempt.id,aa.id,student_row.id,aa.school_id,aa.class_id,'started',caller,jsonb_build_object('attempt_number',new_attempt.attempt_number,'expires_at',new_attempt.expires_at));
  end if;

  select * into ad
  from public.assessment_definitions
  where id=aa.assessment_id and status in ('assigned','open','closed');
  if not found then raise exception 'assessment_not_published'; end if;

  if was_resume then
    insert into public.assessment_attempt_audit_events(attempt_id,assignment_id,student_id,school_id,class_id,event_type,actor_profile_id,metadata)
    values(new_attempt.id,aa.id,student_row.id,aa.school_id,aa.class_id,'resumed',caller,'{}'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',ai.id,'question_type',ai.question_type,'prompt',ai.prompt,'options',ai.options,
    'marks',ai.marks,'order_num',ai.order_num,'media',ai.media,'hint',ai.hint
  ) order by ai.order_num),'[]'::jsonb)
  into item_payload
  from public.assessment_items ai where ai.assessment_id=aa.assessment_id and ai.status='approved';

  select coalesce(jsonb_agg(jsonb_build_object(
    'assessment_item_id',ar.assessment_item_id,'response_value',ar.response_value,'response_text',ar.response_text,
    'status',ar.status,'revision',ar.revision,'client_updated_at',ar.client_updated_at,'last_saved_at',ar.last_saved_at
  )),'[]'::jsonb)
  into response_payload from public.assessment_responses ar where ar.attempt_id=new_attempt.id;

  return jsonb_build_object(
    'ok',true,'attempt_id',new_attempt.id,'attempt_number',new_attempt.attempt_number,
    'assessment_id',ad.id,'assessment_type',ad.assessment_type,'title',ad.title,
    'instructions',ad.instructions,'time_limit_minutes',aa.time_limit_minutes,
    'expires_at',new_attempt.expires_at,'closes_at',aa.closes_at,
    'show_score_policy',aa.show_score_policy,'items',item_payload,'responses',response_payload
  );
end;
$function$;

revoke all on function public.exq_approve_assessment(uuid) from anon, public;
revoke all on function public.exq_assign_assessment(uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,boolean,boolean,text) from anon, public;
revoke all on function public.exq_start_or_resume_attempt(uuid) from anon, public;
grant execute on function public.exq_approve_assessment(uuid) to authenticated;
grant execute on function public.exq_assign_assessment(uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,boolean,boolean,text) to authenticated;
grant execute on function public.exq_start_or_resume_attempt(uuid) to authenticated;
