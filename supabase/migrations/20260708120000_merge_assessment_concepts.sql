alter table cbc_assessments add column if not exists lesson_plan_id uuid references lesson_plans(id) on delete set null;
alter table cbc_assessments add column if not exists homework_id uuid references homework(id) on delete set null;
create index if not exists idx_cbc_assessments_lesson_plan_id on cbc_assessments(lesson_plan_id);
create index if not exists idx_cbc_assessments_homework_id on cbc_assessments(homework_id);

comment on table assessments is 'DEPRECATED 2026-07-08: superseded by cbc_assessments.lesson_plan_id/homework_id. Do not write new data here.';
comment on table assessment_scores is 'DEPRECATED 2026-07-08: superseded by cbc_assessments. Do not write new data here.';
