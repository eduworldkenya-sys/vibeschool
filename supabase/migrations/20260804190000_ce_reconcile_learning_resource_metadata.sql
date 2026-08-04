begin;

create or replace function public.ce_reconcile_learning_resource_metadata(
  p_resource_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  resource_row public.learning_resources%rowtype;
begin
  select *
  into resource_row
  from public.learning_resources
  where id = p_resource_id
  for update;

  if not found then
    raise exception 'LEARNING_RESOURCE_NOT_FOUND';
  end if;

  if resource_row.source_type = 'publication' then
    update public.learning_resources lr
    set
      title = p.title,
      description = p.description,
      grade = coalesce(p.cbc_grade, lr.grade),
      subject = coalesce(p.cbc_subject, lr.subject),
      status = case
        when p.status = 'published' then 'active'
        else 'inactive'
      end,
      visibility = case
        when p.status = 'published' then 'public'
        else lr.visibility
      end,
      created_by = coalesce(lr.created_by, p.author_id),
      updated_at = now()
    from public.vibe_publications p
    where lr.id = p_resource_id
      and p.id = lr.publication_id;

  elsif resource_row.source_type = 'chapter' then
    update public.learning_resources lr
    set
      publication_id = c.publication_id,
      title = coalesce(c.title, p.title),
      description = coalesce(lr.description, p.description),
      curriculum_id = c.curriculum_id,
      sub_strand_id = c.sub_strand_id,
      grade = coalesce(p.cbc_grade, lr.grade),
      subject = coalesce(p.cbc_subject, lr.subject),
      strand = coalesce(c.cbc_strand, lr.strand),
      learning_outcomes = coalesce(
        c.learning_outcomes,
        '{}'::text[]
      ),
      status = case
        when c.status = 'published'
         and p.status = 'published'
          then 'active'
        else 'inactive'
      end,
      visibility = case
        when c.status = 'published'
         and p.status = 'published'
          then 'public'
        else lr.visibility
      end,
      created_by = coalesce(lr.created_by, p.author_id),
      updated_at = now()
    from public.vibe_chapters c
    join public.vibe_publications p
      on p.id = c.publication_id
    where lr.id = p_resource_id
      and c.id = lr.chapter_id;

  elsif resource_row.source_type = 'vibelearn_content' then
    update public.learning_resources lr
    set
      title = c.title,
      description = c.description,
      subject_id = c.subject_id,
      status = case
        when c.status = 'live' then 'active'
        else 'inactive'
      end,
      created_by = coalesce(
        lr.created_by,
        c.submitted_by
      ),
      school_id = coalesce(
        lr.school_id,
        c.school_id
      ),
      updated_at = now()
    from public.vibelearn_content c
    where lr.id = p_resource_id
      and c.id = lr.content_id;
  end if;

  return p_resource_id;
end;
$$;

revoke all on function
  public.ce_reconcile_learning_resource_metadata(uuid)
from public, anon;

grant execute on function
  public.ce_reconcile_learning_resource_metadata(uuid)
to authenticated, service_role;

create or replace function public.ce_register_learning_resource(
  p_source_type text,
  p_publication_id uuid default null,
  p_chapter_id uuid default null,
  p_content_id uuid default null,
  p_content_block_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_visibility text default 'private',
  p_school_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  result_id uuid;
  resolved_title text;
  resolved_creator uuid;
begin
  if caller is null
     and current_user not in (
       'postgres',
       'service_role'
     ) then
    raise exception 'Authentication required';
  end if;

  if p_source_type = 'publication' then
    select title, author_id
    into resolved_title, resolved_creator
    from public.vibe_publications
    where id = p_publication_id;

  elsif p_source_type = 'chapter' then
    select
      coalesce(c.title, p.title),
      p.author_id
    into resolved_title, resolved_creator
    from public.vibe_chapters c
    join public.vibe_publications p
      on p.id = c.publication_id
    where c.id = p_chapter_id
      and c.publication_id = p_publication_id;

  elsif p_source_type = 'vibelearn_content' then
    select title, submitted_by
    into resolved_title, resolved_creator
    from public.vibelearn_content
    where id = p_content_id;

  elsif p_source_type = 'content_block' then
    select
      coalesce(b.title, b.plain_text, c.title),
      p.author_id
    into resolved_title, resolved_creator
    from public.content_blocks b
    join public.vibe_chapters c
      on c.id = b.chapter_id
    join public.vibe_publications p
      on p.id = b.publication_id
    where b.id = p_content_block_id
      and b.chapter_id = p_chapter_id
      and b.publication_id = p_publication_id;

  else
    resolved_title := p_title;
    resolved_creator := caller;
  end if;

  if resolved_title is null then
    raise exception
      'Resource target does not exist or has no title';
  end if;

  if current_user not in (
       'postgres',
       'service_role'
     )
     and resolved_creator is distinct from caller then
    raise exception
      'Only the resource owner may register this resource';
  end if;

  insert into public.learning_resources(
    source_type,
    publication_id,
    chapter_id,
    content_id,
    content_block_id,
    title,
    description,
    status,
    visibility,
    owner_type,
    school_id,
    created_by,
    learning_outcomes
  )
  values (
    p_source_type,
    p_publication_id,
    p_chapter_id,
    p_content_id,
    p_content_block_id,
    coalesce(
      nullif(btrim(p_title), ''),
      resolved_title
    ),
    p_description,
    'active',
    p_visibility,
    case
      when p_source_type in (
        'publication',
        'chapter',
        'content_block'
      ) then 'publisher'
      else 'creator'
    end,
    p_school_id,
    coalesce(caller, resolved_creator),
    '{}'::text[]
  )
  on conflict (canonical_key) do update
  set
    title = excluded.title,
    description = excluded.description,
    status = 'active',
    visibility = excluded.visibility,
    school_id = excluded.school_id,
    updated_at = now()
  returning id into result_id;

  perform public.ce_reconcile_learning_resource_metadata(
    result_id
  );

  return result_id;
end;
$$;

revoke all on function
  public.ce_register_learning_resource(
    text,
    uuid,
    uuid,
    uuid,
    uuid,
    text,
    text,
    text,
    uuid
  )
from public, anon;

grant execute on function
  public.ce_register_learning_resource(
    text,
    uuid,
    uuid,
    uuid,
    uuid,
    text,
    text,
    text,
    uuid
  )
to authenticated, service_role;

do $$
declare
  resource_id uuid;
begin
  for resource_id in
    select id
    from public.learning_resources
    where source_type in (
      'publication',
      'chapter',
      'vibelearn_content'
    )
  loop
    perform public.ce_reconcile_learning_resource_metadata(
      resource_id
    );
  end loop;
end;
$$;

comment on function
  public.ce_reconcile_learning_resource_metadata(uuid)
is
  'Synchronizes derived learning-resource metadata from its authoritative publication, chapter or VibeLearn source row.';

commit;
