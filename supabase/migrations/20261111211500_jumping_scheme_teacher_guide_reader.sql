-- Preserve the authoritative Grade 1 Jumping Scheme reader and extend its
-- no-lesson-number response with the existing linked Teacher Guide manuscript.
-- Teacher-only candidate preview; no publication or certification changes.
begin;

create or replace function public.vs_read_linked_jumping_scheme_content(
  p_scheme_id uuid, p_lesson_number integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_scheme public.scheme_of_work%rowtype;
  v_units jsonb := '[]'::jsonb;
  v_content jsonb := '{}'::jsonb;
  v_guide_payload jsonb := '{}'::jsonb;
begin
  if (select auth.uid()) is null then
    return jsonb_build_object('ok',false,'reason','auth_required');
  end if;
  if p_lesson_number is not null and (p_lesson_number < 1 or p_lesson_number > 14) then
    return jsonb_build_object('ok',false,'reason','invalid_lesson_number');
  end if;

  select s.* into v_scheme from public.scheme_of_work s
  join public.cbc_strands unit on unit.id=s.sub_strand_id
  where s.id=p_scheme_id and s.teacher_id=(select auth.uid())
    and s.grade='Grade 1'
    and unit.grade='Grade 1'
    and unit.source_ref='VS-CUR-G01-CA-2026#1.1'
    and unit.sub_strand='Jumping'
    and exists (
      select 1 from public.teacher_classes tc
      where tc.teacher_id=(select auth.uid()) and tc.school_id=s.school_id
        and tc.class_id=s.class_id and tc.subject_id=s.subject_id
    );
  if not found then
    return jsonb_build_object('ok',false,'reason','scheme_not_authorized');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'lessonNumber',substring(r.canonical_key from ':lesson:([0-9]{2})$')::integer,
    'title',regexp_replace(r.title,' — Teacher Notes$','')
  ) order by r.canonical_key),'[]'::jsonb)
  into v_units
  from public.teaching_resource_links link
  join public.learning_resources r on r.id=link.resource_id
  join public.learning_resource_versions version on version.id=link.resource_version_id and version.resource_id=r.id
  where link.target_type='scheme_lesson' and link.scheme_lesson_id=v_scheme.id
    and r.canonical_key ~ '^vs:g1:jumping:teacher:lesson:[0-9]{2}$'
    and r.status='inactive' and r.visibility='private'
    and r.owner_type='platform' and r.source_type='platform_authored'
    and version.lifecycle_status='candidate'
    and r.sub_strand_id=v_scheme.sub_strand_id;

  -- The common Scheme-level Teacher Guide exists independently of any
  -- numbered lesson or timetable assignment. Expose only the authorized
  -- teacher's linked editorial candidate; never classify it as certified.
  if p_lesson_number is null then
    select coalesce((
      select version.payload
      from public.teaching_resource_links link
      join public.learning_resources r on r.id=link.resource_id
      join public.learning_resource_versions version
        on version.id=link.resource_version_id and version.resource_id=r.id
      where link.target_type='scheme_lesson'
        and link.scheme_lesson_id=v_scheme.id
        and r.canonical_key='vs:g1:jumping:teacher:guide'
        and r.status='inactive' and r.visibility='private'
        and r.owner_type='platform' and r.source_type='platform_authored'
        and r.sub_strand_id=v_scheme.sub_strand_id
        and version.lifecycle_status='candidate'
        and version.payload->>'schema'='vibeschool.originals.lesson-content.v1'
      limit 1
    ),'{}'::jsonb) into v_guide_payload;
    if v_guide_payload ? 'body' then
      v_content := jsonb_build_object('guide',v_guide_payload);
    end if;
  end if;

  if p_lesson_number is not null then
    select coalesce(jsonb_object_agg(
      case
        when r.canonical_key='vs:g1:jumping:teacher:lesson:'||lpad(p_lesson_number::text,2,'0') then 'teacher'
        when r.canonical_key='vs:g1:jumping:learner:lesson:'||lpad(p_lesson_number::text,2,'0') then 'learner'
        when r.canonical_key='vs:g1:jumping:teacher:guide' then 'guide'
        when r.canonical_key='vs:g1:jumping:teacher:assessment' then 'assessment'
        when r.canonical_key='vs:g1:jumping:teacher:observation' then 'observation'
        when r.canonical_key='vs:g1:jumping:teacher:song' then 'song'
        else 'introduction'
      end, version.payload
    ),'{}'::jsonb)
    into v_content
    from public.teaching_resource_links link
    join public.learning_resources r on r.id=link.resource_id
    join public.learning_resource_versions version on version.id=link.resource_version_id and version.resource_id=r.id
    where link.target_type='scheme_lesson' and link.scheme_lesson_id=v_scheme.id
      and r.canonical_key in (
        'vs:g1:jumping:teacher:lesson:'||lpad(p_lesson_number::text,2,'0'),
        'vs:g1:jumping:learner:lesson:'||lpad(p_lesson_number::text,2,'0'),
        'vs:g1:jumping:teacher:guide',
        'vs:g1:jumping:teacher:assessment',
        'vs:g1:jumping:teacher:observation',
        'vs:g1:jumping:teacher:song',
        'vs:g1:jumping:learner:intro'
      )
      and r.status='inactive' and r.visibility='private'
      and r.owner_type='platform' and r.source_type='platform_authored'
      and version.lifecycle_status='candidate'
      and r.sub_strand_id=v_scheme.sub_strand_id
      and version.payload->>'schema'='vibeschool.originals.lesson-content.v1';

    if not (v_content ? 'teacher' and v_content ? 'learner') then
      return jsonb_build_object('ok',false,'reason','lesson_content_incomplete','units',v_units);
    end if;
  end if;

  return jsonb_build_object(
    'ok',true,'schemeId',v_scheme.id,'status','editorial_draft',
    'units',v_units,'selectedLessonNumber',p_lesson_number,
    'content',v_content
  );
end;
$$;

revoke all on function public.vs_read_linked_jumping_scheme_content(uuid,integer)
  from public,anon,authenticated;
grant execute on function public.vs_read_linked_jumping_scheme_content(uuid,integer)
  to authenticated;


commit;
