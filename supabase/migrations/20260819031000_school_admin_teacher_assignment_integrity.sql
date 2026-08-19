-- Task 7: teacher assignment integrity.
-- Production audit before authoring: 0 duplicate school/teacher/class/subject groups.

create unique index if not exists uq_teacher_classes_school_teacher_class_subject
  on public.teacher_classes (school_id, teacher_id, class_id, subject_id);

comment on index public.uq_teacher_classes_school_teacher_class_subject is
  'Task 7: one canonical teacher assignment per school/class/subject combination.';
