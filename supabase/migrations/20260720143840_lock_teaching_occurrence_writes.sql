-- Behavioral fix 2 (audit F-07): direct INSERT policy checked only
-- teacher_id = auth.uid(), letting any teacher squat another teacher's
-- (slot, date) occurrence identity and permanently block their Start Lesson.
-- All lifecycle writes go through the SECURITY DEFINER RPCs
-- (start_teaching_occurrence / complete_teaching_occurrence /
-- generate_daily_occurrences), which bypass RLS — no client writes needed.
drop policy if exists teaching_occurrences_teacher_write on public.teaching_occurrences;
drop policy if exists teaching_occurrences_teacher_update on public.teaching_occurrences;
-- read policies (teacher_read / admin_read) remain untouched.
