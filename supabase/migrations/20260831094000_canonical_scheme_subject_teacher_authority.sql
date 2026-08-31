-- The class teacher and the subject teacher can be different people.
-- Patch the internal canonical engine so subject-specific teacher_classes authority
-- is preserved after the outer authorization wrapper admits the request.
-- The migration fails closed if the expected function source has drifted.

do $$
declare
  v_def text;
  v_old text := E'  v_is_admin := public.is_school_admin(v_class.school_id);\n  v_teacher_id := coalesce(v_class.teacher_id, v_uid);\n  if v_uid <> v_teacher_id and not v_is_admin then\n    return jsonb_build_object(''ok'',false,''reason'',''not_authorized'');\n  end if;';
  v_new text := E'  v_is_admin := public.is_school_admin(v_class.school_id);\n  if v_is_admin then\n    select coalesce((select tc.teacher_id from public.teacher_classes tc where tc.school_id=v_class.school_id and tc.class_id=p_class_id and tc.subject_id=p_subject_id order by tc.created_at asc limit 1), v_class.teacher_id, v_uid) into v_teacher_id;\n  elsif v_class.teacher_id = v_uid or exists (select 1 from public.teacher_classes tc where tc.school_id=v_class.school_id and tc.teacher_id=v_uid and tc.class_id=p_class_id and tc.subject_id=p_subject_id) then\n    v_teacher_id := v_uid;\n  else\n    return jsonb_build_object(''ok'',false,''reason'',''not_authorized'');\n  end if;';
begin
  select pg_get_functiondef('public.generate_scheme_from_curriculum_internal(uuid,uuid,uuid,boolean)'::regprocedure)
    into v_def;
  if position(v_old in v_def)=0 then
    raise exception 'canonical generator authorization contract drift';
  end if;
  execute replace(v_def,v_old,v_new);
end
$$;

do $$
declare
  v_def text;
  v_old text := E'  if v_uid <> coalesce(v_class.teacher_id,v_uid) and not public.is_school_admin(v_class.school_id) then\n    return jsonb_build_object(''ok'',false,''reason'',''not_authorized'');\n  end if;';
  v_new text := E'  if not public.is_school_admin(v_class.school_id)\n     and v_class.teacher_id is distinct from v_uid\n     and not exists (select 1 from public.teacher_classes tc where tc.school_id=v_class.school_id and tc.teacher_id=v_uid and tc.class_id=p_class_id and tc.subject_id=p_subject_id) then\n    return jsonb_build_object(''ok'',false,''reason'',''not_authorized'');\n  end if;';
begin
  select pg_get_functiondef('public.ensure_scheme_from_curriculum_internal(uuid,uuid,uuid)'::regprocedure)
    into v_def;
  if position(v_old in v_def)=0 then
    raise exception 'canonical ensure authorization contract drift';
  end if;
  execute replace(v_def,v_old,v_new);
end
$$;
