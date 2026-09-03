begin;

-- A teacher can be viewing a completed lesson while another started slot still
-- lacks attendance. Preserve deterministic attendance truth while making the
-- scope explicit. This is the exact production-ledger version applied live.
do $do$
declare
  target regprocedure;
  definition text;
  old_text text := $txt$'reason',format('%s started timetable slot%s have no attendance record today.',v_attendance_pending,case when v_attendance_pending=1 then '' else 's' end)$txt$;
  new_text text := $txt$'reason',format('%s started timetable slot%s elsewhere in today''s schedule %s no attendance record.',v_attendance_pending,case when v_attendance_pending=1 then '' else 's' end,case when v_attendance_pending=1 then 'has' else 'have' end)$txt$;
begin
  foreach target in array array[
    to_regprocedure('public.teacher_get_twin_brain(uuid)'),
    to_regprocedure('public.teacher_get_twin_brain()')
  ]
  loop
    if target is null then
      continue;
    end if;
    definition := pg_get_functiondef(target);
    if position(old_text in definition) > 0 then
      execute replace(definition, old_text, new_text);
    end if;
  end loop;
end;
$do$;

commit;
