begin;

create table public.assessment_definitions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  class_id uuid null references public.classes(id) on delete set null,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  lesson_plan_id uuid null references public.lesson_plans(id) on delete set null,
  teaching_occurrence_id uuid null references public.teaching_occurrences(id) on delete set null,
  source_resource_id uuid null references public.learning_resources(id) on delete set null,
  assessment_type text not null,
  title text not null,
  description text null,
  instructions text null,
  status text not null default 'draft',
  version integer not null default 1,
  total_marks numeric(10,2) not null default 0,
  estimated_minutes integer null,
  generation_source text not null default 'teacher_authored',
  generation_metadata jsonb not null default '{}'::jsonb,
  approved_by uuid null references public.profiles(id) on delete set null,
  approved_at timestamptz null,
  published_at timestamptz null,
  closed_at timestamptz null,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_definitions_type_chk check (assessment_type in ('exercise','homework','quiz','test','exam','practice','diagnostic')),
  constraint assessment_definitions_status_chk check (status in ('draft','review','approved','assigned','open','closed','archived')),
  constraint assessment_definitions_version_chk check (version > 0),
  constraint assessment_definitions_total_marks_chk check (total_marks >= 0),
  constraint assessment_definitions_estimated_minutes_chk check (estimated_minutes is null or estimated_minutes > 0),
  constraint assessment_definitions_title_chk check (btrim(title) <> ''),
  constraint assessment_definitions_approval_chk check (
    (status in ('draft','review') and approved_at is null)
    or
    (status in ('approved','assigned','open','closed','archived') and approved_at is not null)
  )
);

create table public.assessment_items (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessment_definitions(id) on delete cascade,
  source_item_id uuid null references public.assessment_items(id) on delete set null,
  source_resource_id uuid null references public.learning_resources(id) on delete set null,
  source_exercise_ref jsonb null,
  source_homework_question_id uuid null references public.homework_questions(id) on delete set null,
  source_exam_question_id uuid null references public.exam_question_bank(id) on delete set null,
  question_type text not null,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  accepted_answers jsonb not null default '[]'::jsonb,
  correct_answer jsonb null,
  marking_guide jsonb not null default '{}'::jsonb,
  worked_solution text null,
  explanation text null,
  hint text null,
  teacher_notes text null,
  media jsonb not null default '[]'::jsonb,
  marks numeric(10,2) not null default 1,
  difficulty text null,
  bloom_level text null,
  auto_marking_mode text not null default 'none',
  order_num integer not null,
  status text not null default 'draft',
  generated_by text not null default 'teacher',
  teacher_approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_items_type_chk check (question_type in ('multiple_choice','multiple_response','true_false','fill_blank','matching','ordering','numeric','short_answer','structured','essay','drawing','practical','oral','file_upload','audio','video')),
  constraint assessment_items_marks_chk check (marks > 0),
  constraint assessment_items_order_chk check (order_num > 0),
  constraint assessment_items_status_chk check (status in ('draft','approved','retired')),
  constraint assessment_items_auto_mark_chk check (auto_marking_mode in ('none','exact','case_insensitive','numeric_tolerance','option_match','set_match','ordered_match')),
  constraint assessment_items_prompt_chk check (btrim(prompt) <> ''),
  unique (assessment_id, order_num)
);

create table public.assessment_item_outcomes (
  assessment_item_id uuid not null references public.assessment_items(id) on delete cascade,
  outcome_id uuid not null references public.curriculum_learning_outcomes(id) on delete restrict,
  weight numeric(8,4) not null default 1,
  created_at timestamptz not null default now(),
  primary key (assessment_item_id, outcome_id),
  constraint assessment_item_outcomes_weight_chk check (weight > 0)
);

