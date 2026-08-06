create table if not exists public.student_revision_plan_items (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  plan_date date not null,
  subject text not null,
  topic text not null,
  activity_type text not null check (activity_type in ('practice','read','review_mistakes','timed_paper','teacher_assessment')),
  target_minutes integer not null check (target_minutes between 5 and 180),
  priority integer not null default 3 check (priority between 1 and 5),
  reason text not null,
  action_url text not null,
  status text not null default 'planned' check (status in ('planned','in_progress','completed','skipped')),
  completed_at timestamptz,
  source jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, plan_date, subject, topic, activity_type)
);
create table if not exists public.student_practice_attempts (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id) on delete cascade,
  exam_question_id uuid not null references public.exam_question_bank(id) on delete cascade, selected_index integer,
  correct_index integer not null, is_correct boolean not null, subject text not null, topic text not null, difficulty text,
  attempted_at timestamptz not null default now(), response_ms integer, session_id uuid, source text not null default 'vibelearn_practice'
);
create table if not exists public.student_mistake_notebook (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id) on delete cascade,
  exam_question_id uuid not null references public.exam_question_bank(id) on delete cascade, subject text not null, topic text not null,
  prompt_snapshot text not null, selected_index integer, correct_index integer not null, explanation_snapshot text, hint_snapshot text,
  repeat_count integer not null default 1 check (repeat_count >= 1), status text not null default 'open' check (status in ('open','practising','resolved')),
  first_missed_at timestamptz not null default now(), last_missed_at timestamptz not null default now(), resolved_at timestamptz, last_correct_at timestamptz,
  unique(student_id, exam_question_id)
);
create table if not exists public.student_topic_notes (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null, topic text not null, note_text text not null check (char_length(note_text) between 1 and 5000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(student_id, subject, topic)
);
create index if not exists student_revision_plan_student_date_idx on public.student_revision_plan_items(student_id, plan_date, priority);
create index if not exists student_practice_attempts_student_topic_idx on public.student_practice_attempts(student_id, subject, topic, attempted_at desc);
create index if not exists student_mistake_notebook_student_status_idx on public.student_mistake_notebook(student_id, status, last_missed_at desc);
create index if not exists student_topic_notes_student_idx on public.student_topic_notes(student_id, subject, topic);
alter table public.student_revision_plan_items enable row level security;
alter table public.student_practice_attempts enable row level security;
alter table public.student_mistake_notebook enable row level security;
alter table public.student_topic_notes enable row level security;
create policy student_revision_plan_own on public.student_revision_plan_items for all to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy student_practice_attempts_own on public.student_practice_attempts for select to authenticated using (student_id = auth.uid());
create policy student_mistakes_own on public.student_mistake_notebook for all to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy student_topic_notes_own on public.student_topic_notes for all to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());

create or replace function public.student_generate_revision_plan(p_start_date date default current_date, p_days integer default 7)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_student uuid := auth.uid(); v_daily integer := 60; v_days integer := greatest(1,least(coalesce(p_days,7),14)); v_date date; v_added integer := 0; r record;
begin
 if v_student is null then raise exception 'Authentication required'; end if;
 select coalesce(daily_revision_minutes,60) into v_daily from public.student_exam_readiness_state where student_id=v_student;
 v_daily:=coalesce(v_daily,60);
 for i in 0..v_days-1 loop
  v_date:=p_start_date+i;
  for r in with weakness as (
    select q.subject::text subject,q.topic,count(*) filter(where not pa.is_correct) misses,count(*) attempts
    from public.exam_question_bank q left join public.student_practice_attempts pa on pa.exam_question_id=q.id and pa.student_id=v_student
    where q.status='published' and q.form::text='Form 4' group by q.subject,q.topic
  ) select subject,topic,case when misses>0 then 1 when attempts=0 then 2 else 3 end priority,
    case when misses>0 then 'Recover a topic you have missed before.' when attempts=0 then 'Build exam familiarity with an unpractised topic.' else 'Keep this topic active before the exam.' end reason
    from weakness order by case when misses>0 then 0 when attempts=0 then 1 else 2 end,misses desc,attempts asc,subject,topic limit 3
  loop
   insert into public.student_revision_plan_items(student_id,plan_date,subject,topic,activity_type,target_minutes,priority,reason,action_url,source)
   values(v_student,v_date,r.subject,r.topic,case when r.priority=1 then 'review_mistakes' else 'practice' end,greatest(10,least(45,v_daily/3)),r.priority,r.reason,
     '/student/vibelearn/topic?subject='||urlencode(r.subject)||'&topic='||urlencode(r.topic),jsonb_build_object('generated_by','student_generate_revision_plan'))
   on conflict(student_id,plan_date,subject,topic,activity_type) do nothing;
   if found then v_added:=v_added+1; end if;
  end loop;
 end loop;
 return jsonb_build_object('added',v_added,'days',v_days,'start_date',p_start_date);
