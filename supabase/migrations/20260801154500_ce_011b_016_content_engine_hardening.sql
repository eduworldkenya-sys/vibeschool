begin;
-- CE-010: learner assignment membership and evidence
create table if not exists public.content_assignment_learners(
 id uuid primary key default gen_random_uuid(), assignment_id uuid not null references public.vibe_chapter_assignments(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete cascade, assigned_at timestamptz not null default now(), status text not null default 'assigned',
 opened_at timestamptz, submitted_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status in('assigned','opened','in_progress','submitted','completed','excused','overdue')), unique(assignment_id,student_id)
);
create table if not exists public.content_submission_evidence(
 id uuid primary key default gen_random_uuid(), assignment_learner_id uuid not null references public.content_assignment_learners(id) on delete cascade,
 evidence_type text not null, text_response text, file_url text, metadata jsonb not null default '{}'::jsonb,
 submitted_by uuid references auth.users(id) on delete set null, submitted_at timestamptz not null default now(), status text not null default 'submitted', created_at timestamptz not null default now(),
 check(evidence_type in('text','image','audio','video','document','link','reading_progress','observation')), check(status in('draft','submitted','withdrawn','accepted','rejected')),
 check(text_response is not null or file_url is not null or metadata<>'{}'::jsonb)
);
create index if not exists content_assignment_learners_student_status_idx on public.content_assignment_learners(student_id,status);
create index if not exists content_submission_evidence_assignment_status_idx on public.content_submission_evidence(assignment_learner_id,status);
alter table public.content_assignment_learners enable row level security;
alter table public.content_submission_evidence enable row level security;
grant select,insert,update,delete on public.content_assignment_learners,public.content_submission_evidence to authenticated,service_role;

-- CE-011: rubric and marking engine
create table if not exists public.assessment_rubrics(
 id uuid primary key default gen_random_uuid(), title text not null, description text, owner_id uuid references auth.users(id) on delete set null,
 school_id uuid references public.schools(id) on delete cascade, status text not null default 'draft', max_score numeric(10,2) not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(btrim(title)<>''), check(status in('draft','active','archived')), check(max_score>0)
);
create table if not exists public.assessment_rubric_criteria(
 id uuid primary key default gen_random_uuid(), rubric_id uuid not null references public.assessment_rubrics(id) on delete cascade,
 criterion text not null, description text, max_score numeric(10,2) not null, sequence integer not null,
 outcome_id uuid references public.curriculum_learning_outcomes(id) on delete set null,
 check(btrim(criterion)<>''), check(max_score>0), check(sequence>0), unique(rubric_id,sequence)
);
create table if not exists public.submission_marks(
 id uuid primary key default gen_random_uuid(), evidence_id uuid not null references public.content_submission_evidence(id) on delete cascade,
 rubric_id uuid references public.assessment_rubrics(id) on delete set null, marker_id uuid not null references auth.users(id) on delete restrict,
 score numeric(10,2) not null, max_score numeric(10,2) not null, feedback text, status text not null default 'draft', marked_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(score>=0), check(max_score>0), check(score<=max_score), check(status in('draft','released','moderated','void')), unique(evidence_id)
);
create table if not exists public.submission_criterion_marks(
 id uuid primary key default gen_random_uuid(), submission_mark_id uuid not null references public.submission_marks(id) on delete cascade,
 criterion_id uuid not null references public.assessment_rubric_criteria(id) on delete cascade, score numeric(10,2) not null, feedback text,
 check(score>=0), unique(submission_mark_id,criterion_id)
);
alter table public.assessment_rubrics enable row level security;
alter table public.assessment_rubric_criteria enable row level security;
alter table public.submission_marks enable row level security;
alter table public.submission_criterion_marks enable row level security;
grant select,insert,update,delete on public.assessment_rubrics,public.assessment_rubric_criteria,public.submission_marks,public.submission_criterion_marks to authenticated,service_role;

