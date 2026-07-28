-- Behavioral fix 5 (grant hygiene, audit F-09): align the two remaining
-- timetable RPCs with the fix18c lockdown pattern.
revoke execute on function public.create_timetable_slot(uuid, uuid, integer, time, time, text, date, date) from public;
revoke execute on function public.create_timetable_slot(uuid, uuid, integer, time, time, text, date, date) from anon;
grant execute on function public.create_timetable_slot(uuid, uuid, integer, time, time, text, date, date) to authenticated;
grant execute on function public.create_timetable_slot(uuid, uuid, integer, time, time, text, date, date) to service_role;

revoke execute on function public.get_teacher_weekly_timetable_load() from public;
revoke execute on function public.get_teacher_weekly_timetable_load() from anon;
grant execute on function public.get_teacher_weekly_timetable_load() to authenticated;
grant execute on function public.get_teacher_weekly_timetable_load() to service_role;
