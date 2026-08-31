begin;

alter table public.lesson_plans
  drop constraint if exists lesson_plans_generated_by_check;

alter table public.lesson_plans
  add constraint lesson_plans_generated_by_check
  check (generated_by = any(array[
    'manual',
    'twin',
    'deterministic',
    'ai_assisted'
  ]::text[]));

comment on column public.lesson_plans.generated_by is
  'Lesson-plan creation provenance. deterministic means Scheme/content/template assembly with no model call; ai_assisted is explicit model-assisted adaptation; twin is retained for historical compatibility.';

commit;
