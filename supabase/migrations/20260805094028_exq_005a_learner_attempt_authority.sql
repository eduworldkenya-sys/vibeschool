begin;

alter table public.assessment_attempts
  add column if not exists expires_at timestamptz null,
  add column if not exists locked_at timestamptz null,
  add column if not exists lock_reason text null;

alter table public.assessment_attempts
  drop constraint if exists assessment_attempts_lock_reason_chk,
  add constraint assessment_attempts_lock_reason_chk
    check (lock_reason is null or lock_reason in ('submitted','time_expired','assignment_closed','teacher_closed')),
  drop constraint if exists assessment_attempts_lock_state_chk,
  add constraint assessment_attempts_lock_state_chk
    check ((locked_at is null and lock_reason is null) or (locked_at is not null and lock_reason is not null));

create index if not exists assessment_attempts_expiry_idx
  on public.assessment_attempts(status,expires_at)
  where status='in_progress' and expires_at is not null;

create or replace function public.exq_list_my_assignments()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller uuid:=auth.uid();
  learner public.students%rowtype;
  payload jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select s.* into learner from public.students s where s.profile_id=caller limit 1;
  if not found then raise exception 'learner_identity_not_found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id',aa.id,
    'assessment_id',ad.id,
    'title',ad.title,
    'assessment_type',ad.assessment_type,
    'instructions',ad.instructions,
    'assignment_status',aa.status,
    'opens_at',aa.opens_at,
    'closes_at',aa.closes_at,
    'time_limit_minutes',aa.time_limit_minutes,
    'max_attempts',aa.max_attempts,
    'show_score_policy',aa.show_score_policy,
    'attempt_id',at.id,
    'attempt_number',at.attempt_number,
    'attempt_status',at.status,
    'attempt_expires_at',at.expires_at,
    'result_status',at.result_status,
    'score',case when aa.show_score_policy='immediate' or at.result_status='released' then at.score else null end,
    'max_score',case when aa.show_score_policy='immediate' or at.result_status='released' then at.max_score else null end,
    'percentage',case when aa.show_score_policy='immediate' or at.result_status='released' then at.percentage else null end,
    'submitted_at',at.submitted_at,
    'can_start',(
      aa.status in ('assigned','open')
      and (aa.opens_at is null or aa.opens_at<=now())
      and (aa.closes_at is null or aa.closes_at>now())
      and (at.id is null or at.status='in_progress' or at.attempt_number<aa.max_attempts)
    ),
    'availability',case
      when aa.opens_at is not null and aa.opens_at>now() then 'upcoming'
      when aa.closes_at is not null and aa.closes_at<=now() then 'closed'
      when aa.status='closed' then 'closed'
      when at.status='in_progress' then 'in_progress'
      when at.id is not null and at.attempt_number>=aa.max_attempts then 'attempts_exhausted'
      else 'available'
    end
  ) order by
    case when aa.closes_at is null then 1 else 0 end,
    aa.closes_at asc nulls last,
    aa.created_at desc),'[]'::jsonb)
  into payload
  from public.assessment_assignments aa
  join public.assessment_definitions ad on ad.id=aa.assessment_id
  join public.student_classes sc
    on sc.class_id=aa.class_id
   and sc.student_id=learner.id
   and sc.is_current=true
   and sc.school_id=aa.school_id
  left join lateral (
    select a.*
    from public.assessment_attempts a
    where a.assignment_id=aa.id and a.student_id=learner.id
    order by a.attempt_number desc
    limit 1
  ) at on true
  where aa.status in ('assigned','open','closed')
    and (aa.target_group_id is null or exists (
      select 1
      from public.class_group_members cgm
      where cgm.group_id=aa.target_group_id and cgm.student_id=learner.id
    ));

  return jsonb_build_object('ok',true,'assignments',payload);
