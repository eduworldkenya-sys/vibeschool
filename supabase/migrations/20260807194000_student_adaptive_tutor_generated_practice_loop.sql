create table if not exists public.student_generated_practice_questions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  outcome_id uuid not null references public.curriculum_learning_outcomes(id) on delete restrict,
  subject_id uuid null references public.subjects(id) on delete set null,
  prompt text not null,
  options jsonb not null,
  correct_index integer not null,
  explanation text not null,
  hints jsonb not null default '[]'::jsonb,
  difficulty text not null,
  generation_source text not null default 'deterministic_adaptive_seed',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  answered_at timestamptz null,
  constraint student_generated_practice_questions_options_array check (jsonb_typeof(options)='array' and jsonb_array_length(options)>=2),
  constraint student_generated_practice_questions_hints_array check (jsonb_typeof(hints)='array'),
  constraint student_generated_practice_questions_correct_index_check check (correct_index>=0 and correct_index<jsonb_array_length(options)),
  constraint student_generated_practice_questions_difficulty_check check (difficulty in ('scaffolded','easy','medium','hard','challenge')),
  constraint student_generated_practice_questions_status_check check (status in ('active','answered','retired'))
);

create index if not exists student_generated_practice_questions_student_created_idx on public.student_generated_practice_questions(student_id,created_at desc);
create index if not exists student_generated_practice_questions_student_outcome_idx on public.student_generated_practice_questions(student_id,outcome_id,created_at desc);

alter table public.student_generated_practice_questions enable row level security;
drop policy if exists student_generated_practice_questions_select_own on public.student_generated_practice_questions;
create policy student_generated_practice_questions_select_own on public.student_generated_practice_questions for select to authenticated using (exists(select 1 from public.students s where s.id=student_id and s.profile_id=auth.uid() and s.deleted_at is null));

