-- KCSE Candidate OS final-state migration.
-- Evidence-first: this migration creates capability only. It intentionally seeds no KNEC syllabus,
-- grade thresholds, paper structures, past papers or questions.

alter table public.exam_question_bank
  add column if not exists source_year integer,
  add column if not exists source_paper text,
  add column if not exists source_ref text,
  add column if not exists provenance_status text not null default 'unverified',
  add column if not exists verified_at timestamptz,
  add column if not exists empirical_difficulty numeric,
  add column if not exists calibration_sample_size integer not null default 0;

alter table public.exam_question_bank drop constraint if exists exam_question_bank_provenance_status_check;
alter table public.exam_question_bank add constraint exam_question_bank_provenance_status_check
  check (provenance_status in ('unverified','teacher_verified','publisher_verified','official_verified'));

alter table public.student_exam_readiness_state
  add column if not exists kcse_candidate_opt_in boolean not null default false;

create table if not exists public.kcse_paper_blueprints (
  id uuid primary key default gen_random_uuid(), subject text not null, paper_code text not null,
  title text not null, duration_minutes integer not null check (duration_minutes between 15 and 360),
  total_marks integer not null check (total_marks between 1 and 300), sections jsonb not null default '[]'::jsonb,
  source_type text not null default 'creator_claimed', source_ref text,
  verification_status text not null default 'draft' check (verification_status in ('draft','reviewed','verified')),
  verified_by uuid, verified_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(subject,paper_code)
);

create table if not exists public.kcse_topic_dependencies (
  id uuid primary key default gen_random_uuid(), subject text not null, topic text not null, prerequisite_topic text not null,
  source_type text not null default 'creator_claimed', source_ref text,
  verification_status text not null default 'draft' check (verification_status in ('draft','reviewed','verified')),
  verified_by uuid, verified_at timestamptz, created_at timestamptz not null default now(), unique(subject,topic,prerequisite_topic)
);

