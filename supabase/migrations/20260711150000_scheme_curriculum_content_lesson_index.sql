alter table scheme_of_work add column if not exists curriculum_content_lesson_index int;
comment on column scheme_of_work.curriculum_content_lesson_index is
  'Index into curriculum_content.lesson_context.lessons[] — a substrand can cover multiple individual lessons. NULL means lessons[0].';
