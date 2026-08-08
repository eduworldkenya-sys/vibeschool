create or replace function public.student_schedule_forgetting_revision()
returns integer
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_count integer := 0;
  r record;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;
  for r in
    with outcome_candidates as (
      select 1 lane_priority,'outcome_decay'::text lane,nullif(x->>'outcome_id','')::uuid outcome_id,
        coalesce(c.subject,'General')::text subject,coalesce(x->>'outcome_text','Learning outcome')::text topic,
        coalesce((x->>'forgetting_risk')::numeric,0) forgetting_risk,
        coalesce((x->>'days_since_evidence')::integer,0) age_days,(current_date+1)::date due_date,
        'outcome:'||coalesce(x->>'outcome_id','unknown') evidence_key,
        format('Twin scheduled this because forgetting risk is %s%% and the last verified evidence is %s day(s) old.',round(coalesce((x->>'forgetting_risk')::numeric,0)*100),coalesce(x->>'days_since_evidence','unknown')) reason
      from jsonb_array_elements(coalesce(public.student_get_twin_mastery()->'outcomes','[]'::jsonb)) x
      left join public.curriculum_learning_outcomes o on o.id=nullif(x->>'outcome_id','')::uuid
      left join public.curriculum c on c.id=o.curriculum_id
      where coalesce((x->>'forgetting_risk')::numeric,0)>=0.35 or coalesce((x->>'days_since_evidence')::integer,0)>=14
    ), retest_candidates as (
      select 2 lane_priority,'scheduled_retest'::text lane,m.outcome_id,
        coalesce(r.subject,'General')::text subject,coalesce(r.topic,'Review topic')::text topic,
        case when r.due_date<=current_date then 1::numeric else greatest(0,1-((r.due_date-current_date)::numeric/7)) end forgetting_risk,
        greatest(0,current_date-coalesce(r.last_attempt_at::date,r.created_at::date,current_date)) age_days,
        greatest(current_date,least(r.due_date,current_date+7))::date due_date,
        'retest:'||r.id::text evidence_key,
        case when r.due_date<=current_date then 'This spaced retest is due now. Recheck the topic before the memory weakens further.' else format('Twin scheduled this spaced retest for %s to protect retention.',r.due_date) end reason
      from public.student_kcse_retest_schedule r
      left join public.student_mistake_notebook m on m.id=r.source_mistake_id
      where r.student_id in (v_student_id,v_uid) and r.mastery_state<>'mastered' and r.due_date<=current_date+7
    ), mistake_candidates as (
      select 3 lane_priority,'mistake_recovery'::text lane,m.outcome_id,
        coalesce(m.subject,'General')::text subject,coalesce(m.topic,'Review mistake')::text topic,
        least(1::numeric,0.35+greatest(0,coalesce(m.repeat_count,1)-1)*0.15+least(0.35,greatest(0,extract(epoch from (now()-coalesce(m.last_missed_at,m.first_missed_at,now())))/86400.0)/30.0)) forgetting_risk,
        floor(greatest(0,extract(epoch from (now()-coalesce(m.last_missed_at,m.first_missed_at,now())))/86400.0))::integer age_days,
        (current_date+1)::date due_date,'mistake:'||m.id::text evidence_key,
        format('Twin scheduled this because this mistake is still unresolved%s and was last seen %s day(s) ago.',case when coalesce(m.repeat_count,1)>1 then format(' after %s repeats',m.repeat_count) else '' end,floor(greatest(0,extract(epoch from (now()-coalesce(m.last_missed_at,m.first_missed_at,now())))/86400.0))::integer) reason
      from public.student_mistake_notebook m
      where m.student_id in (v_student_id,v_uid) and m.status<>'resolved'
        and coalesce(m.last_correct_at,'epoch'::timestamptz)<coalesce(m.last_missed_at,m.first_missed_at,now())
    ), combined as (
      select * from outcome_candidates union all select * from retest_candidates union all select * from mistake_candidates
    ), deduped as (
      select distinct on(lower(subject),lower(topic)) * from combined
      order by lower(subject),lower(topic),lane_priority,forgetting_risk desc,age_days desc
    )
    select * from deduped order by lane_priority,forgetting_risk desc,age_days desc,subject,topic limit 5
  loop
    if not exists (
      select 1 from public.student_revision_plan_items p
      where p.student_id=v_student_id and p.plan_date between current_date and current_date+7 and p.status='planned'
        and (p.source->>'evidence_key'=r.evidence_key or (lower(p.subject)=lower(r.subject) and lower(p.topic)=lower(r.topic) and p.activity_type='spaced_revision'))
    ) then
      insert into public.student_revision_plan_items(student_id,plan_date,subject,topic,activity_type,target_minutes,priority,reason,action_url,status,source)
      values(v_student_id,r.due_date,r.subject,r.topic,'spaced_revision',15,case r.lane_priority when 1 then 1 when 2 then 1 else 2 end,r.reason,'/student/vibelearn/revision','planned',jsonb_build_object('source','twin_forgetting_engine','lane',r.lane,'evidence_key',r.evidence_key,'outcome_id',r.outcome_id,'forgetting_risk',round(r.forgetting_risk,3),'days_since_evidence',r.age_days,'identity_bridge',case when r.lane in ('scheduled_retest','mistake_recovery') then 'canonical_plus_profile_history' else 'canonical_mastery' end));
      v_count:=v_count+1;
    end if;
  end loop;
  return v_count;
end;
$function$;
revoke all on function public.student_schedule_forgetting_revision() from public;
revoke all on function public.student_schedule_forgetting_revision() from anon;
grant execute on function public.student_schedule_forgetting_revision() to authenticated;