create table if not exists public.kcse_revision_assets (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null check (asset_type in ('formula','fact','definition','command_word','oral_prompt','listening_prompt','practical_prompt','essay_prompt','working_example')),
  subject text not null, topic text, prompt text not null, answer text, media_url text,
  source_type text not null default 'creator_claimed', source_ref text,
  verification_status text not null default 'draft' check (verification_status in ('draft','reviewed','verified')),
  verified_by uuid, verified_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.kcse_grade_threshold_profiles (
  id uuid primary key default gen_random_uuid(), exam_year integer not null, subject text, grade text not null,
  min_percentage numeric not null check (min_percentage between 0 and 100),
  max_percentage numeric not null check (max_percentage between 0 and 100 and max_percentage>=min_percentage),
  source_type text not null default 'creator_claimed', source_ref text,
  verification_status text not null default 'draft' check (verification_status in ('draft','reviewed','verified')),
  verified_by uuid, verified_at timestamptz, created_at timestamptz not null default now(), unique(exam_year,subject,grade)
);

create table if not exists public.student_kcse_subject_confidence (
  student_id uuid not null, subject text not null, confidence smallint not null check (confidence between 1 and 5),
  updated_at timestamptz not null default now(), primary key(student_id,subject)
);

create table if not exists public.student_kcse_error_classifications (
  id uuid primary key default gen_random_uuid(), student_id uuid not null,
  mistake_id uuid not null references public.student_mistake_notebook(id) on delete cascade,
  error_type text not null check (error_type in ('concept','formula','careless','command_word','calculation','working','time_pressure','language','unknown')),
  note text, classified_at timestamptz not null default now(), unique(student_id,mistake_id)
);

create table if not exists public.student_kcse_retest_schedule (
  id uuid primary key default gen_random_uuid(), student_id uuid not null, subject text not null, topic text not null,
  source_mistake_id uuid references public.student_mistake_notebook(id) on delete set null,
  due_date date not null, interval_days integer not null default 1 check (interval_days between 1 and 120),
  successful_retests integer not null default 0,
  mastery_state text not null default 'recovering' check (mastery_state in ('recovering','stabilising','mastered')),
  last_result boolean, last_attempt_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(student_id,subject,topic)
);

create table if not exists public.student_kcse_mock_sessions (
  id uuid primary key default gen_random_uuid(), student_id uuid not null, subject text not null, paper_code text not null,
  title text not null, duration_minutes integer not null, total_marks integer not null, question_ids uuid[] not null default '{}',
  status text not null default 'in_progress' check (status in ('in_progress','submitted','expired')),
  started_at timestamptz not null default now(), last_saved_at timestamptz not null default now(), expires_at timestamptz not null,
  submitted_at timestamptz, score numeric, max_score numeric, percentage numeric, active_client_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.student_kcse_mock_answers (
  session_id uuid not null references public.student_kcse_mock_sessions(id) on delete cascade,
  question_id uuid not null references public.exam_question_bank(id) on delete restrict,
  selected_index integer, response_text text, response_ms integer, is_correct boolean, score numeric,
  max_score numeric not null default 1, saved_at timestamptz not null default now(), primary key(session_id,question_id)
);

alter table public.kcse_paper_blueprints enable row level security;
alter table public.kcse_topic_dependencies enable row level security;
alter table public.kcse_revision_assets enable row level security;
alter table public.kcse_grade_threshold_profiles enable row level security;
alter table public.student_kcse_subject_confidence enable row level security;
alter table public.student_kcse_error_classifications enable row level security;
alter table public.student_kcse_retest_schedule enable row level security;
alter table public.student_kcse_mock_sessions enable row level security;
alter table public.student_kcse_mock_answers enable row level security;

drop policy if exists kcse_paper_blueprints_read on public.kcse_paper_blueprints;
create policy kcse_paper_blueprints_read on public.kcse_paper_blueprints for select to authenticated using (verification_status='verified');
drop policy if exists kcse_topic_dependencies_read on public.kcse_topic_dependencies;
create policy kcse_topic_dependencies_read on public.kcse_topic_dependencies for select to authenticated using (verification_status='verified');
drop policy if exists kcse_revision_assets_read on public.kcse_revision_assets;
create policy kcse_revision_assets_read on public.kcse_revision_assets for select to authenticated using (verification_status='verified');
drop policy if exists kcse_grade_threshold_profiles_read on public.kcse_grade_threshold_profiles;
create policy kcse_grade_threshold_profiles_read on public.kcse_grade_threshold_profiles for select to authenticated using (verification_status='verified');

drop policy if exists student_kcse_subject_confidence_select on public.student_kcse_subject_confidence;
drop policy if exists student_kcse_subject_confidence_insert on public.student_kcse_subject_confidence;
drop policy if exists student_kcse_subject_confidence_update on public.student_kcse_subject_confidence;
create policy student_kcse_subject_confidence_select on public.student_kcse_subject_confidence for select to authenticated using (student_id=(select auth.uid()));
create policy student_kcse_subject_confidence_insert on public.student_kcse_subject_confidence for insert to authenticated with check (student_id=(select auth.uid()));
create policy student_kcse_subject_confidence_update on public.student_kcse_subject_confidence for update to authenticated using (student_id=(select auth.uid())) with check (student_id=(select auth.uid()));

drop policy if exists student_kcse_error_classifications_select on public.student_kcse_error_classifications;
drop policy if exists student_kcse_error_classifications_insert on public.student_kcse_error_classifications;
drop policy if exists student_kcse_error_classifications_update on public.student_kcse_error_classifications;
create policy student_kcse_error_classifications_select on public.student_kcse_error_classifications for select to authenticated using (student_id=(select auth.uid()));
create policy student_kcse_error_classifications_insert on public.student_kcse_error_classifications for insert to authenticated with check (student_id=(select auth.uid()));
create policy student_kcse_error_classifications_update on public.student_kcse_error_classifications for update to authenticated using (student_id=(select auth.uid())) with check (student_id=(select auth.uid()));

drop policy if exists student_kcse_retest_schedule_select on public.student_kcse_retest_schedule;
create policy student_kcse_retest_schedule_select on public.student_kcse_retest_schedule for select to authenticated using (student_id=(select auth.uid()));
drop policy if exists student_kcse_mock_sessions_select on public.student_kcse_mock_sessions;
create policy student_kcse_mock_sessions_select on public.student_kcse_mock_sessions for select to authenticated using (student_id=(select auth.uid()));
drop policy if exists student_kcse_mock_answers_select on public.student_kcse_mock_answers;
create policy student_kcse_mock_answers_select on public.student_kcse_mock_answers for select to authenticated using (exists(select 1 from public.student_kcse_mock_sessions s where s.id=session_id and s.student_id=(select auth.uid())));

grant select on public.kcse_paper_blueprints,public.kcse_topic_dependencies,public.kcse_revision_assets,public.kcse_grade_threshold_profiles to authenticated;
grant select,insert,update on public.student_kcse_subject_confidence,public.student_kcse_error_classifications to authenticated;
grant select on public.student_kcse_retest_schedule,public.student_kcse_mock_sessions,public.student_kcse_mock_answers to authenticated;
create index if not exists student_kcse_retest_due_idx on public.student_kcse_retest_schedule(student_id,due_date,mastery_state);
create index if not exists student_kcse_mock_sessions_student_idx on public.student_kcse_mock_sessions(student_id,created_at desc);
create index if not exists kcse_revision_assets_lookup_idx on public.kcse_revision_assets(subject,asset_type,verification_status);

create or replace function public.student_update_kcse_profile(p_exam_date date,p_daily_revision_minutes integer,p_confidence_check integer,p_subject_confidence jsonb,p_kcse_candidate_opt_in boolean)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_user uuid:=auth.uid(); kv record;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_exam_date is not null and p_exam_date<current_date then raise exception 'Exam date cannot be in the past'; end if;
 if p_subject_confidence is null or jsonb_typeof(p_subject_confidence)<>'object' then raise exception 'Subject confidence must be an object'; end if;
 perform public.student_update_exam_readiness(p_exam_date,greatest(15,least(480,coalesce(p_daily_revision_minutes,90))),case when p_confidence_check between 1 and 5 then p_confidence_check else null end);
 update public.student_exam_readiness_state set kcse_candidate_opt_in=coalesce(p_kcse_candidate_opt_in,true),updated_at=now() where student_id=v_user;
 for kv in select key,value from jsonb_each(p_subject_confidence) loop
   if jsonb_typeof(kv.value)='number' and (kv.value::text)::integer between 1 and 5 then
     insert into public.student_kcse_subject_confidence(student_id,subject,confidence,updated_at) values(v_user,kv.key,(kv.value::text)::integer,now())
     on conflict(student_id,subject) do update set confidence=excluded.confidence,updated_at=now();
   end if;
 end loop;
 return jsonb_build_object('ok',true,'exam_date',p_exam_date,'daily_revision_minutes',greatest(15,least(480,coalesce(p_daily_revision_minutes,90))),'kcse_candidate_opt_in',coalesce(p_kcse_candidate_opt_in,true));
end $$;

create or replace function public.student_update_kcse_profile(p_exam_date date,p_daily_revision_minutes integer,p_confidence_check integer,p_subject_confidence jsonb default '{}'::jsonb)
returns jsonb language sql security definer set search_path='public','pg_temp' as $$ select public.student_update_kcse_profile(p_exam_date,p_daily_revision_minutes,p_confidence_check,p_subject_confidence,true); $$;

create or replace function public.student_get_kcse_adaptive_practice(p_subject text default null,p_topic text default null,p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_user uuid:=auth.uid(); v_limit integer:=greatest(1,least(coalesce(p_limit,10),30));
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 return jsonb_build_object('questions',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'subject',q.subject::text,'topic',q.topic,'difficulty',q.difficulty::text,'question',q.question,'options',q.options,'hint',q.hint,'provenance_status',q.provenance_status,'source_year',q.source_year,'source_paper',q.source_paper,'selection_reason',case when m.id is not null then 'Recover a previous mistake' when r.id is not null and r.due_date<=current_date then 'Spaced retest due' when pa.attempts is null then 'Build evidence in an unpractised question' else 'Keep exam skill active' end) order by priority,q.times_served,q.id)
 from (select qb.*,case when m.id is not null then 0 when r.id is not null and r.due_date<=current_date then 1 when pa.attempts is null then 2 else 3 end priority,m.id mistake_id from public.exam_question_bank qb left join public.student_mistake_notebook m on m.student_id=v_user and m.exam_question_id=qb.id and m.status<>'resolved' left join public.student_kcse_retest_schedule r on r.student_id=v_user and lower(r.subject)=lower(qb.subject::text) and lower(r.topic)=lower(qb.topic) and r.mastery_state<>'mastered' left join lateral(select count(*) attempts from public.student_practice_attempts p where p.student_id=v_user and p.exam_question_id=qb.id having count(*)>0) pa on true where qb.status='active' and qb.form::text='Form 4' and (p_subject is null or lower(qb.subject::text)=lower(p_subject)) and (p_topic is null or lower(qb.topic)=lower(p_topic)) order by priority,qb.times_served,random() limit v_limit) q left join public.student_mistake_notebook m on m.id=q.mistake_id left join public.student_kcse_retest_schedule r on r.student_id=v_user and lower(r.subject)=lower(q.subject::text) and lower(r.topic)=lower(q.topic) left join lateral(select count(*) attempts from public.student_practice_attempts p where p.student_id=v_user and p.exam_question_id=q.id having count(*)>0) pa on true),'[]'::jsonb));
