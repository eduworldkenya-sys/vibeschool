-- Consolidated repository parity migration for production CE-010 through CE-015.
-- Production ledger contains six separately applied migrations with matching section names.

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

commit;
