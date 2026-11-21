-- No lesson, answer, identity or private message content is ever sent on this channel.
-- Access: existing session host or a joined learner who remains entitled to that room.
-- authorization-test: scripts/test-live-classroom-pilot.mjs exercises private-topic
-- checks, outsider, other-teacher, unjoined, revocation and ended-session denial.
BEGIN;

DO $preflight$
BEGIN
 IF to_regclass('realtime.messages') IS NULL
   OR to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NULL
   OR to_regprocedure('realtime.topic()') IS NULL
 THEN RAISE EXCEPTION 'Realtime is not configured: do not commission Live invalidations'; END IF;
 IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='realtime' AND tablename='messages' AND policyname='vibe_live_room_receive')
 THEN RAISE EXCEPTION 'Live realtime policy already exists: reconcile before applying'; END IF;
END $preflight$;

CREATE FUNCTION vibe_live.can_receive_invalidation(p_topic text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $allowed$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.profiles u
      WHERE u.id=auth.uid() AND u.account_status::text='active'
        AND NOT coalesce(u.is_anonymized,false))
    AND EXISTS (
      SELECT 1 FROM vibe_live.sessions r
      WHERE p_topic='vibe-live:'||r.id::text
        AND r.status IN ('active','paused') AND r.expires_at>now()
        AND (
          (r.teacher_id=auth.uid()
            AND vibe_live.host_allowed(r.teacher_id,r.mode,r.class_id,r.school_id,r.group_id))
          OR EXISTS (
            SELECT 1 FROM vibe_live.participants p
            JOIN public.students s ON s.id=p.student_id AND s.profile_id=auth.uid()
            WHERE p.session_id=r.id
              AND vibe_live.can_join(s.id,r.teacher_id,r.mode,r.class_id,r.school_id,r.group_id)
              AND (SELECT count(*) FROM public.students mine
                   WHERE mine.profile_id=auth.uid() AND vibe_live.eligible_student(mine.id))=1
          )
        )
    );
$allowed$;
REVOKE ALL ON FUNCTION vibe_live.can_receive_invalidation(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION vibe_live.can_receive_invalidation(text) TO authenticated;

-- SELECT authorizes listening only. No browser/client publish, write or presence grants.
CREATE POLICY vibe_live_room_receive ON realtime.messages
FOR SELECT TO authenticated
USING (realtime.topic() LIKE 'vibe-live:%' AND vibe_live.can_receive_invalidation(realtime.topic()));

CREATE FUNCTION vibe_live.broadcast_room_invalidation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $notify$
DECLARE
  sid uuid;
BEGIN
  IF TG_TABLE_NAME='sessions' THEN sid:=NEW.id;
  ELSIF TG_TABLE_NAME='responses' THEN
    SELECT p.session_id INTO sid FROM vibe_live.prompts p WHERE p.id=NEW.prompt_id;
  ELSE sid:=NEW.session_id; END IF;
  IF sid IS NULL THEN RETURN NEW; END IF;
  BEGIN
    PERFORM realtime.send(
      jsonb_build_object('invalidate',true),
      'refresh',
      'vibe-live:'||sid::text,
      true
    );
  EXCEPTION WHEN OTHERS THEN
    -- The authorized RPC remains authoritative even if Broadcast is unavailable;
    -- the client retains bounded polling. Never roll back a live lesson for WS outage.
    RAISE WARNING 'vibe_live invalidation unavailable; authorized RPC polling remains active';
  END;
  RETURN NEW;
END;
$notify$;
REVOKE ALL ON FUNCTION vibe_live.broadcast_room_invalidation() FROM PUBLIC,anon,authenticated,service_role;

CREATE TRIGGER live_broadcast_session AFTER INSERT OR UPDATE ON vibe_live.sessions
FOR EACH ROW EXECUTE FUNCTION vibe_live.broadcast_room_invalidation();
CREATE TRIGGER live_broadcast_prompt AFTER INSERT OR UPDATE ON vibe_live.prompts
FOR EACH ROW EXECUTE FUNCTION vibe_live.broadcast_room_invalidation();
CREATE TRIGGER live_broadcast_participant AFTER INSERT OR UPDATE ON vibe_live.participants
FOR EACH ROW EXECUTE FUNCTION vibe_live.broadcast_room_invalidation();
CREATE TRIGGER live_broadcast_response AFTER INSERT OR UPDATE ON vibe_live.responses
FOR EACH ROW EXECUTE FUNCTION vibe_live.broadcast_room_invalidation();
CREATE TRIGGER live_broadcast_question AFTER INSERT OR UPDATE ON vibe_live.learner_questions
FOR EACH ROW EXECUTE FUNCTION vibe_live.broadcast_room_invalidation();
CREATE TRIGGER live_broadcast_message AFTER INSERT OR UPDATE ON vibe_live.private_messages
FOR EACH ROW EXECUTE FUNCTION vibe_live.broadcast_room_invalidation();
COMMIT;
