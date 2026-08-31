begin;

-- Materialize one immutable candidate snapshot for each currently published
-- chapter resource. Candidate is intentionally not certification: QA status
-- remains separate and can later promote the same immutable version.
create or replace function public.cla_materialize_published_chapter_version(
  p_chapter_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chapter public.vibe_chapters%rowtype;
  v_resource public.learning_resources%rowtype;
  v_hash text;
  v_existing uuid;
  v_next_version integer;
  v_version_id uuid;
begin
  select *
  into v_chapter
  from public.vibe_chapters c
  where c.id = p_chapter_id
    and c.status = 'published';

  if v_chapter.id is null then
    return null;
  end if;

  select *
  into v_resource
  from public.learning_resources r
  where r.source_type = 'chapter'
    and r.chapter_id = v_chapter.id
    and r.publication_id = v_chapter.publication_id
    and r.status = 'active'
  order by r.created_at asc
  limit 1
  for update;

  if v_resource.id is null then
    return null;
  end if;

  v_hash := encode(
    extensions.digest(convert_to(v_chapter.blocks::text, 'UTF8'), 'sha256'),
    'hex'
  );

  select v.id
  into v_existing
  from public.learning_resource_versions v
  where v.resource_id = v_resource.id
    and v.content_sha256 = v_hash
    and v.provenance ->> 'source_kind' = 'published_chapter'
    and v.lifecycle_status = any(array['candidate','verified','certified']::text[])
  order by v.version desc
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  select coalesce(max(v.version), 0) + 1
  into v_next_version
  from public.learning_resource_versions v
  where v.resource_id = v_resource.id;

  insert into public.learning_resource_versions(
    resource_id,
    version,
    lifecycle_status,
    payload_format,
    payload,
    content_sha256,
    provenance,
    rights_status,
    created_by
  ) values (
    v_resource.id,
    v_next_version,
    'candidate',
    'vibe_chapter_blocks_v1',
    v_chapter.blocks,
    v_hash,
    jsonb_build_object(
      'source_kind', 'published_chapter',
      'publication_id', v_chapter.publication_id,
      'chapter_id', v_chapter.id,
      'chapter_status', v_chapter.status,
      'alignment_status', v_chapter.alignment_status,
      'published_at', v_chapter.published_at,
      'content_pack_version', v_chapter.content_pack_version
    ),
    'pending',
    v_resource.created_by
  )
  returning id into v_version_id;

  return v_version_id;
end;
$$;

revoke all on function public.cla_materialize_published_chapter_version(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.cla_sync_published_chapter_version_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' then
    perform public.cla_materialize_published_chapter_version(new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.cla_sync_published_chapter_version_trigger()
  from public, anon, authenticated, service_role;

drop trigger if exists cla_sync_published_chapter_version on public.vibe_chapters;
create trigger cla_sync_published_chapter_version
after insert or update of blocks, status, published_at, alignment_status, verified_at
on public.vibe_chapters
for each row
execute function public.cla_sync_published_chapter_version_trigger();

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
        ) order by
          case v.lifecycle_status
            when 'certified' then 0
            when 'verified' then 1
            else 2
          end,
          v.version desc
      )
      from public.learning_resource_versions v
      join public.learning_resources r on r.id = v.resource_id
      left join public.vibe_chapters c
        on c.id = r.chapter_id
       and r.source_type = 'chapter'
      where v.resource_id = any(coalesce(p_resource_ids, '{}'::uuid[]))
        and r.status = 'active'
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
            and r.publication_id = c.publication_id
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

revoke all on function public.cla_list_reusable_lesson_resource_versions(uuid[])
  from public, anon, service_role;
grant execute on function public.cla_list_reusable_lesson_resource_versions(uuid[])
  to authenticated;

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
  v_version public.learning_resource_versions%rowtype;
  v_link public.teaching_resource_links%rowtype;
  v_shared_published boolean := false;
begin
  if v_uid is null then
    raise exception using errcode='42501', message='CLA_AUTH_REQUIRED';
  end if;

  select lp.teacher_id
  into v_plan_teacher
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

  if v_version.lifecycle_status = any(array['candidate','verified']::text[])
     and v_version.provenance ->> 'source_kind' = 'published_chapter' then
    select exists(
      select 1
      from public.learning_resources r
      join public.vibe_chapters c
        on c.id = r.chapter_id
       and c.publication_id = r.publication_id
      where r.id = p_resource_id
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
    ) into v_shared_published;
  end if;

  if v_version.lifecycle_status = 'certified' then
    null;
  elsif v_version.lifecycle_status = any(array['candidate','verified']::text[])
        and v_version.created_by = v_uid then
    null;
  elsif v_shared_published then
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
    'shared_published_snapshot', v_shared_published
  );
end;
$$;

revoke all on function public.cla_pin_lesson_plan_resource_version(uuid,uuid,uuid)
  from public, anon, service_role;
grant execute on function public.cla_pin_lesson_plan_resource_version(uuid,uuid,uuid)
  to authenticated;

do $$
declare
  v_chapter_id uuid;
begin
  for v_chapter_id in
    select distinct c.id
    from public.vibe_chapters c
    join public.learning_resources r
      on r.source_type = 'chapter'
     and r.chapter_id = c.id
     and r.publication_id = c.publication_id
     and r.status = 'active'
    where c.status = 'published'
  loop
    perform public.cla_materialize_published_chapter_version(v_chapter_id);
  end loop;
end;
$$;

commit;