end $$;

create or replace function public.student_resolve_mistake(p_mistake_id uuid)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_user uuid:=auth.uid(); m public.student_mistake_notebook%rowtype; v_correct integer:=0; v_attempts integer:=0; v_days integer:=0; v_mastered boolean:=false;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select * into m from public.student_mistake_notebook where id=p_mistake_id and student_id=v_user;
 if not found then raise exception 'Mistake not found'; end if;
 select count(*),count(*) filter(where is_correct),count(distinct attempted_at::date) into v_attempts,v_correct,v_days from public.student_practice_attempts where student_id=v_user and lower(subject)=lower(m.subject) and lower(topic)=lower(m.topic) and attempted_at>=m.last_missed_at;
 v_mastered:=v_correct>=3 and v_days>=2 and v_attempts>0 and (100.0*v_correct/v_attempts)>=80;
 if v_mastered then update public.student_mistake_notebook set status='resolved',resolved_at=now(),last_correct_at=coalesce(last_correct_at,now()) where id=p_mistake_id;
 else update public.student_mistake_notebook set status='practising',resolved_at=null where id=p_mistake_id;
 insert into public.student_kcse_retest_schedule(student_id,subject,topic,source_mistake_id,due_date,interval_days,mastery_state,updated_at) values(v_user,m.subject,m.topic,m.id,current_date+1,1,'recovering',now()) on conflict(student_id,subject,topic) do update set source_mistake_id=excluded.source_mistake_id,due_date=least(public.student_kcse_retest_schedule.due_date,current_date+1),mastery_state='recovering',updated_at=now(); end if;
 return jsonb_build_object('resolved',v_mastered,'id',p_mistake_id,'correct_since_miss',v_correct,'attempts_since_miss',v_attempts,'distinct_practice_days',v_days,'required','3 correct across 2 days with at least 80% accuracy');
end $$;

