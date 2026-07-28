revoke execute on function public.upsert_attendance_batch(jsonb) from anon;
revoke execute on function public.upsert_attendance_batch(jsonb) from public;
grant execute on function public.upsert_attendance_batch(jsonb) to authenticated;
