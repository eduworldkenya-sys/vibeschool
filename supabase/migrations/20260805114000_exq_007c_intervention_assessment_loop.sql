begin;

alter table public.assessment_definitions add column if not exists intervention_id uuid null references public.assessment_interventions(id) on delete set null;
alter table public.assessment_assignments add column if not exists intervention_id uuid null references public.assessment_interventions(id) on delete set null;
alter table public.assessment_interventions
  add column if not exists remedial_assessment_id uuid null references public.assessment_definitions(id) on delete set null,
  add column if not exists remedial_assignment_id uuid null references public.assessment_assignments(id) on delete set null,
  add column if not exists intervention_group_id uuid null references public.class_groups(id) on delete set null,
  add column if not exists baseline_mastery_score numeric null,
  add column if not exists followup_mastery_score numeric null,
  add column if not exists mastery_change numeric null,
  add column if not exists evaluated_at timestamptz null;

alter table public.assessment_interventions
  drop constraint if exists assessment_interventions_status_chk,
  add constraint assessment_interventions_status_chk check (status in ('open','in_progress','completed','dismissed','escalated')),
  drop constraint if exists assessment_interventions_mastery_change_chk,
  add constraint assessment_interventions_mastery_change_chk check (
    (baseline_mastery_score is null or baseline_mastery_score between 0 and 100)
    and (followup_mastery_score is null or followup_mastery_score between 0 and 100)
    and (mastery_change is null or mastery_change between -100 and 100)
  );

create unique index if not exists assessment_definitions_intervention_draft_uidx
  on public.assessment_definitions(intervention_id)
  where intervention_id is not null and status in ('draft','review','approved','assigned','open');
create index if not exists assessment_assignments_intervention_idx
  on public.assessment_assignments(intervention_id) where intervention_id is not null;

create or replace function public.exq_create_intervention_assessment(p_intervention_id uuid,p_title text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); iv public.assessment_interventions%rowtype; outcome_row public.curriculum_learning_outcomes%rowtype; existing_id uuid; result_id uuid; resolved_title text;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into iv from public.assessment_interventions where id=p_intervention_id for update;
  if not found then raise exception 'intervention_not_found'; end if;
  if iv.teacher_id is distinct from caller then raise exception 'intervention_not_owned'; end if;
  if iv.status in ('completed','dismissed') then raise exception 'intervention_closed'; end if;
  select id into existing_id from public.assessment_definitions where intervention_id=iv.id and status in ('draft','review','approved','assigned','open') order by created_at desc limit 1;
  if existing_id is not null then return jsonb_build_object('ok',true,'assessment_id',existing_id,'created',false); end if;
  select * into outcome_row from public.curriculum_learning_outcomes where id=iv.outcome_id;
  if not found then raise exception 'outcome_not_found'; end if;
  resolved_title:=coalesce(nullif(btrim(coalesce(p_title,'')),''),'Remedial Practice: '||coalesce(outcome_row.outcome_code||' — ','')||outcome_row.outcome_text);
  insert into public.assessment_definitions(
    school_id,teacher_id,class_id,subject_id,assessment_type,title,description,instructions,status,
    generation_source,generation_status,generation_metadata,intervention_id
  ) values (
    iv.school_id,caller,iv.class_id,iv.subject_id,'practice',resolved_title,iv.recommendation,
    'Complete this focused practice. Review each answer before submitting.','draft','intervention_intelligence','completed',
    jsonb_build_object('intervention_id',iv.id,'student_id',iv.student_id,'outcome_id',iv.outcome_id,
      'outcome_code',outcome_row.outcome_code,'outcome_text',outcome_row.outcome_text,
      'baseline_mastery_score',iv.mastery_score,'recommendation_type',iv.recommendation_type,
      'priority',iv.priority,'required_design',jsonb_build_object(
        'question_count',case when iv.priority in ('urgent','high') then 5 else 3 end,
        'difficulty_progression',jsonb_build_array('supported','guided','independent'),
        'teacher_review_required',true)),iv.id
  ) returning id into result_id;
  update public.assessment_interventions set remedial_assessment_id=result_id,
    baseline_mastery_score=coalesce(baseline_mastery_score,mastery_score),status='in_progress',updated_at=now()
  where id=iv.id;
  return jsonb_build_object('ok',true,'assessment_id',result_id,'created',true);
end;
$$;

