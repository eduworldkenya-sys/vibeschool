-- Composite indexes to support week/month/term/year range lookups
-- for a single class and for a single student.
create index if not exists idx_attendance_class_date on public.attendance (class_id, date);
create index if not exists idx_attendance_student_date on public.attendance (student_id, date);
