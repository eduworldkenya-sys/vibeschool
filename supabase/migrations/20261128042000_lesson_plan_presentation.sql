BEGIN;

-- access: authenticated plan and presentation owners through the RPC below.
CREATE TABLE vibe_live.lesson_plan_presentations (
  lesson_plan_id uuid PRIMARY KEY REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
  presentation_id uuid NOT NULL REFERENCES vibe_live.teacher_materials(id) ON DELETE CASCADE
);

ALTER TABLE vibe_live.lesson_plan_presentations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vibe_live.lesson_plan_presentations FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX ON vibe_live.lesson_plan_presentations(presentation_id);

CREATE FUNCTION public.vibe_live_plan_presentation(
  p_plan_id uuid, p_presentation_id uuid DEFAULT NULL, p_write boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_presentation_id uuid;
BEGIN
  IF v_owner IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.lesson_plans
    WHERE id = p_plan_id AND teacher_id = v_owner
      AND public.teacher_can_access_class(class_id, NULL, false)
  ) THEN
    RAISE EXCEPTION 'Lesson Plan is unavailable' USING ERRCODE = '42501';
  END IF;

  IF p_write THEN
    IF p_presentation_id IS NULL THEN
      DELETE FROM vibe_live.lesson_plan_presentations WHERE lesson_plan_id = p_plan_id;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM vibe_live.teacher_materials WHERE id = p_presentation_id AND owner_id = v_owner
      ) THEN
        RAISE EXCEPTION 'Presentation is unavailable' USING ERRCODE = '42501';
      END IF;
      INSERT INTO vibe_live.lesson_plan_presentations(lesson_plan_id, presentation_id)
      VALUES (p_plan_id, p_presentation_id)
      ON CONFLICT (lesson_plan_id) DO UPDATE SET presentation_id = EXCLUDED.presentation_id;
    END IF;
  END IF;

  SELECT link.presentation_id INTO v_presentation_id
  FROM vibe_live.lesson_plan_presentations link
  JOIN vibe_live.teacher_materials material ON material.id = link.presentation_id
  WHERE link.lesson_plan_id = p_plan_id AND material.owner_id = v_owner;
  RETURN v_presentation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.vibe_live_plan_presentation(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vibe_live_plan_presentation(uuid, uuid, boolean) TO authenticated;

COMMIT;