end;
$$;

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

  select * into ad
  from public.assessment_definitions
  where id=aa.assessment_id and status='published';
  if not found then raise exception 'assessment_not_published'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',ai.id,'question_type',ai.question_type,'prompt',ai.prompt,'options',ai.options,
    'marks',ai.marks,'order_num',ai.order_num,'media',ai.media,'hint',ai.hint
  ) order by ai.order_num),'[]'::jsonb)
  into item_payload
  from public.assessment_items ai
  where ai.assessment_id=aa.assessment_id and ai.status='approved';

  select coalesce(jsonb_agg(jsonb_build_object(
    'assessment_item_id',ar.assessment_item_id,'response_value',ar.response_value,
    'response_text',ar.response_text,'status',ar.status,'last_saved_at',ar.last_saved_at
  )),'[]'::jsonb)
  into response_payload
  from public.assessment_responses ar
  where ar.attempt_id=new_attempt.id;

  return jsonb_build_object(
    'ok',true,'attempt_id',new_attempt.id,'attempt_number',new_attempt.attempt_number,
    'assessment_id',ad.id,'assessment_type',ad.assessment_type,'title',ad.title,
    'instructions',ad.instructions,'time_limit_minutes',aa.time_limit_minutes,
    'expires_at',new_attempt.expires_at,'closes_at',aa.closes_at,
    'show_score_policy',aa.show_score_policy,'items',item_payload,'responses',response_payload
  );
end;
$$;

