-- STUDENT-TASK-003 — personalized learning path

create table if not exists public.student_learning_recommendations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid null references public.subjects(id) on delete set null,
  outcome_id uuid null references public.curriculum_learning_outcomes(id) on delete set null,
  recommendation_type text not null check (recommendation_type in ('revise','practice','learn_next','intervention','teacher_priority')),
  title text not null,
  reason text not null,
  confidence_score numeric not null default 0 check (confidence_score between 0 and 1),
  priority_score numeric not null default 0,
  source_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','completed','dismissed','superseded')),
  next_review_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id,recommendation_type,outcome_id,status)
);
alter table public.student_learning_recommendations enable row level security;
drop policy if exists student_learning_recommendations_select_own on public.student_learning_recommendations;
create policy student_learning_recommendations_select_own on public.student_learning_recommendations for select to authenticated using (student_id=public.funhub_get_student_id());
revoke all on public.student_learning_recommendations from anon,public;
grant select on public.student_learning_recommendations to authenticated;

create table if not exists public.student_learning_timeline (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  event_type text not null,
  source_type text not null,
  source_id uuid null,
  subject_id uuid null references public.subjects(id) on delete set null,
  title text not null,
  summary text null,
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  unique(student_id,event_type,source_type,source_id,occurred_at)
);
alter table public.student_learning_timeline enable row level security;
drop policy if exists student_learning_timeline_select_own on public.student_learning_timeline;
create policy student_learning_timeline_select_own on public.student_learning_timeline for select to authenticated using (student_id=public.funhub_get_student_id());
revoke all on public.student_learning_timeline from anon,public;
grant select on public.student_learning_timeline to authenticated;

create or replace function public.student_refresh_personalized_path()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  caller uuid:=auth.uid(); learner public.students%rowtype; recs jsonb:='[]'::jsonb; timeline jsonb:='[]'::jsonb; tasks jsonb:='[]'::jsonb; next_mission jsonb; dashboard jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into learner from public.students where profile_id=caller and deleted_at is null limit 1;
  if not found then raise exception 'learner_identity_not_found'; end if;
  update public.student_learning_recommendations set status='superseded',updated_at=now() where student_id=learner.id and status='active';
  insert into public.student_learning_recommendations(student_id,outcome_id,recommendation_type,title,reason,confidence_score,priority_score,source_snapshot,next_review_at)
  select learner.id,som.outcome_id,
    case when coalesce(som.mastery_score,0)<40 then 'intervention' when coalesce(som.mastery_score,0)<70 then 'practice' else 'revise' end,
    coalesce(clo.outcome_code||' — ','')||clo.outcome_text,
    case when coalesce(som.mastery_score,0)<40 then 'This outcome needs focused support.' when coalesce(som.mastery_score,0)<70 then 'More guided practice will strengthen this outcome.' else 'A short review will protect this mastery.' end,
    least(1,greatest(0,coalesce(som.evidence_count,0)/5.0)),
    (100-coalesce(som.mastery_score,0)) + greatest(0,5-coalesce(som.evidence_count,0))*5 + case when som.last_evidence_at is null or som.last_evidence_at<now()-interval '14 days' then 15 else 0 end,
    jsonb_build_object('mastery_score',som.mastery_score,'mastery_level',som.mastery_level,'evidence_count',som.evidence_count,'last_evidence_at',som.last_evidence_at),
    case when coalesce(som.mastery_score,0)<40 then now() when coalesce(som.mastery_score,0)<70 then now()+interval '2 days' else now()+interval '7 days' end
  from public.student_outcome_mastery som join public.curriculum_learning_outcomes clo on clo.id=som.outcome_id
  where som.student_id=learner.id and clo.status in ('active','verified') order by priority_score desc limit 12;
  insert into public.student_learning_recommendations(student_id,subject_id,outcome_id,recommendation_type,title,reason,confidence_score,priority_score,source_snapshot,next_review_at)
  select learner.id,ai.subject_id,ai.outcome_id,'teacher_priority',ai.recommendation,'Your teacher has identified this as an important next step.',least(1,greatest(0,ai.confidence_score)),200 + case ai.priority when 'urgent' then 100 when 'high' then 60 else 30 end,jsonb_build_object('intervention_id',ai.id,'mastery_score',ai.mastery_score,'evidence_count',ai.evidence_count,'due_at',ai.due_at),coalesce(ai.due_at,now())
  from public.assessment_interventions ai where ai.student_id=learner.id and ai.status in ('open','active','planned') on conflict do nothing;
  insert into public.student_learning_timeline(student_id,event_type,source_type,source_id,subject_id,title,summary,occurred_at,metadata)
  select learner.id,'task_completed',sle.source_type,sle.source_id,sle.subject_id,'Task completed',sle.event_type,sle.occurred_at,jsonb_build_object('xp_awarded',sle.xp_awarded)
  from public.student_learning_events sle where sle.student_id=learner.id on conflict do nothing;
  insert into public.student_learning_timeline(student_id,event_type,source_type,source_id,title,summary,occurred_at,metadata)
  select learner.id,'assessment_result','assessment',aa.id,'Assessment result',coalesce(aa.feedback,''),coalesce(aa.teacher_reviewed_at,aa.submitted_at,aa.updated_at),jsonb_build_object('score',aa.score,'max_score',aa.max_score,'percentage',aa.percentage,'result_status',aa.result_status)
  from public.assessment_attempts aa where aa.student_id=learner.id and aa.status in ('submitted','marked','released') on conflict do nothing;
  insert into public.student_learning_timeline(student_id,event_type,source_type,source_id,title,summary,occurred_at,metadata)
  select learner.id,'homework_result','homework',hs.id,'Homework feedback',coalesce(hs.feedback,''),coalesce(hs.returned_at,hs.submitted_at,hs.updated_at),jsonb_build_object('mark',hs.mark,'status',hs.status,'revision_number',hs.revision_number)
  from public.homework_submissions hs where hs.student_id=learner.id and hs.status in ('submitted','marked','returned') on conflict do nothing;
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'subject_id',r.subject_id,'outcome_id',r.outcome_id,'type',r.recommendation_type,'title',r.title,'reason',r.reason,'confidence',r.confidence_score,'priority',r.priority_score,'next_review_at',r.next_review_at) order by r.priority_score desc),'[]'::jsonb) into recs from public.student_learning_recommendations r where r.student_id=learner.id and r.status='active';
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'event_type',t.event_type,'source_type',t.source_type,'source_id',t.source_id,'subject_id',t.subject_id,'title',t.title,'summary',t.summary,'occurred_at',t.occurred_at,'metadata',t.metadata) order by t.occurred_at desc),'[]'::jsonb) into timeline from (select * from public.student_learning_timeline where student_id=learner.id order by occurred_at desc limit 50) t;
  tasks:=coalesce(public.student_list_my_tasks()->'tasks','[]'::jsonb);
  select value into next_mission from (select value,case value->>'status' when 'overdue' then 1000 when 'returned' then 900 when 'in_progress' then 800 when 'ready' then 700 when 'upcoming' then 300 else 0 end + case value->>'priority' when 'urgent' then 300 when 'high' then 150 else 0 end + case when nullif(value->>'due_at','')::timestamptz is not null then greatest(0,200-extract(epoch from (nullif(value->>'due_at','')::timestamptz-now()))/3600) else 0 end as mission_score from jsonb_array_elements(tasks) value where coalesce(value->>'status','') in ('overdue','returned','in_progress','ready','upcoming')) ranked order by mission_score desc limit 1;
  dashboard:=jsonb_build_object('student_id',learner.id,'recommendations',recs,'timeline',timeline,'next_mission',next_mission,'motivation',public.student_refresh_motivation_summary());
  return dashboard;
