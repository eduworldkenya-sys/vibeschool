-- Scheduled private tuition uses the existing Live Classroom and its exact
-- accepted-invitation audience. No duplicate room or admission engine.
BEGIN;
-- access: service-only vibe_live.tuition_booking_rooms
-- authorization-test: scripts/test-live-tuition-booking.mjs denies direct client reads and cross-booking joins.
CREATE TABLE vibe_live.tuition_booking_rooms (
 group_id uuid PRIMARY KEY REFERENCES public.vibetutor_private_groups(id) ON DELETE CASCADE,
 booking_id uuid UNIQUE REFERENCES public.vibetutor_lessons(id) ON DELETE SET NULL,
 room_id uuid UNIQUE REFERENCES vibe_live.sessions(id) ON DELETE SET NULL,
 started boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vibe_live.tuition_booking_rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vibe_live.tuition_booking_rooms FROM PUBLIC,anon,authenticated,service_role;

-- Once a booking scope is established, no caller can widen the room's audience.
-- Deleting a membership only removes access and is intentionally allowed.
CREATE FUNCTION vibe_live.guard_booking_group_membership() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM vibe_live.tuition_booking_rooms WHERE group_id=NEW.group_id) THEN
   RAISE EXCEPTION 'live_booking_audience_fixed' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER live_booking_group_membership_guard
 BEFORE INSERT OR UPDATE ON public.vibetutor_private_group_members
 FOR EACH ROW EXECUTE FUNCTION vibe_live.guard_booking_group_membership();

-- The normal live start path also obeys the scheduled room constraint. This
-- prevents a reserved group from being reused for a different session.
CREATE FUNCTION vibe_live.guard_booking_room() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE binding vibe_live.tuition_booking_rooms%ROWTYPE; booked public.vibetutor_lessons%ROWTYPE;
BEGIN
 SELECT * INTO binding FROM vibe_live.tuition_booking_rooms WHERE group_id=NEW.group_id;
 IF NOT FOUND THEN RETURN NEW; END IF;
 SELECT * INTO booked FROM public.vibetutor_lessons WHERE id=binding.booking_id FOR UPDATE;
 IF NOT FOUND OR binding.started OR booked.status<>'scheduled'
    OR booked.starts_at>now()+interval '15 minutes' OR booked.ends_at<=now()
    OR NEW.teacher_id<>booked.tutor_id OR NEW.mode<>'tuition' OR NEW.class_id IS NOT NULL
    OR NOT EXISTS(
      SELECT 1 FROM public.vibetutor_private_group_members m
      JOIN public.vibetutor_student_invitations i ON i.id=m.invitation_id
      WHERE m.group_id=NEW.group_id AND m.invitation_id=booked.invitation_id
       AND i.tutor_id=booked.tutor_id AND i.student_id=booked.student_id AND i.status='accepted'
    ) THEN
   RAISE EXCEPTION 'live_booking_unavailable' USING ERRCODE='42501';
 END IF;
 NEW.title:=booked.title;
 NEW.expires_at:=least(NEW.expires_at,booked.ends_at);
 RETURN NEW;
END $$;
CREATE TRIGGER live_booking_room_guard BEFORE INSERT ON vibe_live.sessions
 FOR EACH ROW EXECUTE FUNCTION vibe_live.guard_booking_room();

CREATE FUNCTION vibe_live.bind_booking_room() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE vibe_live.tuition_booking_rooms SET room_id=NEW.id,started=true WHERE group_id=NEW.group_id;
 RETURN NEW;
END $$;
CREATE TRIGGER live_booking_room_bound AFTER INSERT ON vibe_live.sessions
 FOR EACH ROW EXECUTE FUNCTION vibe_live.bind_booking_room();