-- CE-012: competency evidence and derived mastery
create table if not exists public.competency_evidence_ledger(
 id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete cascade,
 outcome_id uuid not null references public.curriculum_learning_outcomes(id) on delete cascade,
 evidence_source text not null, evidence_id uuid, score numeric(10,2), max_score numeric(10,2), proficiency text,
 observed_by uuid references auth.users(id) on delete set null, observed_at timestamptz not null default now(), notes text, created_at timestamptz not null default now(),
 check(evidence_source in('lesson_observation','reading','exercise','homework','project','quiz','cat','exam','submission_mark')),
 check(score is null or score>=0), check(max_score is null or max_score>0), check(score is null or max_score is null or score<=max_score),
 check(proficiency is null or proficiency in('not_started','emerging','developing','meeting','exceeding','needs_intervention'))
);
create table if not exists public.student_outcome_mastery(
 id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete cascade,
 outcome_id uuid not null references public.curriculum_learning_outcomes(id) on delete cascade,
 mastery_level text not null default 'not_started', mastery_score numeric(5,2), evidence_count integer not null default 0,
 last_evidence_at timestamptz, updated_at timestamptz not null default now(),
 check(mastery_level in('not_started','emerging','developing','meeting','exceeding','needs_intervention')),
 check(mastery_score is null or (mastery_score>=0 and mastery_score<=100)), check(evidence_count>=0), unique(student_id,outcome_id)
);
alter table public.competency_evidence_ledger enable row level security;
alter table public.student_outcome_mastery enable row level security;
grant select,insert,update,delete on public.competency_evidence_ledger,public.student_outcome_mastery to authenticated,service_role;

-- CE-013: source-grounded assessment generation
create table if not exists public.content_assessment_blueprints(
 id uuid primary key default gen_random_uuid(), school_id uuid references public.schools(id) on delete cascade,
 teacher_id uuid not null references auth.users(id) on delete cascade, class_id uuid references public.classes(id) on delete set null,
 subject_id uuid references public.subjects(id) on delete set null, title text not null, assessment_type text not null,
 total_marks integer not null, duration_minutes integer, status text not null default 'draft',
 difficulty_distribution jsonb not null default '{}'::jsonb, bloom_distribution jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(btrim(title)<>''), check(assessment_type in('quiz','exercise','homework','project','cat','exam','revision','remedial')),
 check(total_marks>0), check(duration_minutes is null or duration_minutes>0), check(status in('draft','generated','approved','published','archived'))
);
create table if not exists public.content_assessment_sources(
 id uuid primary key default gen_random_uuid(), blueprint_id uuid not null references public.content_assessment_blueprints(id) on delete cascade,
 resource_id uuid not null references public.learning_resources(id) on delete restrict,
 scheme_resource_link_id uuid references public.scheme_lesson_resource_links(id) on delete set null,
 outcome_id uuid references public.curriculum_learning_outcomes(id) on delete set null,
 weight numeric(5,2) not null default 1, created_at timestamptz not null default now(), check(weight>0), unique(blueprint_id,resource_id,outcome_id)
);
create table if not exists public.generated_assessments(
 id uuid primary key default gen_random_uuid(), blueprint_id uuid not null references public.content_assessment_blueprints(id) on delete cascade,
 version integer not null default 1, status text not null default 'draft', total_marks integer not null,
 generated_by uuid references auth.users(id) on delete set null, generated_at timestamptz not null default now(),
 approved_by uuid references auth.users(id) on delete set null, approved_at timestamptz,
 check(version>0), check(total_marks>0), check(status in('draft','moderation','approved','published','archived')), unique(blueprint_id,version)
);
create table if not exists public.generated_assessment_items(
 id uuid primary key default gen_random_uuid(), assessment_id uuid not null references public.generated_assessments(id) on delete cascade,
 sequence integer not null, question_type text not null, prompt text not null, options jsonb, answer_key jsonb, marks integer not null,
 difficulty text, bloom_level text, source_resource_id uuid references public.learning_resources(id) on delete set null,
 outcome_id uuid references public.curriculum_learning_outcomes(id) on delete set null,
 source_block_id uuid references public.content_blocks(id) on delete set null, created_at timestamptz not null default now(),
 check(sequence>0), check(btrim(prompt)<>''), check(marks>0),
 check(question_type in('multiple_choice','short_answer','structured','numerical','essay','practical','project','oral','observation')),
 unique(assessment_id,sequence)
);
alter table public.content_assessment_blueprints enable row level security;
alter table public.content_assessment_sources enable row level security;
alter table public.generated_assessments enable row level security;
alter table public.generated_assessment_items enable row level security;
grant select,insert,update,delete on public.content_assessment_blueprints,public.content_assessment_sources,public.generated_assessments,public.generated_assessment_items to authenticated,service_role;

