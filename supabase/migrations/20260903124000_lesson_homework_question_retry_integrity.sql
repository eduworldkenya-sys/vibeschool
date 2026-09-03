begin;

-- Lesson-owned homework is idempotent by lesson_plan_id. Its generated question
-- children need the same retry guarantee: a network/database failure after the
-- homework row is created must not produce duplicate question positions when a
-- teacher retries the share/delivery action.
create unique index if not exists uq_homework_questions_homework_order
  on public.homework_questions(homework_id, order_num)
  where homework_id is not null;

commit;
