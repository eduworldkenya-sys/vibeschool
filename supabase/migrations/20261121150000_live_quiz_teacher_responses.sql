-- Live teacher quiz repair: preserve per-question submissions across the full
-- authorized lesson history, without any learner-visible cross-student data.
-- Also accept an answer to the *same still-open prompt* when unrelated chat,
-- hand or roster events have incremented the room version.
-- authorization-test: scripts/test-live-classroom-pilot.mjs
BEGIN;
DO $migration$
DECLARE
  src text := pg_get_functiondef('vibe_live.command(text,uuid,uuid,integer,jsonb)'::regprocedure);
  old text;
  replacement text;
BEGIN
  IF position('responsesByPrompt' in src)>0 THEN
    RAISE EXCEPTION 'Live answer projection already exists; review migration drift';
  END IF;

  old := $anchor$if room.status<>'active' or p_version is distinct from room.version then raise exception 'live_stale_or_paused'; end if;$anchor$;
  replacement := $body$if room.status<>'active' then raise exception 'live_stale_or_paused'; end if;
    -- An optimistic room-version mismatch alone must not discard a valid
    -- answer. The current prompt UUID, unrevealed state and learner
    -- authorization are still checked immediately below under room lock.$body$;
  IF (length(src)-length(replace(src,old,'')))/length(old) <> 1 THEN
    RAISE EXCEPTION 'Canonical live answer version guard has changed';
  END IF;
  src := replace(src,old,replacement);

  old := ' return result;';
  replacement := $body$
  -- Teacher-only, current-entitlement-filtered submissions for *every* quiz,
  -- exercise and poll in this exact session. Non-teachers receive no key.
  -- Keep private responses in vibe_live; do not grant direct table SELECT.
  IF is_teacher THEN
    result := result || jsonb_build_object('responsesByPrompt',coalesce((
      SELECT jsonb_object_agg(by_prompt.prompt_id,by_prompt.answers)
      FROM (
        SELECT a.prompt_id::text AS prompt_id,
          jsonb_agg(jsonb_build_object(
            'studentId',a.student_id,'name',s.name,
            'body',a.body,'submittedAt',a.submitted_at
          ) ORDER BY a.submitted_at,a.student_id) AS answers
        FROM vibe_live.responses a
        JOIN vibe_live.prompts q ON q.id=a.prompt_id
          AND q.session_id=room.id AND q.kind IN ('quiz','exercise','poll')
        JOIN vibe_live.participants p ON p.session_id=room.id
          AND p.student_id=a.student_id
        JOIN public.students s ON s.id=a.student_id AND s.deleted_at IS NULL
        WHERE vibe_live.can_join(s.id,room.teacher_id,room.mode,
          room.class_id,room.school_id,room.group_id)
        GROUP BY a.prompt_id
      ) by_prompt
    ),'{}'::jsonb));
  END IF;
  return result;$body$;
  IF (length(src)-length(replace(src,old,'')))/length(old) <> 1 THEN
    RAISE EXCEPTION 'Canonical live response return contract has changed';
  END IF;
  src := replace(src,old,replacement);
  EXECUTE src;
END;
$migration$;
COMMIT;
