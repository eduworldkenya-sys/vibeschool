-- READ-010 step 2: RPCs for scheme_lesson_resource_links
-- Restored from the production Supabase migration ledger version 20260801120505.
-- Authority is derived server-side from scheme_of_work / school membership.

create or replace function public.list_scheme_lesson_resources(p_scheme_lesson_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_uid uuid := auth.uid();
  v_school_id uuid;
  v_teacher_id uuid;
  v_can_read boolean := false;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'auth_required'); end if;

  select school_id, teacher_id into v_school_id, v_teacher_id
  from public.scheme_of_work where id = p_scheme_lesson_id;

  if v_school_id is null then return jsonb_build_object('ok', false, 'reason', 'scheme_lesson_not_found'); end if;

  if v_teacher_id = v_uid
     or public.is_school_admin(v_school_id)
     or exists (select 1 from public.school_members sm where sm.school_id = v_school_id and sm.profile_id = v_uid)
  then v_can_read := true;
  end if;

  if not v_can_read then return jsonb_build_object('ok', false, 'reason', 'not_authorized'); end if;

  return jsonb_build_object(
    'ok', true, 'reason', null,
    'resources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'publication_id', l.publication_id,
        'chapter_id', l.chapter_id,
        'chapter_title', vc.title,
        'publication_title', vp.title,
        'resource_role', l.resource_role,
        'sequence', l.sequence,
        'page_start', l.page_start,
        'page_end', l.page_end,
        'exercise_refs', l.exercise_refs,
        'created_by', l.created_by,
        'created_at', l.created_at,
        'updated_at', l.updated_at
      ) order by l.resource_role, l.sequence)
      from public.scheme_lesson_resource_links l
      join public.vibe_chapters vc on vc.id = l.chapter_id
      join public.vibe_publications vp on vp.id = l.publication_id
      where l.scheme_lesson_id = p_scheme_lesson_id
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.upsert_scheme_lesson_resource(
  p_scheme_lesson_id uuid,
  p_publication_id uuid,
  p_chapter_id uuid,
  p_resource_role text,
  p_sequence integer default 1,
  p_page_start integer default null,
  p_page_end integer default null,
  p_exercise_refs jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_uid uuid := auth.uid();
  v_school_id uuid;
  v_teacher_id uuid;
  v_can_write boolean := false;
  v_row public.scheme_lesson_resource_links;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'auth_required'); end if;

  if p_resource_role not in ('teacher_reference','before_class','in_class','after_class','homework') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_resource_role');
  end if;

  select school_id, teacher_id into v_school_id, v_teacher_id
  from public.scheme_of_work where id = p_scheme_lesson_id;

  if v_school_id is null then return jsonb_build_object('ok', false, 'reason', 'scheme_lesson_not_found'); end if;

  if v_teacher_id = v_uid or public.is_school_admin(v_school_id) then v_can_write := true; end if;
  if not v_can_write then return jsonb_build_object('ok', false, 'reason', 'not_authorized'); end if;

  insert into public.scheme_lesson_resource_links (
    scheme_lesson_id, publication_id, chapter_id, resource_role,
    sequence, page_start, page_end, exercise_refs, created_by
  ) values (
    p_scheme_lesson_id, p_publication_id, p_chapter_id, p_resource_role,
    coalesce(p_sequence, 1), p_page_start, p_page_end, coalesce(p_exercise_refs, '[]'::jsonb), v_uid
  )
  on conflict (scheme_lesson_id, chapter_id, resource_role)
  do update set
    sequence = excluded.sequence,
    page_start = excluded.page_start,
    page_end = excluded.page_end,
    exercise_refs = excluded.exercise_refs
  returning * into v_row;

  return jsonb_build_object('ok', true, 'reason', null, 'resource_link_id', v_row.id, 'resource_role', v_row.resource_role);
exception
  when foreign_key_violation then return jsonb_build_object('ok', false, 'reason', 'invalid_chapter_or_publication');
  when check_violation then return jsonb_build_object('ok', false, 'reason', 'constraint_violation');
end;
$function$;

create or replace function public.remove_scheme_lesson_resource(p_resource_link_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_uid uuid := auth.uid();
  v_scheme_lesson_id uuid;
  v_school_id uuid;
  v_teacher_id uuid;
  v_can_write boolean := false;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'auth_required'); end if;

  select scheme_lesson_id into v_scheme_lesson_id
  from public.scheme_lesson_resource_links where id = p_resource_link_id;

  if v_scheme_lesson_id is null then return jsonb_build_object('ok', false, 'reason', 'resource_link_not_found'); end if;

  select school_id, teacher_id into v_school_id, v_teacher_id
  from public.scheme_of_work where id = v_scheme_lesson_id;

  if v_teacher_id = v_uid or public.is_school_admin(v_school_id) then v_can_write := true; end if;
  if not v_can_write then return jsonb_build_object('ok', false, 'reason', 'not_authorized'); end if;

  delete from public.scheme_lesson_resource_links where id = p_resource_link_id;

  return jsonb_build_object('ok', true, 'reason', null, 'resource_link_id', p_resource_link_id);
end;
$function$;

