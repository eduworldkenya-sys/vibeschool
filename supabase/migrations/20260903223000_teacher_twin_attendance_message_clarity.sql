begin;

-- A teacher can be viewing a completed lesson while another earlier/later started
-- slot still lacks attendance. The old copy sounded like the currently visible
-- lesson was incomplete. Preserve the deterministic attendance truth while making
-- the scope explicit. Patch both supported overloads fail-closed from their
-- authoritative definitions so no parallel Twin implementation is introduced.
do $$
declare
  target regprocedure;
  definition text;
  old_text text := $$'reason',format('%s started timetable slot%s have no attendance record today.',v_attendance_pending,case when v_attendance_pending=1 then '' else 's' end)$$;
  new_text text := $$'reason',format('%s started timetable slot%s elsewhere in today''s schedule %s no attendance record.',v_attendance_pending,case when v_attendance_pending=1 then '' else 's' end,case when v_attendance_pending=1 then 'has' else 'have' end)$$;
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
$$;

commit;