create or replace function public.student_generate_adaptive_practice_question(p_outcome_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_profile_id uuid:=auth.uid(); v_student_id uuid; v_class_id uuid; v_school_id uuid; v_outcome_id uuid; v_subject_id uuid;
  v_outcome_text text; v_outcome_code text; v_mastery numeric:=0; v_effective numeric:=0; v_forgetting numeric:=0; v_difficulty text:='scaffolded';
  v_qid uuid; v_prompt text; v_options jsonb; v_correct integer:=0; v_explanation text; v_hints jsonb; v_seed integer;
begin
  if v_profile_id is null then raise exception 'Authentication required'; end if;
  select s.id, coalesce(sc.class_id,s.class_id), c.school_id into v_student_id,v_class_id,v_school_id
  from public.students s left join public.student_classes sc on sc.student_id=s.id and sc.is_current=true
  left join public.classes c on c.id=coalesce(sc.class_id,s.class_id)
  where s.profile_id=v_profile_id and s.deleted_at is null order by sc.joined_at desc nulls last limit 1;
  if v_student_id is null then raise exception 'Learner identity not found'; end if;

  if p_outcome_id is not null then
    select o.id,o.outcome_text,o.outcome_code,c.subject_id into v_outcome_id,v_outcome_text,v_outcome_code,v_subject_id
    from public.curriculum_learning_outcomes o left join public.curricula c on c.id=o.curriculum_id
    where o.id=p_outcome_id and o.status in ('active','verified') limit 1;
  else
    select m.outcome_id,o.outcome_text,o.outcome_code,c.subject_id,
           coalesce(m.mastery_score,0),coalesce(m.effective_mastery,coalesce(m.mastery_score,0)),coalesce(m.forgetting_risk,0)
      into v_outcome_id,v_outcome_text,v_outcome_code,v_subject_id,v_mastery,v_effective,v_forgetting
    from public.student_outcome_mastery m
    join public.curriculum_learning_outcomes o on o.id=m.outcome_id and o.status in ('active','verified')
    left join public.curricula c on c.id=o.curriculum_id
    where m.student_id=v_student_id
    order by coalesce(m.effective_mastery,m.mastery_score,0) asc, coalesce(m.forgetting_risk,0) desc, m.last_evidence_at asc nulls first
    limit 1;
  end if;

  if v_outcome_id is null then
    select o.id,o.outcome_text,o.outcome_code,c.subject_id into v_outcome_id,v_outcome_text,v_outcome_code,v_subject_id
    from public.curriculum_learning_outcomes o left join public.curricula c on c.id=o.curriculum_id
    where o.status in ('active','verified') order by o.created_at limit 1;
  end if;
  if v_outcome_id is null then raise exception 'No active curriculum outcome is available'; end if;

  select coalesce(m.mastery_score,0),coalesce(m.effective_mastery,coalesce(m.mastery_score,0)),coalesce(m.forgetting_risk,0)
    into v_mastery,v_effective,v_forgetting from public.student_outcome_mastery m where m.student_id=v_student_id and m.outcome_id=v_outcome_id;
  if v_effective < 40 then v_difficulty:='scaffolded'; elsif v_effective < 60 then v_difficulty:='easy'; elsif v_effective < 80 then v_difficulty:='medium'; elsif v_forgetting > 0.45 then v_difficulty:='medium'; elsif v_effective < 92 then v_difficulty:='hard'; else v_difficulty:='challenge'; end if;

  v_seed := 2 + (abs(hashtext(v_student_id::text||v_outcome_id::text||date_trunc('minute',now())::text)) % 8);
  v_prompt := format('Adaptive practice for %s: Which answer correctly shows %s? Choose the best option.', coalesce(v_outcome_code,'this outcome'), v_outcome_text);
  v_options := jsonb_build_array('A correct application of the learning outcome','A common misconception about the outcome','An unrelated fact','A statement that ignores the key condition');
  v_correct:=0;
  v_explanation:=format('The correct choice directly applies the curriculum outcome: %s',v_outcome_text);
  v_hints:=jsonb_build_array('Focus on the exact skill named in the outcome.','Eliminate choices that are unrelated or contradict the key condition.','Choose the option that demonstrates the outcome directly.');

  insert into public.student_generated_practice_questions(student_id,outcome_id,subject_id,prompt,options,correct_index,explanation,hints,difficulty)
  values(v_student_id,v_outcome_id,v_subject_id,v_prompt,v_options,v_correct,v_explanation,v_hints,v_difficulty) returning id into v_qid;

  return jsonb_build_object('id',v_qid,'outcome_id',v_outcome_id,'outcome_code',v_outcome_code,'outcome_text',v_outcome_text,'subject_id',v_subject_id,'prompt',v_prompt,'options',v_options,'difficulty',v_difficulty,'hints',v_hints,'mastery_before',v_mastery,'effective_mastery_before',v_effective,'forgetting_risk',v_forgetting);
end;$function$;

create or replace function public.student_answer_adaptive_practice_question(p_question_id uuid,p_selected_index integer,p_response_ms integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_profile_id uuid:=auth.uid(); v_student_id uuid; v_q public.student_generated_practice_questions%rowtype; v_correct boolean; v_event_id uuid; v_evidence_id uuid; v_mistake_id uuid; v_mastery_after numeric; v_effective_after numeric; v_forgetting_after numeric;
begin
  if v_profile_id is null then raise exception 'Authentication required'; end if;
  select id into v_student_id from public.students where profile_id=v_profile_id and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'Learner identity not found'; end if;
  select * into v_q from public.student_generated_practice_questions where id=p_question_id and student_id=v_student_id and status='active';
  if not found then raise exception 'Adaptive practice question not available'; end if;
  if p_selected_index<0 or p_selected_index>=jsonb_array_length(v_q.options) then raise exception 'Invalid answer option'; end if;
  if p_response_ms is not null and p_response_ms<0 then raise exception 'Invalid response time'; end if;
  v_correct:=p_selected_index=v_q.correct_index;

  insert into public.student_learning_events(student_id,event_type,source_type,source_id,subject_id,xp_awarded,occurred_at,metadata)
  values(v_profile_id,'practice_answered','adaptive_generated_question',v_q.id,v_q.subject_id,case when v_correct then 2 else 1 end,now(),jsonb_build_object('outcome_id',v_q.outcome_id,'correct',v_correct,'selected_index',p_selected_index,'correct_index',v_q.correct_index,'difficulty',v_q.difficulty,'response_ms',p_response_ms,'generation_source',v_q.generation_source)) returning id into v_event_id;

  insert into public.competency_evidence_ledger(student_id,outcome_id,evidence_source,evidence_id,score,max_score,proficiency,observed_by,observed_at,notes,weight,subject_id)
  values(v_student_id,v_q.outcome_id,'quiz',v_event_id,case when v_correct then 1 else 0 end,1,case when v_correct then 'meeting' else 'needs_intervention' end,v_profile_id,now(),'Adaptive generated practice question',1,v_q.subject_id) returning id into v_evidence_id;

  if not v_correct then
    insert into public.student_mistake_notebook(student_id,exam_question_id,subject,topic,prompt_snapshot,selected_index,correct_index,explanation_snapshot,hint_snapshot,repeat_count,status,first_missed_at,last_missed_at,outcome_id)
    values(v_profile_id,null,coalesce((select name from public.subjects where id=v_q.subject_id),'General'),coalesce((select outcome_code from public.curriculum_learning_outcomes where id=v_q.outcome_id),'Adaptive practice'),v_q.prompt,p_selected_index,v_q.correct_index,v_q.explanation,coalesce(v_q.hints->>0,'Review the learning outcome and retry.'),1,'open',now(),now(),v_q.outcome_id)
    returning id into v_mistake_id;
  end if;

  update public.student_generated_practice_questions set status='answered',answered_at=now() where id=v_q.id;
  select mastery_score,effective_mastery,forgetting_risk into v_mastery_after,v_effective_after,v_forgetting_after from public.student_outcome_mastery where student_id=v_student_id and outcome_id=v_q.outcome_id;

  return jsonb_build_object('ok',true,'correct',v_correct,'correct_index',v_q.correct_index,'explanation',v_q.explanation,'learning_event_id',v_event_id,'evidence_id',v_evidence_id,'mistake_id',v_mistake_id,'mastery_after',v_mastery_after,'effective_mastery_after',v_effective_after,'forgetting_risk_after',v_forgetting_after,'next_question',public.student_generate_adaptive_practice_question(v_q.outcome_id));
end;$function$;

revoke execute on function public.student_generate_adaptive_practice_question(uuid) from public,anon;
grant execute on function public.student_generate_adaptive_practice_question(uuid) to authenticated;
revoke execute on function public.student_answer_adaptive_practice_question(uuid,integer,integer) from public,anon;
grant execute on function public.student_answer_adaptive_practice_question(uuid,integer,integer) to authenticated;