create or replace function public.student_generate_kcse_revision_plan(p_start_date date default current_date,p_days integer default 7)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_user uuid:=auth.uid(); v_daily integer:=90; v_days integer:=greatest(1,least(coalesce(p_days,7),31)); v_date date; v_slots integer; r record; v_added integer:=0;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select coalesce(daily_revision_minutes,90) into v_daily from public.student_exam_readiness_state where student_id=v_user; v_daily:=greatest(15,least(coalesce(v_daily,90),240)); v_slots:=greatest(1,least(4,ceil(v_daily/30.0)::integer));
 delete from public.student_revision_plan_items where student_id=v_user and plan_date between p_start_date and p_start_date+v_days-1 and source->>'generated_by'='student_generate_kcse_revision_plan' and status='planned';
 for i in 0..v_days-1 loop v_date:=p_start_date+i;
   for r in with candidates as (select subject,topic,1 priority,'practice' activity_type,'Scheduled spaced retest: prove the topic still holds.' reason,0 ord from public.student_kcse_retest_schedule where student_id=v_user and mastery_state<>'mastered' and due_date<=v_date union all select subject,topic,2,'review_mistakes','Repeated errors are costing marks. Review, then retest.',repeat_count from public.student_mistake_notebook where student_id=v_user and status<>'resolved' union all select q.subject::text,q.topic,3,'practice','Build exam evidence in an unpractised available topic.',0 from public.exam_question_bank q where q.status='active' and q.form::text='Form 4' and not exists(select 1 from public.student_practice_attempts p where p.student_id=v_user and lower(p.subject)=lower(q.subject::text) and lower(p.topic)=lower(q.topic))), ranked as (select distinct on(lower(subject),lower(topic)) subject,topic,priority,activity_type,reason,ord from candidates order by lower(subject),lower(topic),priority,ord desc) select * from ranked order by priority,ord desc,subject,topic limit v_slots
   loop insert into public.student_revision_plan_items(student_id,plan_date,subject,topic,activity_type,target_minutes,priority,reason,action_url,source) values(v_user,v_date,r.subject,r.topic,r.activity_type,greatest(15,floor(v_daily::numeric/v_slots)::integer),r.priority,r.reason,'/student/vibelearn/kcse/practice',jsonb_build_object('generated_by','student_generate_kcse_revision_plan','daily_cap_minutes',v_daily,'action_subject',r.subject,'action_topic',r.topic)) on conflict(student_id,plan_date,subject,topic,activity_type) do nothing; if found then v_added:=v_added+1; end if; end loop;
 end loop;
 return jsonb_build_object('ok',true,'added',v_added,'days',v_days,'daily_cap_minutes',v_daily,'sessions_per_day',v_slots);
end $$;

create or replace function public.student_create_kcse_mock(p_subject text,p_paper_code text,p_client_id uuid default null)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_user uuid:=auth.uid(); b public.kcse_paper_blueprints%rowtype; v_ids uuid[]; v_session uuid; v_count integer;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select * into b from public.kcse_paper_blueprints where lower(subject)=lower(btrim(p_subject)) and lower(paper_code)=lower(btrim(p_paper_code)) and verification_status='verified' limit 1;
 if not found then return jsonb_build_object('ok',false,'reason','verified_blueprint_missing'); end if;
 select array_agg(id order by priority,id),count(*) into v_ids,v_count from (select q.id,case when exists(select 1 from public.student_mistake_notebook m where m.student_id=v_user and m.exam_question_id=q.id and m.status<>'resolved') then 0 else 1 end priority from public.exam_question_bank q where q.status='active' and q.form::text='Form 4' and lower(q.subject::text)=lower(b.subject) and q.provenance_status in ('teacher_verified','publisher_verified','official_verified') order by priority,q.times_served asc,random() limit least(b.total_marks,100)) s;
 if coalesce(v_count,0)=0 then return jsonb_build_object('ok',false,'reason','verified_questions_missing'); end if;
 insert into public.student_kcse_mock_sessions(student_id,subject,paper_code,title,duration_minutes,total_marks,question_ids,expires_at,active_client_id) values(v_user,b.subject,b.paper_code,b.title,b.duration_minutes,b.total_marks,coalesce(v_ids,'{}'),now()+make_interval(mins=>b.duration_minutes),p_client_id) returning id into v_session;
 return jsonb_build_object('ok',true,'session_id',v_session,'question_count',v_count,'duration_minutes',b.duration_minutes,'total_marks',b.total_marks,'action_url','/student/vibelearn/kcse/mock/'||v_session::text);
end $$;

create or replace function public.student_get_kcse_mock(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_user uuid:=auth.uid(); s public.student_kcse_mock_sessions%rowtype; v_submitted boolean; v_questions jsonb;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select * into s from public.student_kcse_mock_sessions where id=p_session_id and student_id=v_user; if not found then raise exception 'Mock session not found'; end if;
 if s.status='in_progress' and now()>s.expires_at then update public.student_kcse_mock_sessions set status='expired',updated_at=now() where id=s.id; s.status:='expired'; end if; v_submitted:=s.status='submitted';
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'subject',q.subject::text,'topic',q.topic,'difficulty',q.difficulty::text,'question',q.question,'options',q.options,'selected_index',a.selected_index,'response_text',a.response_text,'saved_at',a.saved_at,'correct_index',case when v_submitted then q.correct_index else null end,'explanation',case when v_submitted then q.explanation else null end,'is_correct',case when v_submitted then a.is_correct else null end) order by array_position(s.question_ids,q.id)),'[]'::jsonb) into v_questions from public.exam_question_bank q left join public.student_kcse_mock_answers a on a.session_id=s.id and a.question_id=q.id where q.id=any(s.question_ids);
 return jsonb_build_object('ok',true,'session_id',s.id,'subject',s.subject,'paper_code',s.paper_code,'title',s.title,'duration_minutes',s.duration_minutes,'total_marks',s.total_marks,'status',s.status,'started_at',s.started_at,'last_saved_at',s.last_saved_at,'expires_at',s.expires_at,'submitted_at',s.submitted_at,'score',s.score,'max_score',s.max_score,'percentage',s.percentage,'questions',v_questions);