-- CE-014: derived teacher analytics
create table if not exists public.content_engine_daily_metrics(
 id uuid primary key default gen_random_uuid(), metric_date date not null, school_id uuid references public.schools(id) on delete cascade,
 teacher_id uuid references auth.users(id) on delete cascade, class_id uuid references public.classes(id) on delete cascade,
 subject_id uuid references public.subjects(id) on delete set null, metric_key text not null, metric_value numeric not null default 0,
 dimensions jsonb not null default '{}'::jsonb, calculated_at timestamptz not null default now(),
 check(btrim(metric_key)<>''), unique(metric_date,school_id,teacher_id,class_id,subject_id,metric_key,dimensions)
);
alter table public.content_engine_daily_metrics enable row level security;
grant select on public.content_engine_daily_metrics to authenticated;
grant select,insert,update,delete on public.content_engine_daily_metrics to service_role;
create or replace view public.teacher_content_engine_summary with (security_invoker=true) as
select a.teacher_id,a.class_id,a.school_id,count(*) as assignments,
 count(*) filter(where al.status in('opened','in_progress','submitted','completed')) as learners_engaged,
 count(*) filter(where al.status='completed') as learners_completed,
 count(sm.id) filter(where sm.status='released') as released_marks,
 avg(case when sm.max_score>0 then sm.score/sm.max_score*100 end) as average_percent
from public.vibe_chapter_assignments a
left join public.content_assignment_learners al on al.assignment_id=a.id
left join public.content_submission_evidence e on e.assignment_learner_id=al.id
left join public.submission_marks sm on sm.evidence_id=e.id
group by a.teacher_id,a.class_id,a.school_id;
grant select on public.teacher_content_engine_summary to authenticated,service_role;

-- CE-015: approved parent-facing summaries
create table if not exists public.parent_learning_summaries(
 id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete cascade,
 school_id uuid references public.schools(id) on delete cascade, class_id uuid references public.classes(id) on delete set null,
 period_start date not null, period_end date not null, status text not null default 'draft', summary jsonb not null default '{}'::jsonb,
 strengths text[] not null default '{}', focus_areas text[] not null default '{}', teacher_comment text,
 generated_by uuid references auth.users(id) on delete set null, approved_by uuid references auth.users(id) on delete set null,
 generated_at timestamptz not null default now(), approved_at timestamptz, published_at timestamptz,
 check(period_end>=period_start), check(status in('draft','approved','published','archived')),
 check(status not in('approved','published') or (approved_by is not null and approved_at is not null)), unique(student_id,period_start,period_end)
);
create table if not exists public.parent_learning_summary_sources(
 id uuid primary key default gen_random_uuid(), summary_id uuid not null references public.parent_learning_summaries(id) on delete cascade,
 source_type text not null, source_id uuid not null, created_at timestamptz not null default now(),
 check(source_type in('assignment','evidence','mark','mastery','exam_result','attendance','project','homework')), unique(summary_id,source_type,source_id)
);
alter table public.parent_learning_summaries enable row level security;
alter table public.parent_learning_summary_sources enable row level security;
grant select,insert,update,delete on public.parent_learning_summaries,public.parent_learning_summary_sources to authenticated,service_role;

create or replace function public.ce_validate_criterion_mark()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare cap numeric; mark_rubric uuid; criterion_rubric uuid;
begin
 select max_score,rubric_id into cap,criterion_rubric from public.assessment_rubric_criteria where id=new.criterion_id;
 select rubric_id into mark_rubric from public.submission_marks where id=new.submission_mark_id;
 if cap is null then raise exception 'Rubric criterion not found'; end if;
 if mark_rubric is null or mark_rubric<>criterion_rubric then raise exception 'Criterion does not belong to submission rubric'; end if;
 if new.score>cap then raise exception 'Criterion score exceeds criterion maximum'; end if;
 return new;
end $$;