create table public.assessment_assignments (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessment_definitions(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  target_group_id uuid null references public.class_groups(id) on delete set null,
  status text not null default 'draft',
  opens_at timestamptz null,
  closes_at timestamptz null,
  time_limit_minutes integer null,
  max_attempts integer not null default 1,
  randomize_items boolean not null default false,
  randomize_options boolean not null default false,
  show_score_policy text not null default 'after_review',
  assigned_at timestamptz null,
  closed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_assignments_status_chk check (status in ('draft','assigned','open','closed','cancelled','archived')),
  constraint assessment_assignments_time_limit_chk check (time_limit_minutes is null or time_limit_minutes > 0),
  constraint assessment_assignments_attempts_chk check (max_attempts > 0),
  constraint assessment_assignments_score_policy_chk check (show_score_policy in ('immediate','after_close','after_review','never')),
  constraint assessment_assignments_window_chk check (closes_at is null or opens_at is null or closes_at > opens_at)
);

create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assessment_assignments(id) on delete cascade,
  assessment_id uuid not null references public.assessment_definitions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  attempt_number integer not null default 1,
  status text not null default 'in_progress',
  started_at timestamptz not null default now(),
  last_saved_at timestamptz not null default now(),
  submitted_at timestamptz null,
  auto_marked_at timestamptz null,
  teacher_reviewed_at timestamptz null,
  reviewed_by uuid null references public.profiles(id) on delete set null,
  score numeric(10,2) null,
  max_score numeric(10,2) null,
  percentage numeric(7,3) null,
  result_status text not null default 'pending',
  feedback text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_attempts_number_chk check (attempt_number > 0),
  constraint assessment_attempts_status_chk check (status in ('in_progress','submitted','auto_marked','teacher_review','marked','released','void')),
  constraint assessment_attempts_result_status_chk check (result_status in ('pending','partially_marked','marked','released','void')),
  constraint assessment_attempts_scores_chk check (
    (score is null or score >= 0)
    and (max_score is null or max_score >= 0)
    and (percentage is null or (percentage >= 0 and percentage <= 100))
  ),
  unique (assignment_id, student_id, attempt_number)
);

create table public.assessment_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  assessment_item_id uuid not null references public.assessment_items(id) on delete restrict,
  response_value jsonb not null default 'null'::jsonb,
  response_text text null,
  status text not null default 'saved',
  auto_score numeric(10,2) null,
  teacher_score numeric(10,2) null,
  final_score numeric(10,2) null,
  max_score numeric(10,2) not null,
  auto_mark_result jsonb null,
  teacher_feedback text null,
  teacher_override_reason text null,
  marked_by uuid null references public.profiles(id) on delete set null,
  marked_at timestamptz null,
  first_saved_at timestamptz not null default now(),
  last_saved_at timestamptz not null default now(),
  submitted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_responses_status_chk check (status in ('saved','submitted','auto_marked','teacher_review','marked','void')),
  constraint assessment_responses_scores_chk check (
    max_score > 0
    and (auto_score is null or (auto_score >= 0 and auto_score <= max_score))
    and (teacher_score is null or (teacher_score >= 0 and teacher_score <= max_score))
    and (final_score is null or (final_score >= 0 and final_score <= max_score))
  ),
  unique (attempt_id, assessment_item_id)
);

create index assessment_definitions_teacher_idx on public.assessment_definitions(teacher_id, created_at desc);
create index assessment_definitions_class_subject_idx on public.assessment_definitions(class_id, subject_id, created_at desc);
create index assessment_definitions_lesson_idx on public.assessment_definitions(lesson_plan_id) where lesson_plan_id is not null;
create index assessment_definitions_occurrence_idx on public.assessment_definitions(teaching_occurrence_id) where teaching_occurrence_id is not null;
create index assessment_items_assessment_idx on public.assessment_items(assessment_id, order_num);
create index assessment_items_source_resource_idx on public.assessment_items(source_resource_id) where source_resource_id is not null;
create index assessment_item_outcomes_outcome_idx on public.assessment_item_outcomes(outcome_id);
create index assessment_assignments_class_idx on public.assessment_assignments(class_id, status, opens_at);
create index assessment_assignments_assessment_idx on public.assessment_assignments(assessment_id);
create index assessment_attempts_student_idx on public.assessment_attempts(student_id, created_at desc);
create index assessment_attempts_assignment_status_idx on public.assessment_attempts(assignment_id, status);
create unique index assessment_attempts_one_active_uidx on public.assessment_attempts(assignment_id, student_id) where status = 'in_progress';
create index assessment_responses_attempt_idx on public.assessment_responses(attempt_id);
create index assessment_responses_item_idx on public.assessment_responses(assessment_item_id);