create or replace function public.recommend_textbook_chapters_for_scheme_lesson(
  p_scheme_lesson_id uuid,
  p_limit integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_uid uuid := auth.uid();
  v_school_id uuid;
  v_teacher_id uuid;
  v_curriculum_id uuid;
  v_sub_strand_id uuid;
  v_grade text;
  v_subject text;
  v_strand text;
  v_topic text;
  v_can_read boolean := false;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'auth_required'); end if;

  select school_id, teacher_id, curriculum_id, sub_strand_id, grade, subject, strand, topic
  into v_school_id, v_teacher_id, v_curriculum_id, v_sub_strand_id, v_grade, v_subject, v_strand, v_topic
  from public.scheme_of_work where id = p_scheme_lesson_id;

  if v_school_id is null then return jsonb_build_object('ok', false, 'reason', 'scheme_lesson_not_found'); end if;

  if v_teacher_id = v_uid or public.is_school_admin(v_school_id) then v_can_read := true; end if;
  if not v_can_read then return jsonb_build_object('ok', false, 'reason', 'not_authorized'); end if;

  return jsonb_build_object(
    'ok', true, 'reason', null,
    'candidates', coalesce((
      select jsonb_agg(cand order by match_tier asc)
      from (
        select
          vc.id as chapter_id,
          vc.title as chapter_title,
          vc.publication_id,
          vp.title as publication_title,
          case
            when v_curriculum_id is not null and vc.curriculum_id = v_curriculum_id then 1
            when v_sub_strand_id is not null and vc.sub_strand_id = v_sub_strand_id then 2
            when v_grade is not null and v_subject is not null
                 and vp.cbc_grade = v_grade and vp.cbc_subject = v_subject then 3
            when (v_strand is not null and vc.cbc_strand ilike '%' || v_strand || '%')
              or (v_topic is not null and vc.title ilike '%' || v_topic || '%') then 4
          end as match_tier,
          case
            when v_curriculum_id is not null and vc.curriculum_id = v_curriculum_id then 'curriculum_match'
            when v_sub_strand_id is not null and vc.sub_strand_id = v_sub_strand_id then 'sub_strand_match'
            when v_grade is not null and v_subject is not null
                 and vp.cbc_grade = v_grade and vp.cbc_subject = v_subject then 'grade_subject_match'
            else 'strand_topic_text_match'
          end as match_reason,
          jsonb_build_object(
            'chapter_id', vc.id,
            'chapter_title', vc.title,
            'publication_id', vc.publication_id,
            'publication_title', vp.title,
            'match_tier', case
              when v_curriculum_id is not null and vc.curriculum_id = v_curriculum_id then 1
              when v_sub_strand_id is not null and vc.sub_strand_id = v_sub_strand_id then 2
              when v_grade is not null and v_subject is not null
                   and vp.cbc_grade = v_grade and vp.cbc_subject = v_subject then 3
              else 4
            end,
            'match_reason', case
              when v_curriculum_id is not null and vc.curriculum_id = v_curriculum_id then 'curriculum_match'
              when v_sub_strand_id is not null and vc.sub_strand_id = v_sub_strand_id then 'sub_strand_match'
              when v_grade is not null and v_subject is not null
                   and vp.cbc_grade = v_grade and vp.cbc_subject = v_subject then 'grade_subject_match'
              else 'strand_topic_text_match'
            end
          ) as cand
        from public.vibe_chapters vc
        join public.vibe_publications vp on vp.id = vc.publication_id
        where vc.status = 'published'
          and vp.status = 'published'
          and vp.cbc_aligned = true
          and (
            (v_curriculum_id is not null and vc.curriculum_id = v_curriculum_id)
            or (v_sub_strand_id is not null and vc.sub_strand_id = v_sub_strand_id)
            or (v_grade is not null and v_subject is not null and vp.cbc_grade = v_grade and vp.cbc_subject = v_subject)
            or (v_strand is not null and vc.cbc_strand ilike '%' || v_strand || '%')
            or (v_topic is not null and vc.title ilike '%' || v_topic || '%')
          )
        order by match_tier asc
        limit greatest(coalesce(p_limit, 5), 1)
      ) ranked
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.assign_scheme_resource_to_class(
  p_resource_link_id uuid,
  p_class_id uuid,
  p_due_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_uid uuid := auth.uid();
  v_scheme_lesson_id uuid;
  v_chapter_id uuid;
  v_teacher_id uuid;
  v_result jsonb;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'auth_required'); end if;

  select scheme_lesson_id, chapter_id into v_scheme_lesson_id, v_chapter_id
  from public.scheme_lesson_resource_links where id = p_resource_link_id;

  if v_scheme_lesson_id is null then return jsonb_build_object('ok', false, 'reason', 'resource_link_not_found'); end if;

  select teacher_id into v_teacher_id from public.scheme_of_work where id = v_scheme_lesson_id;

  if v_teacher_id is null or v_teacher_id <> v_uid then
    return jsonb_build_object('ok', false, 'reason', 'not_authorized');
  end if;

  v_result := public.assign_chapter_to_class(p_class_id, v_chapter_id, p_due_at);

  if (v_result->>'ok')::boolean then
    v_result := v_result || jsonb_build_object('resource_link_id', p_resource_link_id, 'scheme_lesson_id', v_scheme_lesson_id);
  end if;

  return v_result;
end;
$function$;