create or replace function public.exq_save_response(
  p_attempt_id uuid,
  p_assessment_item_id uuid,
  p_response_value jsonb default 'null'::jsonb,
  p_response_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller uuid:=auth.uid();
  at public.assessment_attempts%rowtype;
  ai public.assessment_items%rowtype;
  learner_id uuid;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select s.id into learner_id from public.students s where s.profile_id=caller limit 1;
  if learner_id is null then raise exception 'learner_identity_not_found'; end if;

  select * into at from public.assessment_attempts where id=p_attempt_id for update;
  if not found then raise exception 'attempt_not_found'; end if;
  if at.student_id is distinct from learner_id then raise exception 'attempt_not_owned'; end if;
  if at.status<>'in_progress' then raise exception 'attempt_locked'; end if;
  if at.expires_at is not null and at.expires_at<=now() then
    update public.assessment_attempts
    set status='submitted',submitted_at=coalesce(submitted_at,now()),locked_at=now(),lock_reason='time_expired',updated_at=now()
    where id=at.id;
    raise exception 'attempt_time_expired';
  end if;

  select * into ai
  from public.assessment_items
  where id=p_assessment_item_id and assessment_id=at.assessment_id and status='approved';
  if not found then raise exception 'assessment_item_not_found'; end if;

  insert into public.assessment_responses(
    attempt_id,assessment_item_id,response_value,response_text,status,max_score,last_saved_at,updated_at
  ) values (
    at.id,ai.id,coalesce(p_response_value,'null'::jsonb),p_response_text,'saved',ai.marks,now(),now()
  )
  on conflict (attempt_id,assessment_item_id)
  do update set
    response_value=excluded.response_value,
    response_text=excluded.response_text,
    status='saved',
    last_saved_at=now(),
    updated_at=now();

  update public.assessment_attempts
  set last_saved_at=now(),updated_at=now()
  where id=at.id;

  return jsonb_build_object(
    'ok',true,'attempt_id',at.id,'assessment_item_id',ai.id,
    'saved_at',now(),'expires_at',at.expires_at
  );
end;
$$;

create or replace function public.exq_submit_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller uuid:=auth.uid();
  at public.assessment_attempts%rowtype;
  aa public.assessment_assignments%rowtype;
  learner_id uuid;
  item_rec record;
  response_rec public.assessment_responses%rowtype;
  awarded numeric;
  auto_result jsonb;
  total_awarded numeric:=0;
  total_max numeric:=0;
  manual_count integer:=0;
  final_status text;
  final_result_status text;
  pct numeric;
  tolerance numeric;
  expired boolean:=false;
  reveal_score boolean:=false;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select s.id into learner_id from public.students s where s.profile_id=caller limit 1;
  if learner_id is null then raise exception 'learner_identity_not_found'; end if;

  select * into at from public.assessment_attempts where id=p_attempt_id for update;
  if not found then raise exception 'attempt_not_found'; end if;
  if at.student_id is distinct from learner_id then raise exception 'attempt_not_owned'; end if;
  if at.status<>'in_progress' then raise exception 'attempt_already_submitted'; end if;

  select * into aa from public.assessment_assignments where id=at.assignment_id;
  expired:=at.expires_at is not null and at.expires_at<=now();

  for item_rec in
    select ai.*
    from public.assessment_items ai
    where ai.assessment_id=at.assessment_id and ai.status='approved'
    order by ai.order_num
  loop
    total_max:=total_max+item_rec.marks;

    select * into response_rec
    from public.assessment_responses ar
    where ar.attempt_id=at.id and ar.assessment_item_id=item_rec.id;

    if not found then
      insert into public.assessment_responses(
        attempt_id,assessment_item_id,response_value,status,max_score,submitted_at
      ) values (
        at.id,item_rec.id,'null'::jsonb,'submitted',item_rec.marks,now()
      ) returning * into response_rec;
    end if;

    awarded:=null;
    auto_result:=null;

    if item_rec.auto_marking_mode='option_match' then
      awarded:=case when response_rec.response_value=item_rec.correct_answer then item_rec.marks else 0 end;
    elsif item_rec.auto_marking_mode='exact' then
      awarded:=case when coalesce(response_rec.response_text,'')=coalesce(item_rec.correct_answer#>>'{}','') then item_rec.marks else 0 end;
    elsif item_rec.auto_marking_mode='case_insensitive' then
      awarded:=case when lower(btrim(coalesce(response_rec.response_text,'')))=lower(btrim(coalesce(item_rec.correct_answer#>>'{}',''))) then item_rec.marks else 0 end;
    elsif item_rec.auto_marking_mode='numeric_tolerance' then
      tolerance:=coalesce((item_rec.marking_guide->>'tolerance')::numeric,0);
      begin
        awarded:=case when abs((response_rec.response_text)::numeric-(item_rec.correct_answer#>>'{}')::numeric)<=tolerance then item_rec.marks else 0 end;
      exception when others then
        awarded:=0;
      end;
    elsif item_rec.auto_marking_mode in ('set_match','ordered_match') then
      awarded:=case when response_rec.response_value=item_rec.correct_answer then item_rec.marks else 0 end;
    else
      manual_count:=manual_count+1;
    end if;

    if awarded is not null then
      auto_result:=jsonb_build_object(
        'mode',item_rec.auto_marking_mode,
        'awarded',awarded,
        'max',item_rec.marks
      );
      total_awarded:=total_awarded+awarded;
      update public.assessment_responses
      set status='auto_marked',auto_score=awarded,final_score=awarded,
          auto_mark_result=auto_result,submitted_at=now(),updated_at=now()
      where id=response_rec.id;
    else
      update public.assessment_responses
      set status='teacher_review',submitted_at=now(),updated_at=now()
      where id=response_rec.id;
    end if;
  end loop;

  pct:=case when total_max>0 then round((total_awarded/total_max)*100,3) else 0 end;
  final_status:=case when manual_count=0 then 'auto_marked' else 'teacher_review' end;
  final_result_status:=case when manual_count=0 then 'marked' else 'partially_marked' end;
  reveal_score:=aa.show_score_policy='immediate' and manual_count=0;

  update public.assessment_attempts
  set status=final_status,
      result_status=final_result_status,
      submitted_at=now(),
      auto_marked_at=case when manual_count=0 then now() else auto_marked_at end,
      score=total_awarded,
      max_score=total_max,
      percentage=pct,
      last_saved_at=now(),
      locked_at=now(),
      lock_reason=case when expired then 'time_expired' else 'submitted' end,
      updated_at=now()
  where id=at.id;

  return jsonb_build_object(
    'ok',true,
    'attempt_id',at.id,
    'status',final_status,
    'result_status',final_result_status,
    'score',case when reveal_score then total_awarded else null end,
    'max_score',case when reveal_score then total_max else null end,
    'percentage',case when reveal_score then pct else null end,
    'score_released',reveal_score,
    'manual_items',manual_count,
    'submitted_due_to_expiry',expired
  );
end;
$$;

revoke all on function public.exq_list_my_assignments() from public,anon;
revoke all on function public.exq_start_or_resume_attempt(uuid) from public,anon;
revoke all on function public.exq_save_response(uuid,uuid,jsonb,text) from public,anon;
revoke all on function public.exq_submit_attempt(uuid) from public,anon;

grant execute on function public.exq_list_my_assignments() to authenticated,service_role;
grant execute on function public.exq_start_or_resume_attempt(uuid) to authenticated,service_role;
grant execute on function public.exq_save_response(uuid,uuid,jsonb,text) to authenticated,service_role;
grant execute on function public.exq_submit_attempt(uuid) to authenticated,service_role;

commit;
