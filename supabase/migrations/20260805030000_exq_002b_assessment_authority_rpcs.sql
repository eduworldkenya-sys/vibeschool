begin;

create or replace function public.exq_create_draft_assessment(
  p_class_id uuid,
  p_subject_id uuid,
  p_assessment_type text,
  p_title text,
  p_description text default null,
  p_instructions text default null,
  p_lesson_plan_id uuid default null,
  p_teaching_occurrence_id uuid default null,
  p_source_resource_id uuid default null,
  p_generation_source text default 'teacher_authored',
  p_generation_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  resolved_school uuid;
  result_id uuid;
  lp public.lesson_plans%rowtype;
  occ public.teaching_occurrences%rowtype;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if btrim(coalesce(p_title,'')) = '' then raise exception 'title_required'; end if;

  select tc.school_id into resolved_school
  from public.teacher_classes tc
  where tc.teacher_id = caller
    and tc.class_id = p_class_id
    and tc.subject_id = p_subject_id
  limit 1;

  if resolved_school is null then raise exception 'teacher_not_assigned'; end if;

  if p_lesson_plan_id is not null then
    select * into lp from public.lesson_plans where id = p_lesson_plan_id;
    if not found then raise exception 'lesson_plan_not_found'; end if;
    if lp.teacher_id is distinct from caller
       or lp.class_id is distinct from p_class_id
       or lp.subject_id is distinct from p_subject_id
    then raise exception 'lesson_plan_mismatch'; end if;
  end if;

  if p_teaching_occurrence_id is not null then
    select * into occ from public.teaching_occurrences where id = p_teaching_occurrence_id;
    if not found then raise exception 'occurrence_not_found'; end if;
    if occ.teacher_id is distinct from caller
       or occ.school_id is distinct from resolved_school
       or occ.class_id is distinct from p_class_id
       or occ.subject_id is distinct from p_subject_id
    then raise exception 'occurrence_mismatch'; end if;
    if p_lesson_plan_id is not null and (
      lp.timetable_slot_id is distinct from occ.timetable_slot_id
      or lp.taught_date is distinct from occ.occurrence_date
    ) then raise exception 'lesson_occurrence_mismatch'; end if;
  end if;

  insert into public.assessment_definitions(
    school_id,teacher_id,class_id,subject_id,lesson_plan_id,
    teaching_occurrence_id,source_resource_id,assessment_type,title,
    description,instructions,status,generation_source,generation_metadata
  ) values (
    resolved_school,caller,p_class_id,p_subject_id,p_lesson_plan_id,
    p_teaching_occurrence_id,p_source_resource_id,p_assessment_type,btrim(p_title),
    nullif(btrim(coalesce(p_description,'')),''),
    nullif(btrim(coalesce(p_instructions,'')),''),
    'draft',p_generation_source,coalesce(p_generation_metadata,'{}'::jsonb)
  ) returning id into result_id;

  return result_id;
end;
$$;

create or replace function public.exq_add_draft_item(
  p_assessment_id uuid,
  p_question_type text,
  p_prompt text,
  p_marks numeric default 1,
  p_order_num integer default null,
  p_options jsonb default '[]'::jsonb,
  p_accepted_answers jsonb default '[]'::jsonb,
  p_correct_answer jsonb default null,
  p_marking_guide jsonb default '{}'::jsonb,
  p_auto_marking_mode text default 'none',
  p_difficulty text default null,
  p_bloom_level text default null,
  p_explanation text default null,
  p_hint text default null,
  p_worked_solution text default null,
  p_source_resource_id uuid default null,
  p_source_exercise_ref jsonb default null,
  p_generated_by text default 'teacher'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  ad public.assessment_definitions%rowtype;
  resolved_order integer;
  result_id uuid;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into ad from public.assessment_definitions where id = p_assessment_id;
  if not found then raise exception 'assessment_not_found'; end if;
  if ad.teacher_id is distinct from caller then raise exception 'assessment_not_owned'; end if;
  if ad.status not in ('draft','review') then raise exception 'assessment_locked'; end if;
  if btrim(coalesce(p_prompt,'')) = '' then raise exception 'prompt_required'; end if;
  if p_marks is null or p_marks <= 0 then raise exception 'invalid_marks'; end if;

  resolved_order := coalesce(
    p_order_num,
    (select coalesce(max(order_num),0)+1 from public.assessment_items where assessment_id = p_assessment_id)
  );

  insert into public.assessment_items(
    assessment_id,source_resource_id,source_exercise_ref,question_type,prompt,
    options,accepted_answers,correct_answer,marking_guide,worked_solution,
    explanation,hint,marks,difficulty,bloom_level,auto_marking_mode,
    order_num,status,generated_by
  ) values (
    p_assessment_id,p_source_resource_id,p_source_exercise_ref,p_question_type,btrim(p_prompt),
    coalesce(p_options,'[]'::jsonb),coalesce(p_accepted_answers,'[]'::jsonb),p_correct_answer,
    coalesce(p_marking_guide,'{}'::jsonb),p_worked_solution,p_explanation,p_hint,
    p_marks,p_difficulty,p_bloom_level,p_auto_marking_mode,resolved_order,'draft',p_generated_by
  ) returning id into result_id;

  return result_id;
end;
$$;

create or replace function public.exq_approve_assessment(p_assessment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  ad public.assessment_definitions%rowtype;
  item_count integer;
  total numeric;
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

  update public.assessment_items
  set status='approved',teacher_approved_at=now(),updated_at=now()
  where assessment_id=p_assessment_id and status='draft';

  update public.assessment_definitions
  set status='approved',approved_by=caller,approved_at=now(),total_marks=total,updated_at=now()
  where id=p_assessment_id;

  return jsonb_build_object('ok',true,'assessment_id',p_assessment_id,'item_count',item_count,'total_marks',total);
end;
$$;

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
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  ad public.assessment_definitions%rowtype;
  result_id uuid;
  assignment_status text;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into ad from public.assessment_definitions where id=p_assessment_id for update;
  if not found then raise exception 'assessment_not_found'; end if;
  if ad.teacher_id is distinct from caller then raise exception 'assessment_not_owned'; end if;
  if ad.status <> 'approved' then raise exception 'assessment_not_approved'; end if;
  if ad.class_id is not null and ad.class_id is distinct from p_class_id then raise exception 'assessment_class_mismatch'; end if;
  if not exists (
    select 1 from public.teacher_classes tc
    where tc.teacher_id=caller and tc.school_id=ad.school_id and tc.class_id=p_class_id and tc.subject_id=ad.subject_id
  ) then raise exception 'teacher_not_assigned'; end if;
  if p_target_group_id is not null and not exists (
    select 1 from public.class_groups cg where cg.id=p_target_group_id and cg.class_id=p_class_id
  ) then raise exception 'target_group_mismatch'; end if;

  assignment_status := case when p_opens_at is null or p_opens_at <= now() then 'open' else 'assigned' end;

  insert into public.assessment_assignments(
    assessment_id,school_id,class_id,teacher_id,target_group_id,status,
    opens_at,closes_at,time_limit_minutes,max_attempts,randomize_items,
    randomize_options,show_score_policy,assigned_at
  ) values (
    p_assessment_id,ad.school_id,p_class_id,caller,p_target_group_id,assignment_status,
    p_opens_at,p_closes_at,p_time_limit_minutes,p_max_attempts,p_randomize_items,
    p_randomize_options,p_show_score_policy,now()
  ) returning id into result_id;

  update public.assessment_definitions
  set status=case when assignment_status='open' then 'open' else 'assigned' end,
      published_at=coalesce(published_at,now()),updated_at=now()
  where id=p_assessment_id;

  return result_id;
end;
$$;

create or replace function public.exq_start_or_resume_attempt(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  aa public.assessment_assignments%rowtype;
  ad public.assessment_definitions%rowtype;
  student_row public.students%rowtype;
  existing_attempt public.assessment_attempts%rowtype;
  new_attempt_id uuid;
  next_attempt integer;
  item_payload jsonb;
  response_payload jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;

  select * into aa from public.assessment_assignments where id=p_assignment_id;
  if not found then raise exception 'assignment_not_found'; end if;
  if aa.status not in ('assigned','open') then raise exception 'assignment_not_open'; end if;
  if aa.opens_at is not null and aa.opens_at > now() then raise exception 'assignment_not_open_yet'; end if;
  if aa.closes_at is not null and aa.closes_at <= now() then raise exception 'assignment_closed'; end if;

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
  limit 1;

  if found then
    new_attempt_id := existing_attempt.id;
  else
    select coalesce(max(attempt_number),0)+1 into next_attempt
    from public.assessment_attempts
    where assignment_id=aa.id and student_id=student_row.id;
    if next_attempt > aa.max_attempts then raise exception 'attempt_limit_reached'; end if;

    insert into public.assessment_attempts(
      assignment_id,assessment_id,student_id,school_id,class_id,attempt_number,status
    ) values (
      aa.id,aa.assessment_id,student_row.id,aa.school_id,aa.class_id,next_attempt,'in_progress'
    ) returning id into new_attempt_id;
  end if;

  select * into ad from public.assessment_definitions where id=aa.assessment_id;

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
  where ar.attempt_id=new_attempt_id;

  return jsonb_build_object(
    'ok',true,'attempt_id',new_attempt_id,'assessment_id',ad.id,'title',ad.title,
    'instructions',ad.instructions,'time_limit_minutes',aa.time_limit_minutes,
    'closes_at',aa.closes_at,'items',item_payload,'responses',response_payload
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
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
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
  if at.status <> 'in_progress' then raise exception 'attempt_locked'; end if;

  select * into ai from public.assessment_items
  where id=p_assessment_item_id and assessment_id=at.assessment_id and status='approved';
  if not found then raise exception 'assessment_item_not_found'; end if;

  insert into public.assessment_responses(
    attempt_id,assessment_item_id,response_value,response_text,status,max_score,last_saved_at,updated_at
  ) values (
    at.id,ai.id,coalesce(p_response_value,'null'::jsonb),p_response_text,'saved',ai.marks,now(),now()
  )
  on conflict (attempt_id,assessment_item_id)
  do update set response_value=excluded.response_value,response_text=excluded.response_text,
    status='saved',last_saved_at=now(),updated_at=now();

  update public.assessment_attempts set last_saved_at=now(),updated_at=now() where id=at.id;

  return jsonb_build_object('ok',true,'attempt_id',at.id,'assessment_item_id',ai.id,'saved_at',now());
end;
$$;

create or replace function public.exq_submit_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  at public.assessment_attempts%rowtype;
  learner_id uuid;
  item_rec record;
  response_rec public.assessment_responses%rowtype;
  awarded numeric;
  auto_result jsonb;
  total_awarded numeric := 0;
  total_max numeric := 0;
  manual_count integer := 0;
  final_status text;
  final_result_status text;
  pct numeric;
  tolerance numeric;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select s.id into learner_id from public.students s where s.profile_id=caller limit 1;
  if learner_id is null then raise exception 'learner_identity_not_found'; end if;

  select * into at from public.assessment_attempts where id=p_attempt_id for update;
  if not found then raise exception 'attempt_not_found'; end if;
  if at.student_id is distinct from learner_id then raise exception 'attempt_not_owned'; end if;
  if at.status <> 'in_progress' then raise exception 'attempt_already_submitted'; end if;

  for item_rec in
    select ai.* from public.assessment_items ai
    where ai.assessment_id=at.assessment_id and ai.status='approved'
    order by ai.order_num
  loop
    total_max := total_max + item_rec.marks;

    select * into response_rec
    from public.assessment_responses ar
    where ar.attempt_id=at.id and ar.assessment_item_id=item_rec.id;

    if not found then
      insert into public.assessment_responses(
        attempt_id,assessment_item_id,response_value,status,max_score,submitted_at
      ) values (at.id,item_rec.id,'null'::jsonb,'submitted',item_rec.marks,now())
      returning * into response_rec;
    end if;

    awarded := null;
    auto_result := null;

    if item_rec.auto_marking_mode='option_match' then
      awarded := case when response_rec.response_value = item_rec.correct_answer then item_rec.marks else 0 end;
    elsif item_rec.auto_marking_mode='exact' then
      awarded := case when coalesce(response_rec.response_text,'') = coalesce(item_rec.correct_answer #>> '{}','') then item_rec.marks else 0 end;
    elsif item_rec.auto_marking_mode='case_insensitive' then
      awarded := case when lower(btrim(coalesce(response_rec.response_text,''))) = lower(btrim(coalesce(item_rec.correct_answer #>> '{}',''))) then item_rec.marks else 0 end;
    elsif item_rec.auto_marking_mode='numeric_tolerance' then
      tolerance := coalesce((item_rec.marking_guide->>'tolerance')::numeric,0);
      begin
        awarded := case when abs((response_rec.response_text)::numeric - (item_rec.correct_answer #>> '{}')::numeric) <= tolerance then item_rec.marks else 0 end;
      exception when others then
        awarded := 0;
      end;
    elsif item_rec.auto_marking_mode in ('set_match','ordered_match') then
      awarded := case when response_rec.response_value = item_rec.correct_answer then item_rec.marks else 0 end;
    else
      manual_count := manual_count + 1;
    end if;

    if awarded is not null then
      auto_result := jsonb_build_object('mode',item_rec.auto_marking_mode,'awarded',awarded,'max',item_rec.marks);
      total_awarded := total_awarded + awarded;
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

  pct := case when total_max > 0 then round((total_awarded/total_max)*100,3) else 0 end;
  final_status := case when manual_count=0 then 'auto_marked' else 'teacher_review' end;
  final_result_status := case when manual_count=0 then 'marked' else 'partially_marked' end;

  update public.assessment_attempts
  set status=final_status,result_status=final_result_status,submitted_at=now(),
      auto_marked_at=now(),score=total_awarded,max_score=total_max,percentage=pct,
      last_saved_at=now(),updated_at=now()
  where id=at.id;

  return jsonb_build_object(
    'ok',true,'attempt_id',at.id,'status',final_status,
    'result_status',final_result_status,'score',total_awarded,
    'max_score',total_max,'percentage',pct,'manual_items',manual_count
  );
end;
$$;

revoke all on function public.exq_create_draft_assessment(uuid,uuid,text,text,text,text,uuid,uuid,uuid,text,jsonb) from public, anon;
revoke all on function public.exq_add_draft_item(uuid,text,text,numeric,integer,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,uuid,jsonb,text) from public, anon;
revoke all on function public.exq_approve_assessment(uuid) from public, anon;
revoke all on function public.exq_assign_assessment(uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,boolean,boolean,text) from public, anon;
revoke all on function public.exq_start_or_resume_attempt(uuid) from public, anon;
revoke all on function public.exq_save_response(uuid,uuid,jsonb,text) from public, anon;
revoke all on function public.exq_submit_attempt(uuid) from public, anon;

grant execute on function public.exq_create_draft_assessment(uuid,uuid,text,text,text,text,uuid,uuid,uuid,text,jsonb) to authenticated, service_role;
grant execute on function public.exq_add_draft_item(uuid,text,text,numeric,integer,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,uuid,jsonb,text) to authenticated, service_role;
grant execute on function public.exq_approve_assessment(uuid) to authenticated, service_role;
grant execute on function public.exq_assign_assessment(uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,boolean,boolean,text) to authenticated, service_role;
grant execute on function public.exq_start_or_resume_attempt(uuid) to authenticated, service_role;
grant execute on function public.exq_save_response(uuid,uuid,jsonb,text) to authenticated, service_role;
grant execute on function public.exq_submit_attempt(uuid) to authenticated, service_role;

comment on function public.exq_start_or_resume_attempt(uuid) is 'Resolves auth.uid() to the authoritative student row and returns sanitized items without correct answers.';
comment on function public.exq_submit_attempt(uuid) is 'Locks the learner attempt and performs server-side objective marking.';

commit;
