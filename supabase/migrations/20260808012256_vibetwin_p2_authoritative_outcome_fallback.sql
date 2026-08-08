-- P2 hardening: representation effectiveness must survive sparse/stale cached brain state.

create or replace function public.twin_resolve_learning_representation_outcome(
  p_student_id uuid,
  p_context jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_outcome_id uuid;
begin
  if p_student_id is null then return null; end if;

  begin
    v_outcome_id := nullif(p_context #>> '{learner,weak_outcome,outcome_id}','')::uuid;
  exception when invalid_text_representation then
    v_outcome_id := null;
  end;

  if v_outcome_id is not null and exists (
    select 1 from public.curriculum_learning_outcomes clo where clo.id=v_outcome_id
  ) then
    return v_outcome_id;
  end if;

  select som.outcome_id
    into v_outcome_id
  from public.student_outcome_mastery som
  where som.student_id=p_student_id
  order by coalesce(som.mastery_score,0) asc,
           coalesce(som.evidence_count,0) desc,
           som.updated_at desc nulls last
  limit 1;

  return v_outcome_id;
end;
$$;

revoke all on function public.twin_resolve_learning_representation_outcome(uuid,jsonb) from public, anon, authenticated;

create or replace function public.student_record_learning_transformation_event(
  p_transformation_id uuid,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_t public.student_learning_transformations%rowtype;
  v_event_id uuid;
  v_ctx jsonb;
  v_outcome_id uuid;
  v_exposure jsonb := '{}'::jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_event_type not in ('viewed','completed','helpful','not_helpful') then raise exception 'unsupported_event_type'; end if;

  select id into v_student_id
  from public.students
  where profile_id=v_uid and deleted_at is null
  limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;

  select * into v_t
  from public.student_learning_transformations
  where id=p_transformation_id and student_id=v_student_id;
  if v_t.id is null then raise exception 'transformation_not_found'; end if;

  insert into public.student_learning_transformation_events(student_id,transformation_id,event_type,metadata)
  values(v_student_id,p_transformation_id,p_event_type,coalesce(p_metadata,'{}'::jsonb))
  returning id into v_event_id;

  insert into public.student_learning_events(student_id,event_type,source_type,source_id,xp_awarded,occurred_at,metadata)
  values(
    v_student_id,
    'learning_representation_'||p_event_type,
    'learning_transformation',
    v_t.id,
    0,
    now(),
    jsonb_build_object('representation',v_t.representation,'source_type',v_t.source_type,'source_id',v_t.source_id,'chapter_id',v_t.chapter_id,'low_authority',true)
      || coalesce(p_metadata,'{}'::jsonb)
  );

  if p_event_type='completed' then
    begin
      v_ctx := public.student_get_learning_source_context(v_t.source_type,v_t.source_id);
      v_outcome_id := public.twin_resolve_learning_representation_outcome(v_student_id,v_ctx);
      if v_outcome_id is not null then
        v_exposure := public.twin_record_learning_representation_exposure(
          v_student_id,v_t.id,v_t.representation,v_outcome_id,
          jsonb_build_object('transformation_event_id',v_event_id,'source_type',v_t.source_type,'source_id',v_t.source_id,'outcome_authority','context_then_student_outcome_mastery')
        );
      end if;
    exception when others then
      v_exposure := jsonb_build_object('recorded',false,'reason','effectiveness_attribution_unavailable');
    end;
  end if;

  return jsonb_build_object('recorded',true,'id',v_event_id,'effectiveness_exposure',v_exposure);
end;
$$;

revoke all on function public.student_record_learning_transformation_event(uuid,text,jsonb) from public, anon;
grant execute on function public.student_record_learning_transformation_event(uuid,text,jsonb) to authenticated;

create or replace function public.student_recommend_learning_representation(
  p_source_type text,
  p_source_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_ctx jsonb;
  v_outcome_id uuid;
  v_effect public.student_twin_intervention_effects%rowtype;
  v_representation text := 'immersive';
  v_reason text := 'default_source_grounded_view';
  v_behavioral_rep text;
  v_behavioral_score integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_source_type not in ('chapter','homework','teacher_content','vibelearn_content','resource') then raise exception 'unsupported_source_type'; end if;

  select id into v_student_id
  from public.students
  where profile_id=v_uid and deleted_at is null
  limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;

  v_ctx := public.student_get_learning_source_context(p_source_type,p_source_id);
  v_outcome_id := public.twin_resolve_learning_representation_outcome(v_student_id,v_ctx);

  select * into v_effect
  from public.student_twin_intervention_effects e
  where e.student_id=v_student_id
    and e.intervention_type='learning_representation'
    and e.intervention_key like 'representation:%'
    and (v_outcome_id is null or e.outcome_id=v_outcome_id or e.outcome_id is null)
    and e.attempts > 0
  order by
    case when v_outcome_id is not null and e.outcome_id=v_outcome_id then 0 else 1 end,
    e.confidence desc,
    e.effectiveness_score desc,
    e.attempts desc,
    e.last_observed_at desc nulls last
  limit 1;

  if v_effect.intervention_key is not null and coalesce(v_effect.confidence,0) >= 0.20 then
    v_representation := replace(v_effect.intervention_key,'representation:','');
    v_reason := 'verified_learning_effectiveness';
  else
    select t.representation,
           sum(case e.event_type when 'helpful' then 2 when 'completed' then 1 when 'not_helpful' then -2 else 0 end)::integer
      into v_behavioral_rep,v_behavioral_score
    from public.student_learning_transformations t
    join public.student_learning_transformation_events e on e.transformation_id=t.id and e.student_id=t.student_id
    where t.student_id=v_student_id
      and t.updated_at >= now()-interval '90 days'
    group by t.representation
    having sum(case e.event_type when 'helpful' then 2 when 'completed' then 1 when 'not_helpful' then -2 else 0 end) > 0
    order by sum(case e.event_type when 'helpful' then 2 when 'completed' then 1 when 'not_helpful' then -2 else 0 end) desc,
             max(e.created_at) desc
    limit 1;

    if v_behavioral_rep is not null then
      v_representation := v_behavioral_rep;
      v_reason := 'behavioral_preference_pending_verified_effect';
    end if;
  end if;

  if v_representation not in ('immersive','simplify','mind_map','flashcards','quiz','audio_lesson','revision_sheet','worked_examples','visual_explainer','story_mode') then
    v_representation := 'immersive';
    v_reason := 'default_source_grounded_view';
  end if;

  return jsonb_build_object(
    'representation',v_representation,
    'reason',v_reason,
    'outcome_id',v_outcome_id,
    'effectiveness_score',v_effect.effectiveness_score,
    'effectiveness_confidence',v_effect.confidence,
    'effectiveness_attempts',v_effect.attempts,
    'behavioral_score',v_behavioral_score,
    'policy','verified_effectiveness_then_behavioral_preference_then_safe_default'
  );
end;
$$;

revoke all on function public.student_recommend_learning_representation(text,uuid) from public, anon;
grant execute on function public.student_recommend_learning_representation(text,uuid) to authenticated;