alter table public.assessment_definitions enable row level security;
alter table public.assessment_items enable row level security;
alter table public.assessment_item_outcomes enable row level security;
alter table public.assessment_assignments enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.assessment_responses enable row level security;

create policy assessment_definitions_teacher_manage on public.assessment_definitions for all to authenticated
using (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.teacher_classes tc
    where tc.teacher_id = (select auth.uid())
      and tc.school_id = assessment_definitions.school_id
      and (assessment_definitions.class_id is null or tc.class_id = assessment_definitions.class_id)
      and tc.subject_id = assessment_definitions.subject_id
  )
)
with check (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.teacher_classes tc
    where tc.teacher_id = (select auth.uid())
      and tc.school_id = assessment_definitions.school_id
      and (assessment_definitions.class_id is null or tc.class_id = assessment_definitions.class_id)
      and tc.subject_id = assessment_definitions.subject_id
  )
);

create policy assessment_items_teacher_manage on public.assessment_items for all to authenticated
using (exists (select 1 from public.assessment_definitions ad where ad.id = assessment_items.assessment_id and ad.teacher_id = (select auth.uid())))
with check (exists (select 1 from public.assessment_definitions ad where ad.id = assessment_items.assessment_id and ad.teacher_id = (select auth.uid())));

create policy assessment_item_outcomes_teacher_manage on public.assessment_item_outcomes for all to authenticated
using (
  exists (
    select 1 from public.assessment_items ai
    join public.assessment_definitions ad on ad.id = ai.assessment_id
    where ai.id = assessment_item_outcomes.assessment_item_id
      and ad.teacher_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.assessment_items ai
    join public.assessment_definitions ad on ad.id = ai.assessment_id
    where ai.id = assessment_item_outcomes.assessment_item_id
      and ad.teacher_id = (select auth.uid())
  )
);

create policy assessment_assignments_teacher_manage on public.assessment_assignments for all to authenticated
using (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.teacher_classes tc
    where tc.teacher_id = (select auth.uid())
      and tc.school_id = assessment_assignments.school_id
      and tc.class_id = assessment_assignments.class_id
  )
)
with check (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.teacher_classes tc
    where tc.teacher_id = (select auth.uid())
      and tc.school_id = assessment_assignments.school_id
      and tc.class_id = assessment_assignments.class_id
  )
);

create policy assessment_assignments_student_read on public.assessment_assignments for select to authenticated
using (
  status in ('assigned','open','closed')
  and exists (
    select 1
    from public.students s
    join public.student_classes sc on sc.student_id = s.id and sc.is_current = true
    where s.profile_id = (select auth.uid())
      and sc.class_id = assessment_assignments.class_id
      and sc.school_id = assessment_assignments.school_id
  )
);

create policy assessment_attempts_student_read on public.assessment_attempts for select to authenticated
using (exists (select 1 from public.students s where s.id = assessment_attempts.student_id and s.profile_id = (select auth.uid())));

create policy assessment_attempts_teacher_read on public.assessment_attempts for select to authenticated
using (exists (select 1 from public.assessment_assignments aa where aa.id = assessment_attempts.assignment_id and aa.teacher_id = (select auth.uid())));

create policy assessment_responses_student_read on public.assessment_responses for select to authenticated
using (
  exists (
    select 1 from public.assessment_attempts at
    join public.students s on s.id = at.student_id
    where at.id = assessment_responses.attempt_id
      and s.profile_id = (select auth.uid())
  )
);

create policy assessment_responses_teacher_read on public.assessment_responses for select to authenticated
using (
  exists (
    select 1 from public.assessment_attempts at
    join public.assessment_assignments aa on aa.id = at.assignment_id
    where at.id = assessment_responses.attempt_id
      and aa.teacher_id = (select auth.uid())
  )
);

comment on table public.assessment_definitions is 'Unified authority for exercises, homework, quizzes, tests, exams, practice and diagnostics.';
comment on table public.assessment_items is 'Reusable, version-safe assessment questions with source, marking and curriculum metadata.';
comment on table public.assessment_assignments is 'Class delivery configuration for an approved assessment.';
comment on table public.assessment_attempts is 'One learner attempt lifecycle for an assessment assignment.';
comment on table public.assessment_responses is 'Autosaved learner responses and per-item marking state.';

commit;