end $$;

create or replace function public.student_record_vibelearn_practice_answer(p_exam_question_id uuid,p_selected_index integer,p_response_ms integer default null,p_session_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_student uuid:=auth.uid(); q record; v_correct boolean; v_mistake_id uuid;
begin
 if v_student is null then raise exception 'Authentication required'; end if;
 select id,subject::text subject,topic,difficulty::text difficulty,question,correct_index,explanation,hint into q from public.exam_question_bank where id=p_exam_question_id and status='published';
 if q.id is null then raise exception 'Question not available'; end if;
 v_correct:=p_selected_index=q.correct_index;
 insert into public.student_practice_attempts(student_id,exam_question_id,selected_index,correct_index,is_correct,subject,topic,difficulty,response_ms,session_id)
 values(v_student,q.id,p_selected_index,q.correct_index,v_correct,q.subject,q.topic,q.difficulty,p_response_ms,p_session_id);
 if not v_correct then
  insert into public.student_mistake_notebook(student_id,exam_question_id,subject,topic,prompt_snapshot,selected_index,correct_index,explanation_snapshot,hint_snapshot)
  values(v_student,q.id,q.subject,q.topic,q.question,p_selected_index,q.correct_index,q.explanation,q.hint)
  on conflict(student_id,exam_question_id) do update set selected_index=excluded.selected_index,repeat_count=public.student_mistake_notebook.repeat_count+1,status='open',last_missed_at=now(),resolved_at=null;
  select id into v_mistake_id from public.student_mistake_notebook where student_id=v_student and exam_question_id=q.id;
 else
  update public.student_mistake_notebook set last_correct_at=now(),status=case when repeat_count<=1 then 'resolved' else 'practising' end,resolved_at=case when repeat_count<=1 then now() else resolved_at end
  where student_id=v_student and exam_question_id=q.id;
 end if;
 insert into public.student_learning_events(student_id,event_type,source_type,source_id,xp_awarded,occurred_at,metadata)
 values(v_student,'practice_answered','exam_question',q.id,case when v_correct then 2 else 1 end,now(),jsonb_build_object('subject',q.subject,'topic',q.topic,'correct',v_correct));
 return jsonb_build_object('correct',v_correct,'correct_index',q.correct_index,'explanation',q.explanation,'hint',q.hint,'mistake_id',v_mistake_id);
end $$;

create or replace function public.student_resolve_mistake(p_mistake_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_student uuid:=auth.uid(); begin if v_student is null then raise exception 'Authentication required'; end if; update public.student_mistake_notebook set status='resolved',resolved_at=now() where id=p_mistake_id and student_id=v_student; if not found then raise exception 'Mistake not found'; end if; return jsonb_build_object('resolved',true,'id',p_mistake_id); end $$;
create or replace function public.student_save_topic_note(p_subject text,p_topic text,p_note_text text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_student uuid:=auth.uid(); v_id uuid; begin if v_student is null then raise exception 'Authentication required'; end if; if nullif(btrim(p_subject),'') is null or nullif(btrim(p_topic),'') is null or nullif(btrim(p_note_text),'') is null then raise exception 'Subject, topic and note are required'; end if; insert into public.student_topic_notes(student_id,subject,topic,note_text) values(v_student,btrim(p_subject),btrim(p_topic),btrim(p_note_text)) on conflict(student_id,subject,topic) do update set note_text=excluded.note_text,updated_at=now() returning id into v_id; return jsonb_build_object('saved',true,'id',v_id); end $$;

create or replace function public.student_get_revision_workspace(p_subject text default null,p_topic text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_student uuid:=auth.uid(); v_readiness jsonb; v_days integer; v_mode text;
begin
 if v_student is null then raise exception 'Authentication required'; end if;
 select public.student_get_exam_readiness_brief() into v_readiness; v_days:=coalesce((v_readiness->>'days_remaining')::integer,999);
 v_mode:=case when v_days<=14 then 'final_sprint' when v_days<=60 then 'exam_revision' else 'steady_revision' end;
 return jsonb_build_object(
  'revision_mode',jsonb_build_object('mode',v_mode,'days_remaining',v_days,'message',case v_mode when 'final_sprint' then 'Protect sleep, practise under time, and review mistakes—not everything.' when 'exam_revision' then 'Use focused daily practice and weekly full-paper simulation.' else 'Build mastery steadily and close weak-topic gaps.' end),
  'today_plan',coalesce((select jsonb_agg(jsonb_build_object('id',id,'date',plan_date,'subject',subject,'topic',topic,'activity_type',activity_type,'target_minutes',target_minutes,'priority',priority,'reason',reason,'action_url',action_url,'status',status) order by priority,subject,topic) from public.student_revision_plan_items where student_id=v_student and plan_date=current_date),'[]'::jsonb),
  'week_plan',coalesce((select jsonb_agg(jsonb_build_object('id',id,'date',plan_date,'subject',subject,'topic',topic,'activity_type',activity_type,'target_minutes',target_minutes,'priority',priority,'reason',reason,'action_url',action_url,'status',status) order by plan_date,priority) from public.student_revision_plan_items where student_id=v_student and plan_date between current_date and current_date+6),'[]'::jsonb),
  'mistakes',coalesce((select jsonb_agg(jsonb_build_object('id',id,'question_id',exam_question_id,'subject',subject,'topic',topic,'prompt',prompt_snapshot,'selected_index',selected_index,'correct_index',correct_index,'explanation',explanation_snapshot,'hint',hint_snapshot,'repeat_count',repeat_count,'status',status,'last_missed_at',last_missed_at) order by case status when 'open' then 0 when 'practising' then 1 else 2 end,repeat_count desc,last_missed_at desc) from public.student_mistake_notebook where student_id=v_student limit 40),'[]'::jsonb),
  'weak_topics',coalesce((select jsonb_agg(x) from (select subject,topic,count(*) filter(where not is_correct) misses,count(*) attempts,round(100.0*avg(case when is_correct then 1 else 0 end),0) accuracy from public.student_practice_attempts where student_id=v_student group by subject,topic order by misses desc,accuracy asc limit 12)x),'[]'::jsonb),
  'journey',jsonb_build_object('practice_attempts',(select count(*) from public.student_practice_attempts where student_id=v_student),'correct_answers',(select count(*) from public.student_practice_attempts where student_id=v_student and is_correct),'open_mistakes',(select count(*) from public.student_mistake_notebook where student_id=v_student and status<>'resolved'),'resolved_mistakes',(select count(*) from public.student_mistake_notebook where student_id=v_student and status='resolved'),'books_started',(select count(distinct publication_id) from public.vibe_reading_progress where viewer_id=v_student),'chapters_completed',(select count(*) from public.vibe_reading_progress where viewer_id=v_student and completed_at is not null),'learning_events_30d',(select count(*) from public.student_learning_events where student_id=v_student and occurred_at>=now()-interval '30 days')),
  'topic_workspace',case when nullif(btrim(coalesce(p_subject,'')),'') is null or nullif(btrim(coalesce(p_topic,'')),'') is null then null else jsonb_build_object('subject',p_subject,'topic',p_topic,'note',(select note_text from public.student_topic_notes where student_id=v_student and lower(subject)=lower(p_subject) and lower(topic)=lower(p_topic)),'resources',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description,'source_type',source_type,'publication_id',publication_id,'chapter_id',chapter_id)) from public.learning_resources where status='published' and lower(coalesce(subject,''))=lower(p_subject) and (lower(coalesce(strand,''))=lower(p_topic) or title ilike '%'||p_topic||'%') limit 12),'[]'::jsonb),'questions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'difficulty',difficulty::text,'question',question,'options',options,'hint',hint,'explanation',explanation)) from public.exam_question_bank where status='published' and lower(subject::text)=lower(p_subject) and lower(topic)=lower(p_topic) limit 20),'[]'::jsonb),'mistakes',coalesce((select jsonb_agg(jsonb_build_object('id',id,'question_id',exam_question_id,'prompt',prompt_snapshot,'repeat_count',repeat_count,'status',status)) from public.student_mistake_notebook where student_id=v_student and lower(subject)=lower(p_subject) and lower(topic)=lower(p_topic)),'[]'::jsonb),'stats',jsonb_build_object('attempts',(select count(*) from public.student_practice_attempts where student_id=v_student and lower(subject)=lower(p_subject) and lower(topic)=lower(p_topic)),'accuracy',(select round(100.0*avg(case when is_correct then 1 else 0 end),0) from public.student_practice_attempts where student_id=v_student and lower(subject)=lower(p_subject) and lower(topic)=lower(p_topic)))) end
 );
end $$;

revoke all on function public.student_generate_revision_plan(date,integer) from public,anon;
revoke all on function public.student_record_vibelearn_practice_answer(uuid,integer,integer,uuid) from public,anon;
revoke all on function public.student_resolve_mistake(uuid) from public,anon;
revoke all on function public.student_save_topic_note(text,text,text) from public,anon;
revoke all on function public.student_get_revision_workspace(text,text) from public,anon;
grant execute on function public.student_generate_revision_plan(date,integer) to authenticated;
grant execute on function public.student_record_vibelearn_practice_answer(uuid,integer,integer,uuid) to authenticated;
grant execute on function public.student_resolve_mistake(uuid) to authenticated;
grant execute on function public.student_save_topic_note(text,text,text) to authenticated;
grant execute on function public.student_get_revision_workspace(text,text) to authenticated;