drop trigger if exists ce_validate_criterion_mark on public.submission_criterion_marks;
create trigger ce_validate_criterion_mark before insert or update on public.submission_criterion_marks for each row execute function public.ce_validate_criterion_mark();

create or replace function public.ce_validate_submission_mark_release()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare rubric_max numeric; criterion_total numeric; awarded_total numeric;
begin
 new.updated_at:=now();
 if new.status='released' then
   new.marked_at:=coalesce(new.marked_at,now());
   if new.rubric_id is not null then
     select max_score into rubric_max from public.assessment_rubrics where id=new.rubric_id and status='active';
     if rubric_max is null then raise exception 'Active rubric required for release'; end if;
     select coalesce(sum(max_score),0) into criterion_total from public.assessment_rubric_criteria where rubric_id=new.rubric_id;
     if criterion_total<>rubric_max then raise exception 'Rubric criteria total % must equal rubric max %',criterion_total,rubric_max; end if;
     select coalesce(sum(cm.score),0) into awarded_total from public.submission_criterion_marks cm where cm.submission_mark_id=new.id;
     if awarded_total<>new.score then raise exception 'Criterion scores total % must equal mark score %',awarded_total,new.score; end if;
     if new.max_score<>rubric_max then raise exception 'Submission max score must equal rubric max score'; end if;
   end if;
 end if;
 return new;
end $$;

drop trigger if exists ce_validate_submission_mark_release on public.submission_marks;
create trigger ce_validate_submission_mark_release before insert or update on public.submission_marks for each row execute function public.ce_validate_submission_mark_release();

alter table public.competency_evidence_ledger
  add column weight numeric(6,3) not null default 1,
  add column school_id uuid references public.schools(id) on delete set null,
  add column class_id uuid references public.classes(id) on delete set null,
  add column subject_id uuid references public.subjects(id) on delete set null,
  add constraint competency_evidence_weight_positive check(weight>0);

create unique index competency_evidence_source_uidx
on public.competency_evidence_ledger(evidence_source,evidence_id,outcome_id)
where evidence_id is not null;

