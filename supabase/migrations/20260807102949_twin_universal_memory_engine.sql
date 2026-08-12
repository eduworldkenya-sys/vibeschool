-- TWIN universal memory engine.
-- Extends existing student_twin_memory_claims; does not create a parallel learner model.

alter table public.student_twin_memory_claims
  add column if not exists importance numeric not null default 0.5,
  add column if not exists learning_impact numeric,
  add column if not exists memory_scope text not null default 'learner',
  add column if not exists permanence text not null default 'adaptive',
  add column if not exists relationship_refs jsonb not null default '{}'::jsonb,
  add column if not exists provenance jsonb not null default '{}'::jsonb;

alter table public.student_twin_memory_claims
  drop constraint if exists student_twin_memory_claims_memory_type_check;
alter table public.student_twin_memory_claims
  add constraint student_twin_memory_claims_memory_type_check
  check (memory_type = any(array[
    'misconception','strength','preference','behavior','intervention_response','study_pattern',
    'learning_fact','attendance_pattern','reading_pattern','task_pattern','assessment_pattern','teacher_feedback','revision_pattern'
  ]::text[]));

alter table public.student_twin_memory_claims
  drop constraint if exists student_twin_memory_claims_importance_check;
alter table public.student_twin_memory_claims
  add constraint student_twin_memory_claims_importance_check check (importance >= 0 and importance <= 1);
alter table public.student_twin_memory_claims
  drop constraint if exists student_twin_memory_claims_learning_impact_check;
alter table public.student_twin_memory_claims
  add constraint student_twin_memory_claims_learning_impact_check check (learning_impact is null or (learning_impact >= -1 and learning_impact <= 1));
alter table public.student_twin_memory_claims
  drop constraint if exists student_twin_memory_claims_permanence_check;
alter table public.student_twin_memory_claims
  add constraint student_twin_memory_claims_permanence_check check (permanence in ('historical','durable','adaptive','ephemeral'));

create index if not exists idx_twin_memory_student_importance on public.student_twin_memory_claims(student_id,importance desc,last_confirmed_at desc);
create index if not exists idx_twin_memory_student_type on public.student_twin_memory_claims(student_id,memory_type,status);

-- L0 recovery: these RPCs pre-existed this repository migration in production.
-- Restore the production-catalog definitions before preserving the original ACL
-- hardening below so a blank database can replay the historical chain faithfully.
create or replace function public.student_refresh_twin_memory()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid:=auth.uid();
  v_student_id uuid;
  v_upserts integer:=0; v_aged integer:=0; v_count integer:=0;
  v_attempts integer:=0; v_correct integer:=0; v_avg_ms numeric; v_peak_hour integer; v_peak_count integer:=0;
  v_attendance_total integer:=0; v_present integer:=0; v_late integer:=0;
  v_read_sessions integer:=0; v_read_seconds bigint:=0; v_books_completed integer:=0;
  v_tasks integer:=0; v_completed_tasks integer:=0; v_returned_tasks integer:=0;
  v_assessments integer:=0; v_avg_pct numeric;
  v_learning_events integer:=0; v_revision_done integer:=0;
