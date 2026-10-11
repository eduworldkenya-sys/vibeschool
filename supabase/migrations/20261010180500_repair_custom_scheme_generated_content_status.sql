begin;

-- Pilot P0: content_status is a GENERATED ALWAYS column. The live custom
-- Scheme writer still supplied a literal value, so every valid custom lesson
-- failed before it could reach lesson planning. Preserve the canonical
-- authorization/resource contract and let PostgreSQL derive content_status.
create or replace function public.commit_custom_scheme_item(
  p_class_id uuid,
  p_subject_id uuid,
  p_academic_term_id uuid,
  p_week integer,
  p_topic text,
  p_strand text default null,
  p_resource_id uuid default null,
  p_resource_role text default null
)
returns public.scheme_of_work
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_class public.classes%rowtype;
  v_subject public.subjects%rowtype;
  v_term public.academic_terms%rowtype;
  v_next_sequence integer;
  v_inserted public.scheme_of_work%rowtype;
  v_resource public.learning_resources%rowtype;
  v_role text;
begin
  if v_uid is null then raise exception 'SCHEME_AUTH_REQUIRED'; end if;
  if nullif(btrim(p_topic),'') is null then raise exception 'SCHEME_TOPIC_REQUIRED'; end if;
  if p_week is null or p_week < 1 then raise exception 'SCHEME_WEEK_REQUIRED'; end if;

  select * into v_class from public.classes c where c.id = p_class_id;
  if v_class.id is null then raise exception 'SCHEME_CLASS_NOT_FOUND'; end if;
  select * into v_subject from public.subjects s where s.id = p_subject_id;
  if v_subject.id is null then raise exception 'SCHEME_SUBJECT_NOT_FOUND'; end if;
  select * into v_term
  from public.academic_terms at
  where at.id = p_academic_term_id and at.school_id = v_class.school_id;
  if v_term.id is null then raise exception 'SCHEME_TERM_NOT_IN_SCHOOL'; end if;

  if not exists (
    select 1
    from public.teacher_classes tc
    where tc.teacher_id = v_uid
      and tc.school_id = v_class.school_id
      and tc.class_id = p_class_id
      and tc.subject_id = p_subject_id
  ) and not public.is_school_admin(v_class.school_id) then
    raise exception 'SCHEME_ASSIGNMENT_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.term_weeks tw
    where tw.term_id = p_academic_term_id
      and (tw.school_id = v_class.school_id or tw.school_id is null)
      and tw.week_number = p_week
  ) then
    raise exception 'SCHEME_WEEK_NOT_IN_INSTRUCTIONAL_CALENDAR';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_class_id::text || ':' || p_subject_id::text || ':' || p_academic_term_id::text,
    0
  ));
  select coalesce(max(s.sequence_number), 0) + 1 into v_next_sequence
  from public.scheme_of_work s
  where s.class_id = p_class_id
    and s.subject_id = p_subject_id
    and s.academic_term_id = p_academic_term_id;

  insert into public.scheme_of_work(
    school_id, teacher_id, class_id, subject_id, curriculum_id, curriculum_content_id,
    academic_term_id, curriculum_type, grade, subject, term, week, strand, sub_strand,
    topic, status, source, sequence_number
  ) values (
    v_class.school_id, v_uid, p_class_id, p_subject_id, null, null, p_academic_term_id,
    'custom', v_class.name, v_subject.name, v_term.term, p_week,
    nullif(btrim(p_strand), ''), null, btrim(p_topic), 'planned', 'custom', v_next_sequence
  ) returning * into v_inserted;

  if p_resource_id is not null then
    if not exists (
      select 1
      from public.class_resource_library crl
      where crl.teacher_id = v_uid
        and crl.school_id = v_class.school_id
        and crl.class_id = p_class_id
        and (crl.subject_id = p_subject_id or crl.subject_id is null)
        and crl.resource_id = p_resource_id
        and crl.status = 'active'
    ) then
      raise exception 'SCHEME_RESOURCE_NOT_IN_CLASS_LIBRARY';
    end if;

    select * into v_resource
    from public.learning_resources lr
    where lr.id = p_resource_id and lr.status = 'active';
    if v_resource.id is null
      or v_resource.publication_id is null
      or v_resource.chapter_id is null then
      raise exception 'SCHEME_CHAPTER_RESOURCE_REQUIRED';
    end if;

    v_role := coalesce(nullif(btrim(p_resource_role), ''), 'supplementary');
    if v_role not in (
      'primary', 'supplementary', 'teacher_reference', 'learner_reading', 'exercise',
      'remedial', 'enrichment', 'project', 'assessment_source', 'before_class',
      'in_class', 'after_class', 'homework'
    ) then
      raise exception 'SCHEME_RESOURCE_ROLE_INVALID';
    end if;

    insert into public.scheme_lesson_resource_links(
      scheme_lesson_id, publication_id, chapter_id, resource_id, resource_role,
      sequence, exercise_refs, created_by
    ) values (
      v_inserted.id, v_resource.publication_id, v_resource.chapter_id, v_resource.id,
      v_role, 1, '[]'::jsonb, v_uid
    );
  end if;

  return v_inserted;
end;
$function$;

revoke all on function public.commit_custom_scheme_item(
  uuid, uuid, uuid, integer, text, text, uuid, text
) from public, anon;
grant execute on function public.commit_custom_scheme_item(
  uuid, uuid, uuid, integer, text, text, uuid, text
) to authenticated;

do $assert$
declare
  v_definition text;
begin
  select lower(pg_get_functiondef(
    'public.commit_custom_scheme_item(uuid,uuid,uuid,integer,text,text,uuid,text)'::regprocedure
  )) into v_definition;

  if v_definition ~ 'insert[[:space:]]+into[[:space:]]+public[.]scheme_of_work[[:space:]]*[(][^)]*content_status' then
    raise exception 'custom_scheme_writer_still_writes_generated_content_status';
  end if;
  if has_function_privilege('anon', 'public.commit_custom_scheme_item(uuid,uuid,uuid,integer,text,text,uuid,text)', 'EXECUTE') then
    raise exception 'custom_scheme_writer_exposed_to_anon';
  end if;
end;
$assert$;

commit;