end $$;

create or replace function public.student_save_kcse_mock_answer(p_session_id uuid,p_question_id uuid,p_selected_index integer,p_response_text text default null,p_response_ms integer default null,p_client_id uuid default null)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_user uuid:=auth.uid(); s public.student_kcse_mock_sessions%rowtype;
begin
 if v_user is null then raise exception 'Authentication required'; end if; select * into s from public.student_kcse_mock_sessions where id=p_session_id and student_id=v_user for update; if not found then raise exception 'Mock session not found'; end if;
 if s.status<>'in_progress' or now()>s.expires_at then raise exception 'Mock session is closed'; end if; if s.active_client_id is not null and p_client_id is not null and s.active_client_id<>p_client_id then raise exception 'Mock is active on another device'; end if; if not(p_question_id=any(s.question_ids)) then raise exception 'Question not in this mock'; end if;
 insert into public.student_kcse_mock_answers(session_id,question_id,selected_index,response_text,response_ms,saved_at) values(p_session_id,p_question_id,p_selected_index,nullif(left(coalesce(p_response_text,''),10000),''),p_response_ms,now()) on conflict(session_id,question_id) do update set selected_index=excluded.selected_index,response_text=excluded.response_text,response_ms=excluded.response_ms,saved_at=now(); update public.student_kcse_mock_sessions set last_saved_at=now(),active_client_id=coalesce(active_client_id,p_client_id),updated_at=now() where id=p_session_id; return jsonb_build_object('ok',true,'saved_at',now());
end $$;

create or replace function public.student_submit_kcse_mock(p_session_id uuid,p_client_id uuid default null)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_user uuid:=auth.uid(); v_student uuid; s public.student_kcse_mock_sessions%rowtype; r record; v_score numeric:=0; v_max numeric:=0; v_pct numeric:=0; v_mistake uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if; select id into v_student from public.students where profile_id=v_user and deleted_at is null order by created_at asc limit 1; if v_student is null then raise exception 'Student profile not found'; end if;
 select * into s from public.student_kcse_mock_sessions where id=p_session_id and student_id=v_user for update; if not found then raise exception 'Mock session not found'; end if; if s.status='submitted' then return public.student_get_kcse_mock(p_session_id); end if; if s.active_client_id is not null and p_client_id is not null and s.active_client_id<>p_client_id then raise exception 'Mock is active on another device'; end if;
 for r in select q.*,a.selected_index,a.response_text,a.response_ms from public.exam_question_bank q left join public.student_kcse_mock_answers a on a.session_id=s.id and a.question_id=q.id where q.id=any(s.question_ids) loop update public.student_kcse_mock_answers set is_correct=(selected_index=r.correct_index),score=case when selected_index=r.correct_index then 1 else 0 end,max_score=1 where session_id=s.id and question_id=r.id; v_max:=v_max+1; if r.selected_index=r.correct_index then v_score:=v_score+1; else insert into public.student_mistake_notebook(student_id,exam_question_id,subject,topic,prompt_snapshot,selected_index,correct_index,explanation_snapshot,hint_snapshot) values(v_user,r.id,r.subject::text,r.topic,r.question,r.selected_index,r.correct_index,r.explanation,r.hint) on conflict(student_id,exam_question_id) do update set selected_index=excluded.selected_index,repeat_count=public.student_mistake_notebook.repeat_count+1,status='open',last_missed_at=now(),resolved_at=null; select id into v_mistake from public.student_mistake_notebook where student_id=v_user and exam_question_id=r.id; insert into public.student_kcse_retest_schedule(student_id,subject,topic,source_mistake_id,due_date,interval_days,mastery_state,last_result,last_attempt_at,updated_at) values(v_user,r.subject::text,r.topic,v_mistake,current_date+1,1,'recovering',false,now(),now()) on conflict(student_id,subject,topic) do update set source_mistake_id=excluded.source_mistake_id,due_date=current_date+1,interval_days=1,successful_retests=0,mastery_state='recovering',last_result=false,last_attempt_at=now(),updated_at=now(); end if; end loop;
 if v_max>0 then v_pct:=round(100*v_score/v_max,1); end if; update public.student_kcse_mock_sessions set status='submitted',submitted_at=now(),score=v_score,max_score=v_max,percentage=v_pct,last_saved_at=now(),updated_at=now() where id=s.id; insert into public.student_learning_events(student_id,event_type,source_type,source_id,xp_awarded,occurred_at,metadata) values(v_student,'kcse_mock_submitted','kcse_mock',s.id,case when v_pct>=70 then 20 when v_pct>=50 then 12 else 8 end,now(),jsonb_build_object('subject',s.subject,'paper_code',s.paper_code,'score',v_score,'max_score',v_max,'percentage',v_pct)); perform public.student_generate_kcse_revision_plan(current_date,7); return public.student_get_kcse_mock(p_session_id);