end;
$$;
revoke all on function public.student_refresh_personalized_path() from public,anon;
grant execute on function public.student_refresh_personalized_path() to authenticated;

create or replace function public.teacher_get_student_personalized_path(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare caller uuid:=auth.uid(); allowed boolean:=false; result jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select exists(select 1 from public.teacher_classes tc where tc.teacher_id=caller and tc.class_id in (select sc.class_id from public.student_classes sc where sc.student_id=p_student_id and sc.is_current=true)) into allowed;
  if not allowed then raise exception 'not_authorized'; end if;
  select jsonb_build_object('student_id',p_student_id,'recommendations',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'subject_id',r.subject_id,'outcome_id',r.outcome_id,'type',r.recommendation_type,'title',r.title,'reason',r.reason,'confidence',r.confidence_score,'priority',r.priority_score,'next_review_at',r.next_review_at) order by r.priority_score desc) from public.student_learning_recommendations r where r.student_id=p_student_id and r.status='active'),'[]'::jsonb),'timeline',coalesce((select jsonb_agg(jsonb_build_object('event_type',t.event_type,'source_type',t.source_type,'title',t.title,'summary',t.summary,'occurred_at',t.occurred_at,'metadata',t.metadata) order by t.occurred_at desc) from (select * from public.student_learning_timeline where student_id=p_student_id order by occurred_at desc limit 30) t),'[]'::jsonb),'subject_progress',coalesce((select jsonb_agg(jsonb_build_object('subject_id',p.subject_id,'completed_tasks',p.completed_tasks,'total_tasks',p.total_tasks,'average_score',p.average_score,'mastery_percentage',p.mastery_percentage) order by p.updated_at desc) from public.student_subject_progress p where p.student_id=p_student_id),'[]'::jsonb)) into result;
  return result;
end;
$$;
revoke all on function public.teacher_get_student_personalized_path(uuid) from public,anon;
grant execute on function public.teacher_get_student_personalized_path(uuid) to authenticated;