begin
  perform public.hq_require_policy_enabled('twin','twin.enabled');
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;

  insert into public.student_twin_memory_claims(student_id,subject_id,outcome_id,memory_type,claim_key,claim_text,confidence,evidence_count,first_observed_at,last_confirmed_at,status,source_summary,importance,learning_impact,memory_scope,permanence,relationship_refs,provenance)
  select v_student_id,null,m.outcome_id,'misconception','outcome:'||m.outcome_id::text,
         'Repeated difficulty on '||coalesce(clo.outcome_text,m.topic,'this learning outcome'),
         least(0.95,0.35+least(m.repeat_count,8)*0.075),m.repeat_count,m.first_missed_at,m.last_missed_at,'active',
         jsonb_build_object('source','student_mistake_notebook','topic',m.topic,'repeat_count',m.repeat_count),
         least(0.95,0.55+least(m.repeat_count,8)*0.05),-least(1,m.repeat_count/10.0),'learner','adaptive',
         jsonb_build_object('outcome_id',m.outcome_id,'topic',m.topic),jsonb_build_object('table','student_mistake_notebook')
  from public.student_mistake_notebook m
  left join public.curriculum_learning_outcomes clo on clo.id=m.outcome_id
  where m.student_id=v_uid and m.status<>'resolved' and m.outcome_id is not null and m.repeat_count>=2
  on conflict(student_id,memory_type,claim_key) do update set claim_text=excluded.claim_text,confidence=excluded.confidence,evidence_count=excluded.evidence_count,last_confirmed_at=excluded.last_confirmed_at,status='active',source_summary=excluded.source_summary,importance=excluded.importance,learning_impact=excluded.learning_impact,relationship_refs=excluded.relationship_refs,provenance=excluded.provenance,updated_at=now();
  get diagnostics v_count=row_count; v_upserts:=v_upserts+v_count;

  insert into public.student_twin_memory_claims(student_id,subject_id,outcome_id,memory_type,claim_key,claim_text,confidence,evidence_count,first_observed_at,last_confirmed_at,status,source_summary,importance,learning_impact,memory_scope,permanence,relationship_refs,provenance)
  select v_student_id,null,som.outcome_id,'strength','outcome:'||som.outcome_id::text,'Consistent strength in '||clo.outcome_text,
         least(0.95,greatest(0.4,som.evidence_count/8.0)),som.evidence_count,coalesce(som.last_evidence_at,now()),coalesce(som.last_evidence_at,now()),'active',
         jsonb_build_object('source','student_outcome_mastery','mastery_score',som.mastery_score),
         least(0.95,0.5+som.evidence_count/20.0),least(1,coalesce(som.mastery_score,0)/100.0),'learner','durable',
         jsonb_build_object('outcome_id',som.outcome_id),jsonb_build_object('table','student_outcome_mastery')
  from public.student_outcome_mastery som join public.curriculum_learning_outcomes clo on clo.id=som.outcome_id
  where som.student_id=v_student_id and coalesce(som.mastery_score,0)>=80 and som.evidence_count>=3
  on conflict(student_id,memory_type,claim_key) do update set claim_text=excluded.claim_text,confidence=excluded.confidence,evidence_count=excluded.evidence_count,last_confirmed_at=excluded.last_confirmed_at,status='active',source_summary=excluded.source_summary,importance=excluded.importance,learning_impact=excluded.learning_impact,relationship_refs=excluded.relationship_refs,provenance=excluded.provenance,updated_at=now();
  get diagnostics v_count=row_count; v_upserts:=v_upserts+v_count;

  select count(*),count(*) filter(where is_correct),avg(response_ms) filter(where response_ms between 1000 and 600000)
    into v_attempts,v_correct,v_avg_ms from public.student_practice_attempts where student_id=v_uid and attempted_at>=now()-interval '90 days';
  if v_attempts>=5 then
    insert into public.student_twin_memory_claims(student_id,memory_type,claim_key,claim_text,confidence,evidence_count,first_observed_at,last_confirmed_at,status,source_summary,importance,learning_impact,memory_scope,permanence,provenance)
    values(v_student_id,'behavior','practice_accuracy_90d',case when v_correct::numeric/nullif(v_attempts,0)>=0.8 then 'Recent independent practice is consistently accurate.' when v_correct::numeric/nullif(v_attempts,0)<0.5 then 'Recent independent practice shows frequent errors and benefits from more guidance.' else 'Recent independent practice accuracy is mixed.' end,
      least(0.9,0.35+least(v_attempts,25)*0.02),v_attempts,now()-interval '90 days',now(),'active',jsonb_build_object('source','student_practice_attempts','window_days',90,'attempts',v_attempts,'correct',v_correct,'accuracy',round(v_correct::numeric/nullif(v_attempts,0),4)),0.65,round(((v_correct::numeric/nullif(v_attempts,0))-0.5)*2,4),'learner','adaptive',jsonb_build_object('table','student_practice_attempts'))
    on conflict(student_id,memory_type,claim_key) do update set claim_text=excluded.claim_text,confidence=excluded.confidence,evidence_count=excluded.evidence_count,last_confirmed_at=excluded.last_confirmed_at,status='active',source_summary=excluded.source_summary,importance=excluded.importance,learning_impact=excluded.learning_impact,provenance=excluded.provenance,updated_at=now();
    get diagnostics v_count=row_count; v_upserts:=v_upserts+v_count;
  end if;
  if v_attempts>=5 and v_avg_ms is not null then
    insert into public.student_twin_memory_claims(student_id,memory_type,claim_key,claim_text,confidence,evidence_count,first_observed_at,last_confirmed_at,status,source_summary,importance,memory_scope,permanence,provenance)
    values(v_student_id,'behavior','practice_response_pace_90d','Recent practice response pace is measured from completed attempts.',least(0.85,0.35+least(v_attempts,25)*0.02),v_attempts,now()-interval '90 days',now(),'active',jsonb_build_object('source','student_practice_attempts','average_response_ms',round(v_avg_ms,0)),0.45,'learner','adaptive',jsonb_build_object('table','student_practice_attempts'))
    on conflict(student_id,memory_type,claim_key) do update set confidence=excluded.confidence,evidence_count=excluded.evidence_count,last_confirmed_at=excluded.last_confirmed_at,status='active',source_summary=excluded.source_summary,importance=excluded.importance,provenance=excluded.provenance,updated_at=now();
    get diagnostics v_count=row_count; v_upserts:=v_upserts+v_count;
  end if;

  select h,c into v_peak_hour,v_peak_count from (select extract(hour from attempted_at at time zone 'Africa/Nairobi')::integer h,count(*)::integer c from public.student_practice_attempts where student_id=v_uid and attempted_at>=now()-interval '60 days' group by 1 order by count(*) desc,1 limit 1) x;
  if coalesce(v_peak_count,0)>=5 then
    insert into public.student_twin_memory_claims(student_id,memory_type,claim_key,claim_text,confidence,evidence_count,first_observed_at,last_confirmed_at,status,source_summary,importance,memory_scope,permanence,provenance)
    values(v_student_id,'study_pattern','preferred_study_hour_observed','Observed practice is most frequent around '||lpad(v_peak_hour::text,2,'0')||':00 East Africa Time.',least(0.85,0.35+least(v_peak_count,15)*0.03),v_peak_count,now()-interval '60 days',now(),'active',jsonb_build_object('source','student_practice_attempts','timezone','Africa/Nairobi','peak_hour',v_peak_hour,'attempts_at_peak_hour',v_peak_count),0.4,'learner','adaptive',jsonb_build_object('table','student_practice_attempts'))
    on conflict(student_id,memory_type,claim_key) do update set confidence=excluded.confidence,evidence_count=excluded.evidence_count,last_confirmed_at=excluded.last_confirmed_at,status='active',source_summary=excluded.source_summary,importance=excluded.importance,provenance=excluded.provenance,updated_at=now();
    get diagnostics v_count=row_count; v_upserts:=v_upserts+v_count;
  end if;

  select count(*),count(*) filter(where status::text='present'),count(*) filter(where is_late=true) into v_attendance_total,v_present,v_late from public.attendance where student_id=v_student_id and date>=current_date-90;
  if v_attendance_total>=5 then
    insert into public.student_twin_memory_claims(student_id,memory_type,claim_key,claim_text,confidence,evidence_count,first_observed_at,last_confirmed_at,status,source_summary,importance,learning_impact,memory_scope,permanence,provenance)
    values(v_student_id,'attendance_pattern','attendance_90d','Recent attendance pattern is based on marked school attendance.',least(0.95,0.5+least(v_attendance_total,30)*0.015),v_attendance_total,now()-interval '90 days',now(),'active',jsonb_build_object('present',v_present,'late',v_late,'total',v_attendance_total,'attendance_rate',round(v_present::numeric/nullif(v_attendance_total,0),4)),0.6,round((v_present::numeric/nullif(v_attendance_total,0))*2-1,4),'learner','durable',jsonb_build_object('table','attendance'))
    on conflict(student_id,memory_type,claim_key) do update set confidence=excluded.confidence,evidence_count=excluded.evidence_count,last_confirmed_at=excluded.last_confirmed_at,status='active',source_summary=excluded.source_summary,importance=excluded.importance,learning_impact=excluded.learning_impact,provenance=excluded.provenance,updated_at=now();
    get diagnostics v_count=row_count; v_upserts:=v_upserts+v_count;
  end if;

  select count(*),coalesce(sum(active_seconds),0),count(*) filter(where completed_at is not null) into v_read_sessions,v_read_seconds,v_books_completed from public.vibe_reading_sessions where viewer_id=v_uid and started_at>=now()-interval '90 days';
  if v_read_sessions>=2 then
    insert into public.student_twin_memory_claims(student_id,memory_type,claim_key,claim_text,confidence,evidence_count,first_observed_at,last_confirmed_at,status,source_summary,importance,learning_impact,memory_scope,permanence,provenance)
    values(v_student_id,'reading_pattern','reading_90d','Recent VibeLearn reading activity is established from recorded reading sessions.',least(0.9,0.4+least(v_read_sessions,20)*0.025),v_read_sessions,now()-interval '90 days',now(),'active',jsonb_build_object('sessions',v_read_sessions,'active_seconds',v_read_seconds,'completed_sessions',v_books_completed),0.55,least(1,v_read_seconds::numeric/(60*60*10)),'learner','adaptive',jsonb_build_object('table','vibe_reading_sessions'))
    on conflict(student_id,memory_type,claim_key) do update set confidence=excluded.confidence,evidence_count=excluded.evidence_count,last_confirmed_at=excluded.last_confirmed_at,status='active',source_summary=excluded.source_summary,importance=excluded.importance,learning_impact=excluded.learning_impact,provenance=excluded.provenance,updated_at=now();
    get diagnostics v_count=row_count; v_upserts:=v_upserts+v_count;
  end if;

  select count(*),count(*) filter(where lifecycle='completed'),count(*) filter(where lifecycle='returned') into v_tasks,v_completed_tasks,v_returned_tasks from public.student_task_execution_receipts where student_id=v_student_id and updated_at>=now()-interval '90 days';
  if v_tasks>=2 then
    insert into public.student_twin_memory_claims(student_id,memory_type,claim_key,claim_text,confidence,evidence_count,first_observed_at,last_confirmed_at,status,source_summary,importance,learning_impact,memory_scope,permanence,provenance)
    values(v_student_id,'task_pattern','task_execution_90d','Recent assigned-task execution pattern is based on authoritative task receipts.',least(0.95,0.45+least(v_tasks,20)*0.025),v_tasks,now()-interval '90 days',now(),'active',jsonb_build_object('tasks',v_tasks,'completed',v_completed_tasks,'returned',v_returned_tasks,'completion_rate',round(v_completed_tasks::numeric/nullif(v_tasks,0),4)),0.75,round((v_completed_tasks::numeric/nullif(v_tasks,0))*2-1,4),'learner','durable',jsonb_build_object('table','student_task_execution_receipts'))
    on conflict(student_id,memory_type,claim_key) do update set confidence=excluded.confidence,evidence_count=excluded.evidence_count,last_confirmed_at=excluded.last_confirmed_at,status='active',source_summary=excluded.source_summary,importance=excluded.importance,learning_impact=excluded.learning_impact,provenance=excluded.provenance,updated_at=now();
    get diagnostics v_count=row_count; v_upserts:=v_upserts+v_count;
  end if;

  select count(*),avg(percentage) filter(where percentage is not null) into v_assessments,v_avg_pct from public.assessment_attempts where student_id=v_student_id and result_status='released' and coalesce(submitted_at,updated_at)>=now()-interval '180 days';
  if v_assessments>=1 then
    insert into public.student_twin_memory_claims(student_id,memory_type,claim_key,claim_text,confidence,evidence_count,first_observed_at,last_confirmed_at,status,source_summary,importance,learning_impact,memory_scope,permanence,provenance)
    values(v_student_id,'assessment_pattern','released_assessments_180d','Released assessment performance is part of the learner memory.',least(0.98,0.6+least(v_assessments,10)*0.035),v_assessments,now()-interval '180 days',now(),'active',jsonb_build_object('attempts',v_assessments,'average_percentage',round(coalesce(v_avg_pct,0),2)),0.9,round((coalesce(v_avg_pct,50)-50)/50,4),'learner','historical',jsonb_build_object('table','assessment_attempts','result_status','released'))
    on conflict(student_id,memory_type,claim_key) do update set confidence=excluded.confidence,evidence_count=excluded.evidence_count,last_confirmed_at=excluded.last_confirmed_at,status='active',source_summary=excluded.source_summary,importance=excluded.importance,learning_impact=excluded.learning_impact,provenance=excluded.provenance,updated_at=now();
    get diagnostics v_count=row_count; v_upserts:=v_upserts+v_count;
  end if;

  insert into public.student_twin_memory_claims(student_id,memory_type,claim_key,claim_text,confidence,evidence_count,first_observed_at,last_confirmed_at,status,source_summary,importance,learning_impact,memory_scope,permanence,relationship_refs,provenance)
  select v_student_id,'teacher_feedback','homework_feedback:'||hs.id::text,'Teacher feedback was released for a homework submission.',0.98,1,coalesce(hs.feedback_released_at,hs.reviewed_at,hs.updated_at),coalesce(hs.feedback_released_at,hs.reviewed_at,hs.updated_at),'active',jsonb_build_object('feedback',hs.feedback,'mark',hs.mark,'homework_id',hs.homework_id,'revision_number',hs.revision_number),0.95,null,'learner','historical',jsonb_build_object('homework_id',hs.homework_id),jsonb_build_object('table','homework_submissions','row_id',hs.id)
  from public.homework_submissions hs where hs.student_id=v_student_id and hs.feedback_released_at is not null
  on conflict(student_id,memory_type,claim_key) do update set claim_text=excluded.claim_text,confidence=excluded.confidence,last_confirmed_at=excluded.last_confirmed_at,status='active',source_summary=excluded.source_summary,importance=excluded.importance,relationship_refs=excluded.relationship_refs,provenance=excluded.provenance,updated_at=now();
  get diagnostics v_count=row_count; v_upserts:=v_upserts+v_count;

  select count(*) into v_learning_events from public.student_learning_events where student_id=v_student_id and occurred_at>=now()-interval '90 days';
  if v_learning_events>=1 then
    insert into public.student_twin_memory_claims(student_id,memory_type,claim_key,claim_text,confidence,evidence_count,first_observed_at,last_confirmed_at,status,source_summary,importance,memory_scope,permanence,provenance)
    values(v_student_id,'learning_fact','learning_events_90d','Verified learning events have been recorded recently.',least(0.95,0.5+least(v_learning_events,20)*0.02),v_learning_events,now()-interval '90 days',now(),'active',jsonb_build_object('count',v_learning_events),0.7,'learner','durable',jsonb_build_object('table','student_learning_events'))
    on conflict(student_id,memory_type,claim_key) do update set confidence=excluded.confidence,evidence_count=excluded.evidence_count,last_confirmed_at=excluded.last_confirmed_at,status='active',source_summary=excluded.source_summary,importance=excluded.importance,provenance=excluded.provenance,updated_at=now();
    get diagnostics v_count=row_count; v_upserts:=v_upserts+v_count;
  end if;

  select count(*) into v_revision_done from public.student_revision_plan_items where student_id=v_uid and status='completed' and completed_at>=now()-interval '90 days';
  if v_revision_done>=1 then
    insert into public.student_twin_memory_claims(student_id,memory_type,claim_key,claim_text,confidence,evidence_count,first_observed_at,last_confirmed_at,status,source_summary,importance,learning_impact,memory_scope,permanence,provenance)
    values(v_student_id,'revision_pattern','revision_completion_90d','Recent revision-plan completion is recorded.',least(0.9,0.45+least(v_revision_done,15)*0.025),v_revision_done,now()-interval '90 days',now(),'active',jsonb_build_object('completed_items',v_revision_done),0.6,least(1,v_revision_done/10.0),'learner','adaptive',jsonb_build_object('table','student_revision_plan_items'))
    on conflict(student_id,memory_type,claim_key) do update set confidence=excluded.confidence,evidence_count=excluded.evidence_count,last_confirmed_at=excluded.last_confirmed_at,status='active',source_summary=excluded.source_summary,importance=excluded.importance,learning_impact=excluded.learning_impact,provenance=excluded.provenance,updated_at=now();
    get diagnostics v_count=row_count; v_upserts:=v_upserts+v_count;
  end if;

  update public.student_twin_memory_claims mc set status='weakening',updated_at=now()
   where mc.student_id=v_student_id and mc.status='active' and mc.permanence in ('adaptive','ephemeral') and mc.last_confirmed_at<now()-interval '60 days';
  get diagnostics v_count=row_count; v_aged:=v_aged+v_count;
  update public.student_twin_memory_claims mc set status='retired',updated_at=now()
   where mc.student_id=v_student_id and mc.status='weakening' and mc.permanence in ('adaptive','ephemeral') and mc.last_confirmed_at<now()-interval '120 days';
  get diagnostics v_count=row_count; v_aged:=v_aged+v_count;

  return jsonb_build_object('ok',true,'student_id',v_student_id,'upserts',v_upserts,'aged_claims',v_aged,'sources',jsonb_build_object('practice_attempts',v_attempts,'attendance',v_attendance_total,'reading_sessions',v_read_sessions,'task_receipts',v_tasks,'released_assessments',v_assessments,'learning_events',v_learning_events,'revision_completed',v_revision_done));