create or replace function public.ce_refresh_student_outcome_mastery(p_student_id uuid,p_outcome_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_score numeric; v_count integer; v_last timestamptz; v_level text;
begin
 select sum((score/max_score*100)*weight)/nullif(sum(weight),0),count(*),max(observed_at)
 into v_score,v_count,v_last
 from public.competency_evidence_ledger
 where student_id=p_student_id and outcome_id=p_outcome_id and score is not null and max_score is not null and max_score>0;
 v_level:=case when v_count=0 then 'not_started' when coalesce(v_score,0)<40 then 'needs_intervention' when v_score<55 then 'emerging' when v_score<70 then 'developing' when v_score<85 then 'meeting' else 'exceeding' end;
 insert into public.student_outcome_mastery(student_id,outcome_id,mastery_level,mastery_score,evidence_count,last_evidence_at)
 values(p_student_id,p_outcome_id,v_level,v_score,v_count,v_last)
 on conflict(student_id,outcome_id) do update set mastery_level=excluded.mastery_level,mastery_score=excluded.mastery_score,evidence_count=excluded.evidence_count,last_evidence_at=excluded.last_evidence_at,updated_at=now();
end $$;

create or replace function public.ce_ingest_released_mark_competency()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare rec record; source_weight numeric;
begin
 if new.status<>'released' then return new; end if;
 source_weight:=case when new.rubric_id is null then 1 else 1.2 end;
 for rec in
   select distinct al.student_id,rc.outcome_id,a.school_id,a.class_id,a.subject_id
   from public.content_submission_evidence e
   join public.content_assignment_learners al on al.id=e.assignment_learner_id
   join public.vibe_chapter_assignments a on a.id=al.assignment_id
   join public.assessment_rubric_criteria rc on rc.rubric_id=new.rubric_id and rc.outcome_id is not null
   where e.id=new.evidence_id
 loop
   insert into public.competency_evidence_ledger(student_id,outcome_id,evidence_source,evidence_id,score,max_score,observed_by,observed_at,weight,school_id,class_id,subject_id)
   values(rec.student_id,rec.outcome_id,'submission_mark',new.id,new.score,new.max_score,new.marker_id,coalesce(new.marked_at,now()),source_weight,rec.school_id,rec.class_id,rec.subject_id)
   on conflict(evidence_source,evidence_id,outcome_id) where evidence_id is not null do update set score=excluded.score,max_score=excluded.max_score,observed_by=excluded.observed_by,observed_at=excluded.observed_at,weight=excluded.weight;
 end loop;
 return new;
end $$;

drop trigger if exists ce_ingest_released_mark_competency on public.submission_marks;
create trigger ce_ingest_released_mark_competency after insert or update of status,score,max_score on public.submission_marks for each row execute function public.ce_ingest_released_mark_competency();

create or replace function public.ce_validate_assessment_item_source()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare bp uuid; block_chapter uuid; resource_chapter uuid;
begin
 select blueprint_id into bp from public.generated_assessments where id=new.assessment_id;
 if bp is null then raise exception 'Assessment not found'; end if;
 if new.source_resource_id is null then raise exception 'Generated item must preserve a source resource'; end if;
 if not exists(select 1 from public.content_assessment_sources s where s.blueprint_id=bp and s.resource_id=new.source_resource_id and (new.outcome_id is null or s.outcome_id is null or s.outcome_id=new.outcome_id)) then raise exception 'Item source is not approved by blueprint'; end if;
 if new.source_block_id is not null then
   select chapter_id into block_chapter from public.content_blocks where id=new.source_block_id;
   select chapter_id into resource_chapter from public.learning_resources where id=new.source_resource_id;
   if block_chapter is null or resource_chapter is null or block_chapter<>resource_chapter then raise exception 'Source block does not belong to source resource chapter'; end if;
 end if;
 return new;
end $$;

drop trigger if exists ce_validate_assessment_item_source on public.generated_assessment_items;
create trigger ce_validate_assessment_item_source before insert or update on public.generated_assessment_items for each row execute function public.ce_validate_assessment_item_source();

create or replace function public.ce_validate_generated_assessment_state()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare item_total integer; blueprint_total integer;
begin
 if new.status in('approved','published') then
   select coalesce(sum(marks),0) into item_total from public.generated_assessment_items where assessment_id=new.id;
   select total_marks into blueprint_total from public.content_assessment_blueprints where id=new.blueprint_id;
   if item_total<>new.total_marks or new.total_marks<>blueprint_total then raise exception 'Assessment item, version and blueprint marks must match'; end if;
   if new.approved_by is null then new.approved_by:=auth.uid(); end if;
   new.approved_at:=coalesce(new.approved_at,now());
 end if;
 return new;
end $$;

drop trigger if exists ce_validate_generated_assessment_state on public.generated_assessments;
create trigger ce_validate_generated_assessment_state before update of status,total_marks on public.generated_assessments for each row execute function public.ce_validate_generated_assessment_state();

create or replace function public.ce_refresh_content_engine_daily_metrics(p_metric_date date default current_date)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer;
begin
 delete from public.content_engine_daily_metrics where metric_date=p_metric_date;
 insert into public.content_engine_daily_metrics(metric_date,school_id,teacher_id,class_id,subject_id,metric_key,metric_value,dimensions)
 select p_metric_date,a.school_id,a.teacher_id,a.class_id,a.subject_id,m.metric_key,m.metric_value,'{}'::jsonb
 from public.vibe_chapter_assignments a
 cross join lateral (values
  ('assignments_created',case when a.assigned_at::date=p_metric_date then 1::numeric else 0 end),
  ('learners_assigned',(select count(*)::numeric from public.content_assignment_learners al where al.assignment_id=a.id)),
  ('learners_completed',(select count(*)::numeric from public.content_assignment_learners al where al.assignment_id=a.id and al.status='completed')),
  ('released_marks',(select count(*)::numeric from public.submission_marks sm join public.content_submission_evidence e on e.id=sm.evidence_id join public.content_assignment_learners al on al.id=e.assignment_learner_id where al.assignment_id=a.id and sm.status='released'))
 ) m(metric_key,metric_value)
 where m.metric_value<>0;
 get diagnostics n=row_count; return n;
end $$;
revoke all on function public.ce_refresh_content_engine_daily_metrics(date) from public,anon,authenticated;
grant execute on function public.ce_refresh_content_engine_daily_metrics(date) to service_role;

drop policy if exists parent_summaries_student_read on public.parent_learning_summaries;
create policy parent_summaries_learner_parent_read on public.parent_learning_summaries for select to authenticated using(
 status='published' and (
   exists(select 1 from public.students s where s.id=student_id and s.profile_id=(select auth.uid()))
   or exists(select 1 from public.parent_student_links psl where psl.student_id=parent_learning_summaries.student_id and psl.parent_id=(select auth.uid()) and coalesce(psl.access_level,'full')<>'none')
   or exists(select 1 from public.parent_students ps where ps.student_id=parent_learning_summaries.student_id and ps.parent_id=(select auth.uid()))
 )
);

create or replace function public.ce_publish_parent_learning_summary(p_summary_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.parent_learning_summaries%rowtype; caller uuid:=auth.uid();
begin
 select * into s from public.parent_learning_summaries where id=p_summary_id;
 if not found then raise exception 'Summary not found'; end if;
 if caller is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.teacher_classes tc where tc.teacher_id=caller and tc.class_id=s.class_id and tc.is_class_teacher) and not public.is_school_admin(s.school_id) then raise exception 'Only class teacher or school admin may publish'; end if;
 if s.status not in('approved','published') or s.approved_by is null or s.approved_at is null then raise exception 'Summary must be approved first'; end if;
 update public.parent_learning_summaries set status='published',published_at=coalesce(published_at,now()) where id=p_summary_id;
end $$;
revoke all on function public.ce_publish_parent_learning_summary(uuid) from public,anon;
grant execute on function public.ce_publish_parent_learning_summary(uuid) to authenticated,service_role;

create or replace function public.ce_full_integrity_audit()
returns table(check_key text,severity text,issue_count bigint,detail text)
language sql security definer set search_path=public,pg_temp as $$
 select 'assignment_missing_resource','critical',count(*),'Classroom assignment lacks authoritative resource' from public.vibe_chapter_assignments where resource_id is null
 union all select 'assignment_resource_mismatch','critical',count(*),'Assignment resource does not match publication/chapter' from public.vibe_chapter_assignments a join public.learning_resources r on r.id=a.resource_id where r.publication_id<>a.publication_id or r.chapter_id<>a.chapter_id
 union all select 'assignment_without_learner_snapshot','high',count(*),'Assignment has no learner snapshot despite current class learners' from public.vibe_chapter_assignments a where exists(select 1 from public.student_classes sc where sc.class_id=a.class_id and sc.school_id=a.school_id and sc.is_current) and not exists(select 1 from public.content_assignment_learners al where al.assignment_id=a.id)
 union all select 'orphan_submission_evidence','critical',count(*),'Evidence has no learner assignment' from public.content_submission_evidence e left join public.content_assignment_learners al on al.id=e.assignment_learner_id where al.id is null
 union all select 'released_mark_without_timestamp','high',count(*),'Released mark lacks marked_at' from public.submission_marks where status='released' and marked_at is null
 union all select 'rubric_total_mismatch','high',count(*),'Active rubric criteria do not sum to rubric maximum' from public.assessment_rubrics r where r.status='active' and r.max_score<>(select coalesce(sum(c.max_score),0) from public.assessment_rubric_criteria c where c.rubric_id=r.id)
 union all select 'mastery_out_of_range','critical',count(*),'Mastery score outside 0..100' from public.student_outcome_mastery where mastery_score is not null and (mastery_score<0 or mastery_score>100)
 union all select 'approved_assessment_marks_mismatch','critical',count(*),'Approved assessment mark total mismatch' from public.generated_assessments a where a.status in('approved','published') and a.total_marks<>(select coalesce(sum(i.marks),0) from public.generated_assessment_items i where i.assessment_id=a.id)
 union all select 'published_parent_summary_unapproved','critical',count(*),'Published parent summary lacks approval' from public.parent_learning_summaries where status='published' and (approved_by is null or approved_at is null or published_at is null)
 union all select check_key,severity,issue_count,detail from public.content_engine_integrity_audit();
$$;
revoke all on function public.ce_full_integrity_audit() from public,anon,authenticated;
grant execute on function public.ce_full_integrity_audit() to service_role;

commit;
