-- Public practice must only be created by a privileged publication workflow.
-- Existing school-only assignments remain unchanged; learner access remains tied to auth.uid().
-- No answer keys are exposed by the learner discovery/start RPCs.
alter table public.assessment_assignments
  add column if not exists audience text not null default 'class',
  add column if not exists audience_grade text;
alter table public.assessment_assignments
  drop constraint if exists assessment_assignments_audience_chk;
alter table public.assessment_assignments
  add constraint assessment_assignments_audience_chk check (
    (audience='class' and school_id is not null and class_id is not null and audience_grade is null)
    or (audience='public_practice' and school_id is null and class_id is null
      and target_group_id is null and nullif(btrim(audience_grade),'') is not null
      and show_score_policy='immediate')
  );
alter table public.assessment_assignments alter column school_id drop not null;
alter table public.assessment_assignments alter column class_id drop not null;
alter table public.assessment_attempts alter column school_id drop not null;
alter table public.assessment_attempts alter column class_id drop not null;
alter table public.assessment_attempt_audit_events alter column school_id drop not null;
alter table public.assessment_attempt_audit_events alter column class_id drop not null;
alter table public.assessment_gradebook_entries alter column school_id drop not null;
alter table public.assessment_gradebook_entries alter column class_id drop not null;
create index if not exists assessment_assignments_public_grade_idx
on public.assessment_assignments (lower(btrim(audience_grade)))
where audience='public_practice' and status in ('assigned','open');

create or replace function public.exq_public_practice_eligible(p_grade text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
select auth.uid() is not null and p_grade is not null and exists (
  select 1 from public.students s where s.profile_id=auth.uid() and s.deleted_at is null
    and (
      exists(select 1 from public.independent_learner_identities ili
        where ili.user_id=auth.uid() and lower(btrim(ili.grade_label))=lower(btrim(p_grade)))
      or exists(select 1 from public.student_classes sc join public.classes c on c.id=sc.class_id
        where sc.student_id=s.id and sc.is_current=true
        and lower(btrim(c.name))=lower(btrim(p_grade)))
    )
) $$;
revoke all on function public.exq_public_practice_eligible(text) from public,anon;
grant execute on function public.exq_public_practice_eligible(text) to authenticated,service_role;

CREATE OR REPLACE FUNCTION public.exq_list_my_assignments()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    'score',case when at.result_status='released' or (ad.assessment_type='practice' and aa.show_score_policy='immediate' and at.result_status='marked') then at.score else null end,
    'max_score',case when at.result_status='released' or (ad.assessment_type='practice' and aa.show_score_policy='immediate' and at.result_status='marked') then at.max_score else null end,
    'percentage',case when at.result_status='released' or (ad.assessment_type='practice' and aa.show_score_policy='immediate' and at.result_status='marked') then at.percentage else null end,
    'submitted_at',at.submitted_at,
    'can_start',(
      aa.status in ('assigned','open')
      and (aa.opens_at is null or aa.opens_at<=now())
      and (aa.closes_at is null or aa.closes_at>now())
      and (
        at.id is null
        or at.status='in_progress'
        or at.attempt_number<aa.max_attempts
      )
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
  left join public.student_classes sc on sc.class_id=aa.class_id and sc.student_id=learner.id and sc.is_current=true and sc.school_id=aa.school_id
  left join lateral (
    select a.* from public.assessment_attempts a
    where a.assignment_id=aa.id and a.student_id=learner.id
    order by a.attempt_number desc limit 1
  ) at on true
  where aa.status in ('assigned','open','closed')
    and ((aa.audience='class' and sc.student_id is not null)
      or (aa.audience='public_practice' and ad.assessment_type='practice'
        and ad.published_at is not null and aa.school_id is null and aa.class_id is null
        and public.exq_public_practice_eligible(aa.audience_grade)))
    and (aa.target_group_id is null or exists (
      select 1 from public.class_group_members cgm
      where cgm.group_id=aa.target_group_id and cgm.student_id=learner.id
    ));

  return jsonb_build_object('ok',true,'assignments',payload);
end;
$function$


CREATE OR REPLACE FUNCTION public.exq_start_or_resume_attempt(p_assignment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

  select s.* into student_row from public.students s
  where s.profile_id=caller and s.deleted_at is null limit 1;
  if not found then raise exception 'learner_identity_not_found'; end if;
  if aa.audience='public_practice' then
    if aa.school_id is not null or aa.class_id is not null
       or aa.target_group_id is not null
       or not public.exq_public_practice_eligible(aa.audience_grade)
       or not exists(select 1 from public.assessment_definitions d
          where d.id=aa.assessment_id and d.assessment_type='practice'
            and d.published_at is not null
            and d.status in ('approved','assigned','open','closed'))
    then raise exception 'public_practice_not_eligible'; end if;
  elsif aa.audience='class' then
    if not exists(select 1 from public.student_classes sc
      where sc.student_id=student_row.id and sc.is_current=true
        and sc.class_id=aa.class_id and sc.school_id=aa.school_id)
    then raise exception 'learner_not_in_class'; end if;
  else raise exception 'invalid_assessment_audience';
  end if;
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
      -- Submit and mark expired attempts via canonical scoring.
      perform public.exq_submit_attempt(existing_attempt.id);
      insert into public.assessment_attempt_audit_events(attempt_id,assignment_id,student_id,school_id,class_id,event_type,actor_profile_id,metadata)
      values(existing_attempt.id,aa.id,student_row.id,aa.school_id,aa.class_id,'expired_submit',caller,jsonb_build_object('source','resume_guard'));
      return jsonb_build_object('ok',false,'reason','attempt_time_expired','attempt_id',existing_attempt.id);
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
  where id=aa.assessment_id and (status in ('assigned','open','closed') or (status='approved' and published_at is not null));
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
$function$

revoke all on function public.exq_list_my_assignments() from public,anon;
revoke all on function public.exq_start_or_resume_attempt(uuid) from public,anon;
grant execute on function public.exq_list_my_assignments() to authenticated,service_role;
grant execute on function public.exq_start_or_resume_attempt(uuid) to authenticated,service_role;
