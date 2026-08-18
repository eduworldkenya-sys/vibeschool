-- R3.2 platform-source integration.
-- Extends the existing reusable-resource visibility authority instead of
-- bypassing fn_learning_resource_visible for canonical platform assets.

begin;

alter table public.learning_resources
  drop constraint if exists learning_resources_source_type_check,
  add constraint learning_resources_source_type_check check (
    source_type = any (array[
      'publication',
      'chapter',
      'vibelearn_content',
      'content_block',
      'teacher_note',
      'uploaded_document',
      'external_resource',
      'platform_authored',
      'platform_generated'
    ]::text[])
  );

alter table public.learning_resources
  drop constraint if exists learning_resources_target_contract_check,
  add constraint learning_resources_target_contract_check check (
    (
      source_type = 'publication'
      and publication_id is not null
      and chapter_id is null
      and content_id is null
      and content_block_id is null
    )
    or (
      source_type = 'chapter'
      and publication_id is not null
      and chapter_id is not null
      and content_id is null
      and content_block_id is null
    )
    or (
      source_type = 'vibelearn_content'
      and content_id is not null
      and publication_id is null
      and chapter_id is null
      and content_block_id is null
    )
    or (
      source_type = 'content_block'
      and publication_id is not null
      and chapter_id is not null
      and content_block_id is not null
      and content_id is null
    )
    or (
      source_type = any (array[
        'teacher_note',
        'uploaded_document',
        'external_resource',
        'platform_authored',
        'platform_generated'
      ]::text[])
      and publication_id is null
      and chapter_id is null
      and content_id is null
      and content_block_id is null
    )
  );

create or replace function public.fn_learning_resource_visible(p_resource_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.learning_resources lr
    left join public.vibe_publications vp
      on vp.id = lr.publication_id
    left join public.vibe_chapters vc
      on vc.id = lr.chapter_id
    left join public.vibe_publications vcp
      on vcp.id = vc.publication_id
    left join public.vibelearn_content c
      on c.id = lr.content_id
    where lr.id = p_resource_id
      and lr.status = 'active'
      and (
        (
          lr.source_type = 'publication'
          and (vp.status = 'published' or vp.author_id = auth.uid())
        )
        or (
          lr.source_type = 'chapter'
          and (
            (vc.status = 'published' and vcp.status = 'published')
            or vcp.author_id = auth.uid()
          )
        )
        or (
          lr.source_type = 'vibelearn_content'
          and (c.status = 'live' or c.submitted_by = auth.uid())
        )
        or (
          lr.source_type = any (array['platform_authored','platform_generated']::text[])
          and lr.owner_type = 'platform'
          and lr.visibility = 'public'
          and exists (
            select 1
            from public.learning_resource_versions rv
            where rv.resource_id = lr.id
              and rv.lifecycle_status = 'certified'
          )
        )
      )
  );
$$;

revoke all on function public.fn_learning_resource_visible(uuid) from public, anon;
grant execute on function public.fn_learning_resource_visible(uuid)
  to authenticated, service_role;

comment on function public.fn_learning_resource_visible(uuid) is
  'Canonical learning-resource visibility authority. Platform-authored/generated roots are visible only when active, public, platform-owned and backed by a certified immutable version.';

commit;