create or replace function public.exq_assign_assessment(
  p_assessment_id uuid,p_class_id uuid,p_target_group_id uuid default null,
  p_opens_at timestamptz default null,p_closes_at timestamptz default null,
  p_time_limit_minutes integer default null,p_max_attempts integer default 1,
  p_randomize_items boolean default false,p_randomize_options boolean default false,
  p_show_score_policy text default 'after_review'
)
returns uuid language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); ad public.assessment_definitions%rowtype; iv public.assessment_interventions%rowtype; result_id uuid; assignment_status text; resolved_group uuid:=p_target_group_id;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into ad from public.assessment_definitions where id=p_assessment_id for update;
  if not found then raise exception 'assessment_not_found'; end if;
  if ad.teacher_id is distinct from caller then raise exception 'assessment_not_owned'; end if;
  if ad.status<>'approved' then raise exception 'assessment_not_approved'; end if;
  if ad.class_id is not null and ad.class_id is distinct from p_class_id then raise exception 'assessment_class_mismatch'; end if;
  if not exists(select 1 from public.teacher_classes tc where tc.teacher_id=caller and tc.school_id=ad.school_id and tc.class_id=p_class_id and tc.subject_id=ad.subject_id) then raise exception 'teacher_not_assigned'; end if;
  if ad.intervention_id is not null then
    select * into iv from public.assessment_interventions where id=ad.intervention_id for update;
    if not found then raise exception 'intervention_not_found'; end if;
    if iv.teacher_id is distinct from caller or iv.class_id is distinct from p_class_id then raise exception 'intervention_mismatch'; end if;
    if iv.status in ('completed','dismissed') then raise exception 'intervention_closed'; end if;
    resolved_group:=iv.intervention_group_id;
    if resolved_group is null then
      insert into public.class_groups(class_id,name,type,color) values(iv.class_id,'Intervention '||left(iv.id::text,8),'intervention','#dc2626') returning id into resolved_group;
      insert into public.class_group_members(group_id,student_id) values(resolved_group,iv.student_id) on conflict do nothing;
      update public.assessment_interventions set intervention_group_id=resolved_group,updated_at=now() where id=iv.id;
    elsif not exists(select 1 from public.class_group_members where group_id=resolved_group and student_id=iv.student_id) then
      insert into public.class_group_members(group_id,student_id) values(resolved_group,iv.student_id) on conflict do nothing;
    end if;
  elsif resolved_group is not null and not exists(select 1 from public.class_groups cg where cg.id=resolved_group and cg.class_id=p_class_id) then
    raise exception 'target_group_mismatch';
  end if;
  assignment_status:=case when p_opens_at is null or p_opens_at<=now() then 'open' else 'assigned' end;
  insert into public.assessment_assignments(
    assessment_id,school_id,class_id,teacher_id,target_group_id,status,opens_at,closes_at,time_limit_minutes,
    max_attempts,randomize_items,randomize_options,show_score_policy,assigned_at,intervention_id
  ) values (
    p_assessment_id,ad.school_id,p_class_id,caller,resolved_group,assignment_status,p_opens_at,p_closes_at,
    p_time_limit_minutes,p_max_attempts,p_randomize_items,p_randomize_options,p_show_score_policy,now(),ad.intervention_id
  ) returning id into result_id;
  update public.assessment_definitions set status=case when assignment_status='open' then 'open' else 'assigned' end,published_at=coalesce(published_at,now()),updated_at=now() where id=p_assessment_id;
  if ad.intervention_id is not null then update public.assessment_interventions set remedial_assignment_id=result_id,status='in_progress',updated_at=now() where id=ad.intervention_id; end if;
  return result_id;
end;
$$;

create or replace function public.exq_evaluate_intervention(p_intervention_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); iv public.assessment_interventions%rowtype; followup numeric; delta numeric; next_status text; next_note text; released_attempt uuid;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into iv from public.assessment_interventions where id=p_intervention_id for update;
  if not found then raise exception 'intervention_not_found'; end if;
  if iv.teacher_id is distinct from caller then raise exception 'intervention_not_owned'; end if;
  if iv.remedial_assignment_id is null then raise exception 'intervention_not_assigned'; end if;
  select at.id into released_attempt from public.assessment_attempts at
  where at.assignment_id=iv.remedial_assignment_id and at.student_id=iv.student_id
    and at.status='released' and at.result_status='released'
  order by at.released_at desc nulls last limit 1;
  if released_attempt is null then raise exception 'followup_result_not_released'; end if;
  perform public.exq_sync_attempt_outcome_evidence(released_attempt);
  select mastery_score into followup from public.student_outcome_mastery where student_id=iv.student_id and outcome_id=iv.outcome_id;
  if followup is null then raise exception 'followup_mastery_not_available'; end if;
  delta:=round(followup-coalesce(iv.baseline_mastery_score,iv.mastery_score),2);
  next_status:=case when followup>=60 and delta>=10 then 'completed' when followup>=80 then 'completed' when delta<5 or followup<40 then 'escalated' else 'in_progress' end;
  next_note:=case when next_status='completed' then 'Follow-up evidence shows sufficient mastery improvement.' when next_status='escalated' then 'Follow-up evidence shows limited improvement; escalate to reteaching or additional support.' else 'Improvement is visible but more guided practice is required.' end;
  update public.assessment_interventions
  set followup_mastery_score=followup,mastery_change=delta,evaluated_at=now(),status=next_status,
      completion_note=case when next_status='completed' then next_note else completion_note end,
      completed_at=case when next_status='completed' then now() else null end,
      recommendation=case when next_status='escalated' then next_note else recommendation end,updated_at=now()
  where id=iv.id;
  return jsonb_build_object('ok',true,'intervention_id',iv.id,'attempt_id',released_attempt,
    'baseline_mastery_score',coalesce(iv.baseline_mastery_score,iv.mastery_score),
    'followup_mastery_score',followup,'mastery_change',delta,'status',next_status,'recommendation',next_note);
end;
$$;

revoke all on function public.exq_create_intervention_assessment(uuid,text) from public,anon;
revoke all on function public.exq_evaluate_intervention(uuid) from public,anon;
revoke all on function public.exq_assign_assessment(uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,boolean,boolean,text) from public,anon;
grant execute on function public.exq_create_intervention_assessment(uuid,text) to authenticated,service_role;
grant execute on function public.exq_evaluate_intervention(uuid) to authenticated,service_role;
grant execute on function public.exq_assign_assessment(uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,boolean,boolean,text) to authenticated,service_role;

commit;