-- Extend the single existing admission function. Other school, public,
-- homeschool and ordinary private rooms keep their original rules.
CREATE OR REPLACE FUNCTION vibe_live.can_join(
 p_student uuid,p_host uuid,p_mode text,p_class uuid,p_school uuid,p_group uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT vibe_live.eligible_student(p_student)
  AND vibe_live.host_allowed(p_host,p_mode,p_class,p_school,p_group)
  AND (
   (p_mode='school' AND EXISTS(
    SELECT 1 FROM public.student_classes sc WHERE sc.student_id=p_student AND sc.class_id=p_class
     AND sc.school_id=p_school AND sc.is_current))
   OR (p_mode='tuition' AND EXISTS(
    SELECT 1 FROM public.vibetutor_student_invitations i
    WHERE i.student_id=p_student AND i.tutor_id=p_host AND i.status='accepted'
     AND (p_group IS NULL OR EXISTS(
      SELECT 1 FROM public.vibetutor_private_group_members gm
      WHERE gm.group_id=p_group AND gm.invitation_id=i.id))))
   OR (p_mode='homeschool' AND EXISTS(
    SELECT 1 FROM public.parent_student_links l WHERE l.parent_id=p_host AND l.student_id=p_student))
   OR (p_mode='open' AND p_group IS NULL)
  )
  AND (
    NOT EXISTS(SELECT 1 FROM vibe_live.tuition_booking_rooms b WHERE b.group_id=p_group)
    OR EXISTS(
      SELECT 1 FROM vibe_live.tuition_booking_rooms b
      JOIN public.vibetutor_lessons l ON l.id=b.booking_id
      JOIN public.vibetutor_student_invitations i ON i.id=l.invitation_id
      WHERE b.group_id=p_group AND l.status IN ('scheduled','completed')
      AND l.tutor_id=p_host AND l.student_id=p_student
      AND i.tutor_id=l.tutor_id AND i.student_id=l.student_id AND i.status='accepted'
    )
  );
$$;
REVOKE ALL ON FUNCTION vibe_live.can_join(uuid,uuid,text,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION vibe_live.close_cancelled_booking() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='cancelled' AND OLD.status IS DISTINCT FROM NEW.status THEN
   UPDATE vibe_live.sessions s SET status='ended',version=s.version+1
   FROM vibe_live.tuition_booking_rooms b
   WHERE b.booking_id=NEW.id AND s.id=b.room_id AND s.status IN ('active','paused');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER live_booking_cancelled AFTER UPDATE OF status ON public.vibetutor_lessons
 FOR EACH ROW EXECUTE FUNCTION vibe_live.close_cancelled_booking();

-- The authenticated booking id is resolved to its private invitation and
-- stored room on the server. A client cannot choose a group, audience or room.
CREATE FUNCTION public.vibe_live_tuition_booking(p_booking uuid,p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE booked public.vibetutor_lessons%ROWTYPE; binding vibe_live.tuition_booking_rooms%ROWTYPE;
 caller uuid:=auth.uid(); actor text; live_room vibe_live.sessions%ROWTYPE; scope_id uuid; state text;
BEGIN
 IF p_action IS NULL OR p_action NOT IN ('context','start','join') OR caller IS NULL OR
 NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=caller AND p.account_status::text='active' AND NOT coalesce(p.is_anonymized,false))
 THEN RAISE EXCEPTION 'live_not_authorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO booked FROM public.vibetutor_lessons WHERE id=p_booking FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(
   SELECT 1 FROM public.vibetutor_private_access(booked.invitation_id) a
   WHERE a.tutor_id=booked.tutor_id AND a.student_record_id=booked.student_id
 ) THEN RAISE EXCEPTION 'live_not_authorized' USING ERRCODE='42501'; END IF;
 IF caller=booked.tutor_id AND vibe_live.host_allowed(caller,'tuition',null,null,null) THEN actor:='teacher';
 ELSIF EXISTS(SELECT 1 FROM public.students s WHERE s.id=booked.student_id AND s.profile_id=caller)
       AND vibe_live.eligible_student(booked.student_id) THEN actor:='student';
 ELSE RAISE EXCEPTION 'live_not_authorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO binding FROM vibe_live.tuition_booking_rooms WHERE booking_id=booked.id;
 IF binding.room_id IS NOT NULL THEN
   SELECT * INTO live_room FROM vibe_live.sessions WHERE id=binding.room_id;
 END IF;
 state:=CASE WHEN booked.status='cancelled' THEN 'cancelled' WHEN booked.status='completed' THEN 'completed'
   WHEN live_room.status='ended' OR live_room.expires_at<=now() OR booked.ends_at<=now() THEN 'ended'
   WHEN booked.starts_at>now()+interval '15 minutes' THEN 'upcoming' ELSE 'joinable' END;
 IF p_action='context' THEN
   RETURN jsonb_build_object('id',booked.id,'title',booked.title,'role',actor,'state',state,
      'startsAt',booked.starts_at,'endsAt',booked.ends_at,
      'hasJoined',EXISTS(SELECT 1 FROM vibe_live.participants p WHERE p.session_id=binding.room_id AND p.student_id=booked.student_id),
      'roomId',CASE WHEN actor='teacher' OR vibe_live.can_join(booked.student_id,booked.tutor_id,'tuition',null,null,binding.group_id) AND state<>'cancelled' THEN binding.room_id ELSE null END);
 END IF;
 IF state<>'joinable' THEN RAISE EXCEPTION 'live_booking_unavailable'; END IF;
 IF p_action='start' THEN
   IF actor<>'teacher' THEN RAISE EXCEPTION 'live_not_authorized' USING ERRCODE='42501'; END IF;
   IF binding.room_id IS NOT NULL THEN
     RETURN vibe_live.command('get',null,binding.room_id,null,jsonb_build_object('host',true));
   END IF;
   IF binding.started THEN RAISE EXCEPTION 'live_booking_unavailable'; END IF;
   -- This group is created inside the same transaction and is never widened.
   INSERT INTO public.vibetutor_private_groups(tutor_id,title)
   VALUES(booked.tutor_id,left('Scheduled: '||booked.title,100)) RETURNING id INTO scope_id;
   INSERT INTO public.vibetutor_private_group_members(group_id,invitation_id)
   VALUES(scope_id,booked.invitation_id);
   INSERT INTO vibe_live.tuition_booking_rooms(group_id,booking_id) VALUES(scope_id,booked.id);
   RETURN vibe_live.command('start',null,null,null,jsonb_build_object('host',true,'mode','tuition','groupId',scope_id,'title',booked.title));
 END IF;
 IF actor<>'student' OR binding.room_id IS NULL THEN RAISE EXCEPTION 'live_booking_not_started'; END IF;
 RETURN vibe_live.command('join',null,binding.room_id,null,jsonb_build_object('host',false));
END $$;
REVOKE ALL ON FUNCTION public.vibe_live_tuition_booking(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vibe_live_tuition_booking(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION vibe_live.guard_booking_group_membership(),vibe_live.guard_booking_room(),vibe_live.bind_booking_room(),vibe_live.close_cancelled_booking() FROM PUBLIC,anon,authenticated;
COMMIT;
