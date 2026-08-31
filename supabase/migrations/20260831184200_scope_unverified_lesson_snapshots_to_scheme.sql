begin;

-- The generic reusable-version endpoint is certified-only. Unverified published
-- snapshots are not a global canonical lookup surface.
create or replace function public.cla_list_reusable_lesson_resource_versions(
  p_resource_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception using errcode='42501', message='CLA_AUTH_REQUIRED';
  end if;

  return jsonb_build_object(
    'ok', true,
    'versions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'resource_id', v.resource_id,
          'version', v.version,
          'lifecycle_status', v.lifecycle_status,
          'payload', v.payload,
          'content_sha256', v.content_sha256,
          'certification_policy_version', v.certification_policy_version,
          'certified_at', v.certified_at,
          'verified_at', v.verified_at,
          'provenance', v.provenance
        ) order by v.version desc
      )
      from public.learning_resource_versions v
      join public.learning_resources r on r.id = v.resource_id
      where v.resource_id = any(coalesce(p_resource_ids, '{}'::uuid[]))
        and r.status = 'active'
        and v.lifecycle_status = 'certified'
        and public.fn_learning_resource_visible(v.resource_id)
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.cla_list_reusable_lesson_resource_versions(uuid[])
  from public, anon, service_role;
grant execute on function public.cla_list_reusable_lesson_resource_versions(uuid[])
  to authenticated;

-- Published/unverified snapshots are available only through an exact Scheme
-- resource link after normal Scheme membership/ownership authorization.
create or replace function public.cla_list_scheme_lesson_resource_versions(
  p_scheme_lesson_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_school_id uuid;
  v_teacher_id uuid;
begin
  if v_uid is null then
    raise exception using errcode='42501', message='CLA_AUTH_REQUIRED';
  end if;

  select s.school_id, s.teacher_id
  into v_school_id, v_teacher_id
  from public.scheme_of_work s
  where s.id = p_scheme_lesson_id;

  if v_school_id is null then
    raise exception using errcode='P0002', message='CLA_SCHEME_LESSON_NOT_FOUND';
  end if;

  if v_teacher_id is distinct from v_uid
     and not public.is_school_admin(v_school_id)
     and not exists (
       select 1
       from public.school_members sm
       where sm.school_id = v_school_id
         and sm.profile_id = v_uid
     ) then
    raise exception using errcode='42501', message='CLA_SCHEME_LESSON_NOT_AUTHORIZED';
  end if;

  return jsonb_build_object(
    'ok', true,
    'versions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'resource_id', v.resource_id,
          'version', v.version,
          'lifecycle_status', v.lifecycle_status,
          'payload', v.payload,
          'content_sha256', v.content_sha256,
          'certification_policy_version', v.certification_policy_version,
          'certified_at', v.certified_at,
          'verified_at', v.verified_at,
          'provenance', v.provenance
        ) order by
          case v.lifecycle_status
            when 'certified' then 0
            when 'verified' then 1
            else 2
          end,
          v.version desc
      )
      from public.scheme_lesson_resource_links l
      join public.learning_resources r
        on r.id = l.resource_id
       and r.status = 'active'
      join public.learning_resource_versions v
        on v.resource_id = r.id
      left join public.vibe_chapters c
        on c.id = r.chapter_id
       and c.publication_id = r.publication_id
       and r.source_type = 'chapter'
      where l.scheme_lesson_id = p_scheme_lesson_id
        and (
          (
            v.lifecycle_status = 'certified'
            and public.fn_learning_resource_visible(v.resource_id)
          )
          or
          (
            v.lifecycle_status = any(array['candidate','verified']::text[])
            and v.provenance ->> 'source_kind' = 'published_chapter'
            and c.status = 'published'
            and (v.provenance ->> 'chapter_id')::uuid = c.id
            and (v.provenance ->> 'publication_id')::uuid = c.publication_id
            and v.content_sha256 = encode(
              extensions.digest(convert_to(c.blocks::text, 'UTF8'), 'sha256'),
              'hex'
            )
            and v.content_sha256 = encode(
              extensions.digest(convert_to(v.payload::text, 'UTF8'), 'sha256'),
              'hex'
            )
          )
        )
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.cla_list_scheme_lesson_resource_versions(uuid)
  from public, anon, service_role;
grant execute on function public.cla_list_scheme_lesson_resource_versions(uuid)
  to authenticated;

