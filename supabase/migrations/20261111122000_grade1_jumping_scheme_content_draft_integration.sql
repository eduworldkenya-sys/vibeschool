-- Grade 1 Jumping: read and use original content as a teacher draft, without
-- promoting candidate versions to certified/published assets.
-- Reuses the existing resource/version/link authorities. No new content root.

begin;

create or replace function public.vs_read_linked_jumping_scheme_content(
  p_scheme_id uuid, p_lesson_number integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_scheme public.scheme_of_work%rowtype;
  v_units jsonb := '[]'::jsonb;
  v_content jsonb := '{}'::jsonb;
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

-- Preserve the actual manuscript version used in the teacher's *draft* plan.
-- Never attach the other 13 units as if they were taught on this occurrence.
create or replace function public.vs_pin_jumping_draft_to_plan(
  p_lesson_plan_id uuid,p_scheme_id uuid,p_lesson_number integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.lesson_plans%rowtype;
  v_scheme public.scheme_of_work%rowtype;
  v_pinned integer;
begin
  if (select auth.uid()) is null then
    return jsonb_build_object('ok',false,'reason','auth_required');
  end if;
  if p_lesson_number is null or p_lesson_number not between 1 and 14 then
    return jsonb_build_object('ok',false,'reason','invalid_lesson_number');
  end if;
  select * into v_plan from public.lesson_plans where id=p_lesson_plan_id for update;
  select * into v_scheme from public.scheme_of_work where id=p_scheme_id;
  if v_plan.id is null or v_scheme.id is null or
     v_plan.teacher_id is distinct from (select auth.uid()) or
     v_plan.scheme_id is distinct from v_scheme.id or
     v_plan.teacher_id is distinct from v_scheme.teacher_id or
     v_plan.school_id is distinct from v_scheme.school_id or
     v_plan.class_id is distinct from v_scheme.class_id or
     v_plan.subject_id is distinct from v_scheme.subject_id or
     v_plan.strand_id is distinct from v_scheme.sub_strand_id or
     v_plan.status is distinct from 'draft' or
     v_plan.published_at is not null or v_plan.parent_shared_at is not null or
     not exists(select 1 from public.teacher_classes tc
       where tc.teacher_id=v_plan.teacher_id and tc.school_id=v_plan.school_id
         and tc.class_id=v_plan.class_id and tc.subject_id=v_plan.subject_id) or
     not exists(select 1 from public.cbc_strands u
       where u.id=v_scheme.sub_strand_id and u.source_ref='VS-CUR-G01-CA-2026#1.1') then
    return jsonb_build_object('ok',false,'reason','draft_plan_not_authorized');
  end if;

  -- Require the exact two lesson manuscripts; the common teacher guide and
  -- assessment tools are independent topic-level sources, not lesson number.
  if (select count(*) from public.teaching_resource_links t
       join public.learning_resources r on r.id=t.resource_id
       join public.learning_resource_versions rv on rv.id=t.resource_version_id and rv.resource_id=r.id
       where t.scheme_lesson_id=v_scheme.id and t.target_type='scheme_lesson'
         and rv.lifecycle_status='candidate' and r.status='inactive'
         and r.visibility='private'
         and r.canonical_key in (
           'vs:g1:jumping:teacher:lesson:'||lpad(p_lesson_number::text,2,'0'),
           'vs:g1:jumping:learner:lesson:'||lpad(p_lesson_number::text,2,'0')
         )) <> 2 then
    return jsonb_build_object('ok',false,'reason','lesson_content_incomplete');
  end if;

  with selected as (
    select t.resource_id,t.resource_version_id,t.usage_role,t.section_refs
    from public.teaching_resource_links t
    join public.learning_resources r on r.id=t.resource_id
    join public.learning_resource_versions rv on rv.id=t.resource_version_id and rv.resource_id=r.id
    where t.scheme_lesson_id=v_scheme.id and t.target_type='scheme_lesson'
      and r.status='inactive' and r.visibility='private'
      and r.owner_type='platform' and r.source_type='platform_authored'
      and r.sub_strand_id=v_scheme.sub_strand_id
      and rv.lifecycle_status='candidate'
      and r.canonical_key in (
         'vs:g1:jumping:teacher:lesson:'||lpad(p_lesson_number::text,2,'0'),
         'vs:g1:jumping:learner:lesson:'||lpad(p_lesson_number::text,2,'0'),
         'vs:g1:jumping:teacher:guide',
         'vs:g1:jumping:teacher:assessment',
         'vs:g1:jumping:teacher:observation',
         'vs:g1:jumping:teacher:song'
      )
  ), written as (
    insert into public.teaching_resource_links(
      resource_id,resource_version_id,target_type,lesson_plan_id,usage_role,
      sequence,section_refs,exercise_refs,created_by
    )
    select s.resource_id,s.resource_version_id,'lesson_plan',v_plan.id,s.usage_role,
      row_number() over(order by s.section_refs::text,s.usage_role,s.resource_id)::integer,
      s.section_refs,'[]'::jsonb,v_plan.teacher_id
    from selected s
    on conflict (resource_id,lesson_plan_id,usage_role)
      where lesson_plan_id is not null
    do update set resource_version_id=excluded.resource_version_id,
      section_refs=excluded.section_refs,updated_at=now()
    returning 1
  )
  select count(*)::integer into v_pinned from written;
  return jsonb_build_object('ok',true,'pinnedCount',v_pinned,
    'status','editorial_draft','lessonNumber',p_lesson_number);
end;
$$;

revoke all on function public.vs_pin_jumping_draft_to_plan(uuid,uuid,integer)
 from public,anon,authenticated;
grant execute on function public.vs_pin_jumping_draft_to_plan(uuid,uuid,integer)
 to authenticated;

-- A candidate may be worked on in a teacher's draft, but it must never be
-- published/shared to families before certification. A failed update aborts
-- the same transaction that inserted any student/parent notifications.
create or replace function public.vs_guard_jumping_candidate_delivery()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (
      new.status in ('published','shared_to_parents')
      or new.published_at is not null
      or new.parent_shared_at is not null
    ) and exists(
      select 1 from public.teaching_resource_links l
      join public.learning_resource_versions v on v.id=l.resource_version_id
      join public.learning_resources r on r.id=l.resource_id
      where l.lesson_plan_id=new.id
        and r.canonical_key like 'vs:g1:jumping:%'
        and v.lifecycle_status<>'certified'
    ) then
    raise exception using errcode='23514',
      message='JUMPING_DRAFT_SOURCE_CANNOT_BE_DELIVERED';
  end if;
  return new;
end;
$$;
revoke all on function public.vs_guard_jumping_candidate_delivery()
 from public,anon,authenticated;

drop trigger if exists vs_guard_jumping_candidate_delivery on public.lesson_plans;
create trigger vs_guard_jumping_candidate_delivery
before update of status,published_at,parent_shared_at on public.lesson_plans
for each row execute function public.vs_guard_jumping_candidate_delivery();

commit;
