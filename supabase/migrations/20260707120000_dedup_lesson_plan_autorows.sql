create unique index if not exists uq_homework_lesson_plan_id
  on homework(lesson_plan_id) where lesson_plan_id is not null;

create unique index if not exists uq_assessments_lesson_plan_id
  on assessments(lesson_plan_id) where lesson_plan_id is not null;

create unique index if not exists uq_exercises_lesson_plan_id
  on exercises(lesson_plan_id) where lesson_plan_id is not null;
