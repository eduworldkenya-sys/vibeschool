-- Public Live: eligible signed-in school learners may request admission to
-- published teachers' Public sessions, without a pre-existing tuition link.
-- All content/voice access still requires teacher approval and a joined room.
BEGIN;
CREATE OR REPLACE FUNCTION vibe_live.can_join(
 p_student uuid,p_host uuid,p_mode text,p_class uuid,p_school uuid,p_group uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $body$
 SELECT vibe_live.eligible_student(p_student)
  AND vibe_live.host_allowed(p_host,p_mode,p_class,p_school,p_group)
  AND (
   (p_mode='school' AND EXISTS(
    SELECT 1 FROM public.student_classes sc
    WHERE sc.student_id=p_student AND sc.class_id=p_class
     AND sc.school_id=p_school AND sc.is_current))
   OR (p_mode='tuition' AND EXISTS(
    SELECT 1 FROM public.vibetutor_student_invitations i
    WHERE i.student_id=p_student AND i.tutor_id=p_host AND i.status='accepted'
     AND (p_group IS NULL OR EXISTS(
      SELECT 1 FROM public.vibetutor_private_group_members gm
      WHERE gm.group_id=p_group AND gm.invitation_id=i.id))))
   OR (p_mode='homeschool' AND EXISTS(
    SELECT 1 FROM public.parent_student_links l
    WHERE l.parent_id=p_host AND l.student_id=p_student))
   OR (p_mode='open' AND p_group IS NULL)
  );
$body$;
REVOKE ALL ON FUNCTION vibe_live.can_join(uuid,uuid,text,uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
-- Extend canonical list projection, not unrestricted table access.
DO $fix$
DECLARE
 src text := pg_get_functiondef('vibe_live.command(text,uuid,uuid,integer,jsonb)'::regprocedure);
 old_fragment text := quote_literal('mode')||',x.mode,'||quote_literal('canJoin');
 new_fragment text := quote_literal('mode')||',x.mode,'||quote_literal('teacherName')||
  ',(SELECT t.display_name FROM public.vibetutor_tutors t WHERE t.profile_id=x.teacher_id AND t.status='||
  quote_literal('published')||'),'||quote_literal('canJoin');
BEGIN
 IF (length(src)-length(replace(src,old_fragment,'')))/length(old_fragment)<>1 THEN
  RAISE EXCEPTION 'Unexpected Live discovery projection: reconcile before applying';
 END IF;
 EXECUTE replace(src,old_fragment,new_fragment);
END $fix$;
COMMIT;