-- A non-certified snapshot may be pinned only when the contextual lesson plan's
-- persisted Scheme item explicitly links the same published resource.
create or replace function public.cla_pin_lesson_plan_resource_version(
  p_lesson_plan_id uuid,
  p_resource_id uuid,
  p_resource_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_plan_teacher uuid;
  v_plan_scheme_id uuid;
  v_version public.learning_resource_versions%rowtype;
  v_link public.teaching_resource_links%rowtype;
  v_scheme_scoped_published boolean := false;
begin
  if v_uid is null then
    raise exception using errcode='42501', message='CLA_AUTH_REQUIRED';
  end if;

  select lp.teacher_id, lp.scheme_id
  into v_plan_teacher, v_plan_scheme_id
  from public.lesson_plans lp
  where lp.id = p_lesson_plan_id;

  if v_plan_teacher is null then
    raise exception using errcode='P0002', message='CLA_LESSON_PLAN_NOT_FOUND';
  end if;

  if v_plan_teacher <> v_uid then
    raise exception using errcode='42501', message='CLA_LESSON_PLAN_NOT_OWNED';
  end if;

  select * into v_version
  from public.learning_resource_versions v
  where v.id = p_resource_version_id;

  if v_version.id is null then
    raise exception using errcode='P0002', message='CLA_RESOURCE_VERSION_NOT_FOUND';
  end if;

  if v_version.resource_id <> p_resource_id then
    raise exception using errcode='23514', message='CLA_RESOURCE_VERSION_PIN_MISMATCH';
  end if;

  if v_plan_scheme_id is not null
     and v_version.lifecycle_status = any(array['candidate','verified']::text[])
     and v_version.provenance ->> 'source_kind' = 'published_chapter' then
    select exists(
      select 1
      from public.scheme_lesson_resource_links sl
      join public.learning_resources r
        on r.id = sl.resource_id
      join public.vibe_chapters c
        on c.id = r.chapter_id
       and c.publication_id = r.publication_id
      where sl.scheme_lesson_id = v_plan_scheme_id
        and sl.resource_id = p_resource_id
        and r.status = 'active'
        and r.source_type = 'chapter'
        and c.status = 'published'
        and (v_version.provenance ->> 'chapter_id')::uuid = c.id
        and (v_version.provenance ->> 'publication_id')::uuid = c.publication_id
        and v_version.content_sha256 = encode(
          extensions.digest(convert_to(c.blocks::text, 'UTF8'), 'sha256'),
          'hex'
        )
        and v_version.content_sha256 = encode(
          extensions.digest(convert_to(v_version.payload::text, 'UTF8'), 'sha256'),
          'hex'
        )
    ) into v_scheme_scoped_published;
  end if;

  if v_version.lifecycle_status = 'certified' then
    null;
  elsif v_version.lifecycle_status = any(array['candidate','verified']::text[])
        and v_version.created_by = v_uid then
    null;
  elsif v_scheme_scoped_published then
    null;
  else
    raise exception using errcode='42501', message='CLA_RESOURCE_VERSION_NOT_PINNABLE';
  end if;

  select * into v_link
  from public.teaching_resource_links t
  where t.resource_id = p_resource_id
    and t.lesson_plan_id = p_lesson_plan_id
    and t.usage_role = 'source'
  limit 1
  for update;

  if v_link.id is null then
    insert into public.teaching_resource_links(
      resource_id,
      resource_version_id,
      target_type,
      lesson_plan_id,
      usage_role,
      sequence,
      section_refs,
      exercise_refs,
      created_by
    ) values (
      p_resource_id,
      p_resource_version_id,
      'lesson_plan',
      p_lesson_plan_id,
      'source',
      1,
      '[]'::jsonb,
      '[]'::jsonb,
      v_uid
    )
    returning * into v_link;
  else
    update public.teaching_resource_links
    set resource_version_id = p_resource_version_id,
        updated_at = now()
    where id = v_link.id
    returning * into v_link;
  end if;

  return jsonb_build_object(
    'ok', true,
    'link_id', v_link.id,
    'lesson_plan_id', p_lesson_plan_id,
    'resource_id', p_resource_id,
    'resource_version_id', p_resource_version_id,
    'lifecycle_status', v_version.lifecycle_status,
    'scheme_scoped_published_snapshot', v_scheme_scoped_published
  );
end;
$$;

revoke all on function public.cla_pin_lesson_plan_resource_version(uuid,uuid,uuid)
  from public, anon, service_role;
grant execute on function public.cla_pin_lesson_plan_resource_version(uuid,uuid,uuid)
  to authenticated;

commit;
