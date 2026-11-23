-- Public Live discovery: any eligible authenticated school-level learner may
-- request a place in a published tutor's Open class. Teacher admission is
-- still mandatory; this does not grant access to school, tuition or homeschool.
-- This function is the single canonical entitlement used by Live RPC, private
-- realtime subscriptions, media authorization, roster and resources.
BEGIN;
CREATE OR REPLACE FUNCTION vibe_live.can_join(
 p_student uuid,p_host uuid,p_mode text,p_class uuid,p_school uuid,p_group uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT vibe_live.eligible_student(p_student)
    AND vibe_live.host_allowed(p_host,p_mode,p_class,p_school,p_group)
    AND (
      (p_mode='school' AND EXISTS(
        SELECT 1 FROM public.student_classes sc
        WHERE sc.student_id=p_student AND sc.class_id=p_class
          AND sc.school_id=p_school AND sc.is_current
      ))
      OR (p_mode='tuition' AND EXISTS(
        SELECT 1 FROM public.vibetutor_student_invitations i
        WHERE i.student_id=p_student AND i.tutor_id=p_host
          AND i.status='accepted' AND (
            p_group IS NULL OR EXISTS(
              SELECT 1 FROM public.vibetutor_private_group_members gm
              WHERE gm.group_id=p_group AND gm.invitation_id=i.id
            )
          )
      ))
      OR (p_mode='homeschool' AND EXISTS(
        SELECT 1 FROM public.parent_student_links l
        WHERE l.parent_id=p_host AND l.student_id=p_student
      ))
      -- Public is discovery eligibility only, not an admission grant.
      -- vibe_live.command('join') separately requires an admitted
      -- waiting_requests row; no lesson content is returned before joining.
      OR (p_mode='open' AND p_group IS NULL)
    );
$$;
REVOKE ALL ON FUNCTION vibe_live.can_join(uuid,uuid,text,uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;

-- Enrich the already-scoped learner discovery projection. Exposes only the
-- published tutor display name (no contact, identity ID or hidden roster).
DO $migration$
DECLARE
 src text:=pg_get_functiondef('vibe_live.command(text,uuid,uuid,integer,jsonb)'::regprocedure);
 old text:=$anchor
 replacement text:=$anchor
   SELECT t.display_name FROM public.vibetutor_tutors t
   WHERE t.profile_id=x.teacher_id AND t.status='published'
 ),'canJoin'$anchor$;
BEGIN
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN
   RAISE EXCEPTION 'Unexpected Live discovery projection: reconcile before applying';
 END IF;
 EXECUTE replace(src,old,replacement);
END $migration$;
COMMIT;
mode',x.mode,'canJoin'$anchor$;
 replacement text:=$anchormode',x.mode,'teacherName',(
   SELECT t.display_name FROM public.vibetutor_tutors t
   WHERE t.profile_id=x.teacher_id AND t.status='published'
 ),'canJoin'$anchor$;
BEGIN
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN
   RAISE EXCEPTION 'Unexpected Live discovery projection: reconcile before applying';
 END IF;
 EXECUTE replace(src,old,replacement);
END $migration$;
COMMIT;
mode',x.mode,'teacherName',(
   SELECT t.display_name FROM public.vibetutor_tutors t
   WHERE t.profile_id=x.teacher_id AND t.status='published'
 ),'canJoin'$anchor$;
BEGIN
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN
   RAISE EXCEPTION 'Unexpected Live discovery projection: reconcile before applying';
 END IF;
 EXECUTE replace(src,old,replacement);
END $migration$;
COMMIT;
mode',x.mode,'canJoin'$anchor$;
 replacement text:=$anchormode',x.mode,'teacherName',(
   SELECT t.display_name FROM public.vibetutor_tutors t
   WHERE t.profile_id=x.teacher_id AND t.status='published'
 ),'canJoin'$anchor$;
BEGIN
 IF (length(src)-length(replace(src,old,'')))/length(old)<>1 THEN
   RAISE EXCEPTION 'Unexpected Live discovery projection: reconcile before applying';
 END IF;
 EXECUTE replace(src,old,replacement);
END $migration$;
COMMIT;