end $$;

create or replace function public.student_get_kcse_verified_grade_projection()
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_user uuid:=auth.uid(); v_student uuid; v_avg numeric; v_year integer; v_grade text;
begin if v_user is null then raise exception 'Authentication required'; end if; select id into v_student from public.students where profile_id=v_user and deleted_at is null limit 1; if v_student is null then raise exception 'Student profile not found'; end if; select round(avg(percentage)::numeric,1) into v_avg from public.assessment_attempts where student_id=v_student and percentage is not null and status in ('submitted','auto_marked','teacher_reviewed'); v_year:=extract(year from current_date)::integer; if v_avg is null then return jsonb_build_object('state','insufficient_evidence','average_percentage',null,'projected_grade',null); end if; select grade into v_grade from public.kcse_grade_threshold_profiles where exam_year=v_year and subject is null and verification_status='verified' and v_avg between min_percentage and max_percentage order by min_percentage desc limit 1; if v_grade is null then return jsonb_build_object('state','verified_threshold_profile_unavailable','average_percentage',v_avg,'projected_grade',null,'disclaimer','Vibeschool will not invent KCSE grade thresholds.'); end if; return jsonb_build_object('state','available','average_percentage',v_avg,'projected_grade',v_grade,'exam_year',v_year,'disclaimer','Evidence projection using a verified threshold profile; not an official KNEC result.'); end $$;

create or replace function public.student_get_kcse_mastery_map()
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_user uuid:=auth.uid();
begin if v_user is null then raise exception 'Authentication required'; end if; return jsonb_build_object('topics',coalesce((select jsonb_agg(jsonb_build_object('subject',x.subject,'topic',x.topic,'syllabus_state',x.syllabus_state,'verified_outcomes',x.verified_outcomes,'available_questions',x.available_questions,'attempts',x.attempts,'correct',x.correct,'accuracy',x.accuracy,'last_practised_at',x.last_practised_at,'due_retest',x.due_retest,'mastery_state',case when x.syllabus_state='unmapped_content' then 'content_unmapped' when x.attempts=0 then 'no_evidence' when x.due_retest then 'retest_due' when x.accuracy>=80 and x.attempts>=3 then 'evidence_strong' when x.accuracy>=60 then 'developing' else 'weak_evidence' end) order by x.subject,x.topic) from (with syllabus_topics as (select c.subject,c.topic,'verified_syllabus'::text syllabus_state,count(o.id) filter(where o.status='verified') verified_outcomes from public.curriculum c left join public.curriculum_learning_outcomes o on o.curriculum_id=c.id where lower(c.grade) in ('form 4','form4') group by c.subject,c.topic),bank_topics as(select q.subject::text subject,q.topic,count(*) available_questions from public.exam_question_bank q where q.status='active' and q.form::text='Form 4' group by q.subject::text,q.topic),all_topics as(select s.subject,s.topic,s.syllabus_state,s.verified_outcomes,coalesce(b.available_questions,0) available_questions from syllabus_topics s left join bank_topics b on lower(b.subject)=lower(s.subject) and lower(b.topic)=lower(s.topic) union all select b.subject,b.topic,'unmapped_content',0,b.available_questions from bank_topics b where not exists(select 1 from syllabus_topics s where lower(s.subject)=lower(b.subject) and lower(s.topic)=lower(b.topic))) select a.subject,a.topic,a.syllabus_state,a.verified_outcomes,a.available_questions,count(p.id) attempts,count(p.id) filter(where p.is_correct) correct,case when count(p.id)=0 then null else round(100.0*count(p.id) filter(where p.is_correct)/count(p.id),1) end accuracy,max(p.attempted_at) last_practised_at,coalesce(bool_or(r.mastery_state<>'mastered' and r.due_date<=current_date),false) due_retest from all_topics a left join public.student_practice_attempts p on p.student_id=v_user and lower(p.subject)=lower(a.subject) and lower(p.topic)=lower(a.topic) left join public.student_kcse_retest_schedule r on r.student_id=v_user and lower(r.subject)=lower(a.subject) and lower(r.topic)=lower(a.topic) group by a.subject,a.topic,a.syllabus_state,a.verified_outcomes,a.available_questions)x),'[]'::jsonb),'prerequisite_risks',coalesce((select jsonb_agg(jsonb_build_object('subject',d.subject,'topic',d.topic,'prerequisite_topic',d.prerequisite_topic,'reason','A verified prerequisite has unresolved mistakes or weak evidence.') order by d.subject,d.topic,d.prerequisite_topic) from public.kcse_topic_dependencies d where d.verification_status='verified' and exists(select 1 from public.student_mistake_notebook m where m.student_id=v_user and m.status<>'resolved' and lower(m.subject)=lower(d.subject) and lower(m.topic)=lower(d.prerequisite_topic))),'[]'::jsonb)); end $$;