end;$function$;

create or replace function public.student_get_twin_memory()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_uid uuid:=auth.uid(); v_student_id uuid; v_claims jsonb; v_effects jsonb; v_refresh jsonb;
begin
  perform public.hq_require_policy_enabled('twin','twin.enabled');
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;
  v_refresh:=public.student_refresh_twin_memory();
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'type',memory_type,'claim_key',claim_key,'claim',claim_text,'subject_id',subject_id,'outcome_id',outcome_id,'confidence',confidence,'evidence_count',evidence_count,'importance',importance,'learning_impact',learning_impact,'permanence',permanence,'scope',memory_scope,'relationships',relationship_refs,'provenance',provenance,'status',status,'last_confirmed_at',last_confirmed_at,'expires_at',expires_at,'source',source_summary) order by importance desc,confidence desc,last_confirmed_at desc),'[]'::jsonb) into v_claims from public.student_twin_memory_claims where student_id=v_student_id and status<>'retired';
  select coalesce(jsonb_agg(jsonb_build_object('intervention_type',intervention_type,'intervention_key',intervention_key,'outcome_id',outcome_id,'attempts',attempts,'successes',successes,'effectiveness_score',effectiveness_score,'confidence',confidence,'last_observed_at',last_observed_at,'mean_mastery_delta',mean_mastery_delta) order by confidence desc,effectiveness_score desc),'[]'::jsonb) into v_effects from public.student_twin_intervention_effects where student_id=v_student_id;
  return jsonb_build_object('student_id',v_student_id,'claims',v_claims,'intervention_effects',v_effects,'refresh',v_refresh,'rule','every_meaningful_educational_interaction_can_become_weighted_memory; facts persist; adaptive claims decay');
end;$function$;

revoke all on function public.student_refresh_twin_memory() from public,anon;
grant execute on function public.student_refresh_twin_memory() to authenticated;
revoke all on function public.student_get_twin_memory() from public,anon;
grant execute on function public.student_get_twin_memory() to authenticated;
