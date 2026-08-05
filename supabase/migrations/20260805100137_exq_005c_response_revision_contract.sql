begin;

create or replace function public.exq_start_or_resume_attempt(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
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
    select 1 from public.class_group_members cgm
    where cgm.group_id=aa.target_group_id and cgm.student_id=student_row.id
  ) then raise exception 'learner_not_in_target_group'; end if;

  select * into existing_attempt
  from public.assessment_attempts
  where assignment_id=aa.id and student_id=student_row.id and status='in_progress'
  limit 1 for update;

  if found then
    if existing_attempt.expires_at is not null and existing_attempt.expires_at<=now() then
      update public.assessment_attempts
      set status='submitted',submitted_at=coalesce(submitted_at,now()),locked_at=now(),lock_reason='time_expired',updated_at=now()
      where id=existing_attempt.id;
      raise exception 'attempt_time_expired';
    end if;
    new_attempt:=existing_attempt;
  else
    select coalesce(max(attempt_number),0)+1 into next_attempt
    from public.assessment_attempts
    where assignment_id=aa.id and student_id=student_row.id;
    if next_attempt>aa.max_attempts then raise exception 'attempt_limit_reached'; end if;

    resolved_expires_at:=case
      when aa.time_limit_minutes is null then aa.closes_at
      when aa.closes_at is null then now()+make_interval(mins=>aa.time_limit_minutes)
      else least(aa.closes_at,now()+make_interval(mins=>aa.time_limit_minutes))
    end;

    insert into public.assessment_attempts(
      assignment_id,assessment_id,student_id,school_id,class_id,attempt_number,status,expires_at
    ) values (
      aa.id,aa.assessment_id,student_row.id,aa.school_id,aa.class_id,next_attempt,'in_progress',resolved_expires_at
    ) returning * into new_attempt;
  end if;

  select * into ad from public.assessment_definitions where id=aa.assessment_id and status='published';
  if not found then raise exception 'assessment_not_published'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',ai.id,'question_type',ai.question_type,'prompt',ai.prompt,'options',ai.options,
    'marks',ai.marks,'order_num',ai.order_num,'media',ai.media,'hint',ai.hint
  ) order by ai.order_num),'[]'::jsonb)
  into item_payload
  from public.assessment_items ai
  where ai.assessment_id=aa.assessment_id and ai.status='approved';

  select coalesce(jsonb_agg(jsonb_build_object(
    'assessment_item_id',ar.assessment_item_id,
    'response_value',ar.response_value,
    'response_text',ar.response_text,
    'status',ar.status,
    'revision',ar.revision,
    'client_updated_at',ar.client_updated_at,
    'last_saved_at',ar.last_saved_at
  )),'[]'::jsonb)
  into response_payload
  from public.assessment_responses ar where ar.attempt_id=new_attempt.id;

  return jsonb_build_object(
    'ok',true,'attempt_id',new_attempt.id,'attempt_number',new_attempt.attempt_number,
    'assessment_id',ad.id,'assessment_type',ad.assessment_type,'title',ad.title,
    'instructions',ad.instructions,'time_limit_minutes',aa.time_limit_minutes,
    'expires_at',new_attempt.expires_at,'closes_at',aa.closes_at,
    'show_score_policy',aa.show_score_policy,'items',item_payload,'responses',response_payload
  );
end;
$$;

revoke all on function public.exq_start_or_resume_attempt(uuid) from public,anon;
grant execute on function public.exq_start_or_resume_attempt(uuid) to authenticated,service_role;

commit;