-- Candidate command centre. It reports unavailable corpus as unavailable rather than weak.
create or replace function public.student_get_kcse_candidate_os()
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_user uuid:=auth.uid(); v_student uuid; v_home public.student_home_state%rowtype; v_ready public.student_exam_readiness_state%rowtype; v_days integer; v_mode text; v_avg numeric; v_attempts integer;
begin
 if v_user is null then raise exception 'Authentication required'; end if; select id into v_student from public.students where profile_id=v_user and deleted_at is null order by created_at asc limit 1; if v_student is null then raise exception 'Student profile not found'; end if;
 insert into public.student_home_state(student_id) values(v_student) on conflict(student_id) do nothing; insert into public.student_exam_readiness_state(student_id) values(v_user) on conflict(student_id) do nothing; select * into v_home from public.student_home_state where student_id=v_student; select * into v_ready from public.student_exam_readiness_state where student_id=v_user;
 v_days:=case when v_ready.exam_date is null then null else greatest(v_ready.exam_date-current_date,0) end; v_mode:=case when not v_ready.kcse_candidate_opt_in or v_days is null then 'setup' when v_days<=7 then 'final_week' when v_days<=21 then 'final_sprint' when v_days<=60 then 'exam_revision' else 'steady_revision' end; select round(avg(percentage)::numeric,1),count(*) into v_avg,v_attempts from public.assessment_attempts where student_id=v_student and percentage is not null and status in ('submitted','auto_marked','teacher_reviewed');
 return jsonb_build_object('eligible',v_ready.kcse_candidate_opt_in,'onboarding',jsonb_build_object('kcse_candidate_opt_in',v_ready.kcse_candidate_opt_in,'target_grade',v_home.kcse_target_grade,'exam_date',v_ready.exam_date,'daily_revision_minutes',v_ready.daily_revision_minutes,'confidence_check',v_ready.confidence_check,'complete',v_ready.kcse_candidate_opt_in and v_home.kcse_target_grade is not null and v_ready.exam_date is not null),'countdown',jsonb_build_object('days_remaining',v_days,'mode',v_mode,'message',case v_mode when 'setup' then 'Set your KCSE date and target before relying on a countdown plan.' when 'final_week' then 'Final week: protect sleep, confidence, timing and high-yield recall.' when 'final_sprint' then 'Final sprint: prioritise mistakes, spaced retests and timed papers.' when 'exam_revision' then 'Exam revision: mix weak-topic recovery with timed paper practice.' else 'Steady revision: build complete coverage and durable mastery.' end),'projection',jsonb_build_object('evidence_attempts',coalesce(v_attempts,0),'average_percentage',v_avg,'readiness_band',case when v_avg is null then 'insufficient_evidence' when v_avg>=80 then 'very_strong' when v_avg>=70 then 'strong' when v_avg>=60 then 'developing_strong' when v_avg>=50 then 'developing' else 'needs_recovery' end,'target_grade',v_home.kcse_target_grade,'trend_disclaimer','This is a Vibeschool evidence projection, not an official KNEC grade prediction.'),'coverage',coalesce((select jsonb_agg(jsonb_build_object('subject',s.subject,'syllabus_topics',(select count(distinct c.topic) from public.curriculum c where lower(c.grade) in ('form 4','form4') and lower(c.subject)=lower(s.subject)),'verified_outcomes',(select count(*) from public.curriculum_learning_outcomes o join public.curriculum c on c.id=o.curriculum_id where lower(c.grade) in ('form 4','form4') and lower(c.subject)=lower(s.subject) and o.status='verified'),'published_form4_questions',(select count(*) from public.exam_question_bank q where q.status='active' and q.form::text='Form 4' and lower(q.subject::text)=lower(s.subject)),'evidence_state',case when not exists(select 1 from public.curriculum c where lower(c.grade) in ('form 4','form4') and lower(c.subject)=lower(s.subject)) then 'syllabus_unavailable' when not exists(select 1 from public.exam_question_bank q where q.status='active' and q.form::text='Form 4' and lower(q.subject::text)=lower(s.subject)) then 'practice_unavailable' else 'available' end) order by s.subject) from (select distinct subject from public.curriculum where lower(grade) in ('form 4','form4') union select distinct subject::text from public.exam_question_bank where form::text='Form 4')s),'[]'::jsonb),'due_retests',coalesce((select jsonb_agg(jsonb_build_object('id',id,'subject',subject,'topic',topic,'due_date',due_date,'mastery_state',mastery_state) order by due_date,subject,topic) from public.student_kcse_retest_schedule where student_id=v_user and mastery_state<>'mastered'),'[]'::jsonb),'recent_mocks',coalesce((select jsonb_agg(jsonb_build_object('id',id,'subject',subject,'paper_code',paper_code,'title',title,'status',status,'percentage',percentage,'action_url','/student/vibelearn/kcse/mock/'||id::text) order by created_at desc) from (select * from public.student_kcse_mock_sessions where student_id=v_user order by created_at desc limit 8)m),'[]'::jsonb),'paper_blueprints',coalesce((select jsonb_agg(jsonb_build_object('id',id,'subject',subject,'paper_code',paper_code,'title',title,'duration_minutes',duration_minutes,'total_marks',total_marks,'source_type',source_type,'source_ref',source_ref) order by subject,paper_code) from public.kcse_paper_blueprints where verification_status='verified'),'[]'::jsonb),'capabilities',jsonb_build_object('candidate_onboarding',true,'verified_form4_syllabus',(select count(*)>0 from public.curriculum where lower(grade) in ('form 4','form4')),'verified_form4_question_bank',(select count(*)>0 from public.exam_question_bank where status='active' and form::text='Form 4'),'verified_paper_blueprints',(select count(*)>0 from public.kcse_paper_blueprints where verification_status='verified'),'spaced_retesting',true,'resumable_mock_engine',true,'mistake_taxonomy',true,'peer_ranking_disabled',true),'guardrails',jsonb_build_object('no_public_ranking',true,'no_official_grade_claim',true,'no_unverified_kcse_content_presented_as_authoritative',true,'tutor_blocked_during_timed_mock',true));
end $$;

-- Student practice scoring remains deterministic and feeds spaced recovery.
create or replace function public.student_record_vibelearn_practice_answer(p_exam_question_id uuid,p_selected_index integer,p_response_ms integer default null,p_session_id uuid default null)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_user uuid:=auth.uid(); v_student uuid; q record; v_correct boolean; v_mistake uuid; v_prev integer:=0; v_next integer:=1; v_n integer; v_accuracy numeric;
begin
 if v_user is null then raise exception 'Authentication required'; end if; if p_response_ms is not null and p_response_ms<0 then raise exception 'Invalid response time'; end if; select id into v_student from public.students where profile_id=v_user and deleted_at is null order by created_at asc limit 1; if v_student is null then raise exception 'Student profile not found'; end if; select id,subject::text subject,topic,difficulty::text difficulty,question,correct_index,explanation,hint into q from public.exam_question_bank where id=p_exam_question_id and status='active'; if q.id is null then raise exception 'Question not available'; end if; v_correct:=p_selected_index=q.correct_index;
 insert into public.student_practice_attempts(student_id,exam_question_id,selected_index,correct_index,is_correct,subject,topic,difficulty,response_ms,session_id) values(v_user,q.id,p_selected_index,q.correct_index,v_correct,q.subject,q.topic,q.difficulty,p_response_ms,p_session_id);
 if not v_correct then insert into public.student_mistake_notebook(student_id,exam_question_id,subject,topic,prompt_snapshot,selected_index,correct_index,explanation_snapshot,hint_snapshot) values(v_user,q.id,q.subject,q.topic,q.question,p_selected_index,q.correct_index,q.explanation,q.hint) on conflict(student_id,exam_question_id) do update set selected_index=excluded.selected_index,repeat_count=public.student_mistake_notebook.repeat_count+1,status='open',last_missed_at=now(),resolved_at=null; select id into v_mistake from public.student_mistake_notebook where student_id=v_user and exam_question_id=q.id; insert into public.student_kcse_retest_schedule(student_id,subject,topic,source_mistake_id,due_date,interval_days,successful_retests,mastery_state,last_result,last_attempt_at,updated_at) values(v_user,q.subject,q.topic,v_mistake,current_date+1,1,0,'recovering',false,now(),now()) on conflict(student_id,subject,topic) do update set source_mistake_id=excluded.source_mistake_id,due_date=current_date+1,interval_days=1,successful_retests=0,mastery_state='recovering',last_result=false,last_attempt_at=now(),updated_at=now(); else select coalesce(successful_retests,0) into v_prev from public.student_kcse_retest_schedule where student_id=v_user and lower(subject)=lower(q.subject) and lower(topic)=lower(q.topic); if found then v_next:=case when v_prev<=0 then 3 when v_prev=1 then 7 when v_prev=2 then 14 else least(60,14+(v_prev-2)*7) end; update public.student_kcse_retest_schedule set successful_retests=successful_retests+1,interval_days=v_next,due_date=current_date+v_next,mastery_state=case when successful_retests+1>=3 then 'mastered' else 'stabilising' end,last_result=true,last_attempt_at=now(),updated_at=now() where student_id=v_user and lower(subject)=lower(q.subject) and lower(topic)=lower(q.topic); end if; end if;
 insert into public.student_learning_events(student_id,event_type,source_type,source_id,xp_awarded,occurred_at,metadata) values(v_student,'practice_answered','exam_question',q.id,case when v_correct then 2 else 1 end,now(),jsonb_build_object('subject',q.subject,'topic',q.topic,'correct',v_correct,'response_ms',p_response_ms,'session_id',p_session_id)); select count(*),avg(case when is_correct then 1.0 else 0.0 end) into v_n,v_accuracy from public.student_practice_attempts where exam_question_id=q.id; update public.exam_question_bank set calibration_sample_size=v_n,empirical_difficulty=case when v_n>=10 then round((1-coalesce(v_accuracy,0))::numeric,3) else null end where id=q.id; return jsonb_build_object('correct',v_correct,'correct_index',q.correct_index,'explanation',q.explanation,'hint',q.hint,'mistake_id',v_mistake,'next_retest_days',case when v_correct then v_next else 1 end,'calibration_sample_size',v_n);
end $$;

-- Explicit execution grants: no anonymous KCSE API.
do $$ declare r record; begin
 for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'student_%kcse%' or p.proname in ('student_resolve_mistake','student_record_vibelearn_practice_answer','teacher_get_student_kcse_brief','parent_get_student_kcse_brief')) loop execute format('revoke all on function %s from public, anon',r.sig); execute format('grant execute on function %s to authenticated, service_role',r.sig); end loop;
end $$;
