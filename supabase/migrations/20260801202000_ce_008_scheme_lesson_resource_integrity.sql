begin;

alter table public.scheme_lesson_resource_links
  add column resource_id uuid references public.learning_resources(id) on delete restrict;

update public.scheme_lesson_resource_links l
set resource_id = r.id
from public.learning_resources r
where r.source_type = 'chapter'
  and r.chapter_id = l.chapter_id;

alter table public.scheme_lesson_resource_links
  alter column resource_id set not null,
  drop constraint if exists scheme_lesson_resource_links_resource_role_check,
  add constraint scheme_lesson_resource_links_resource_role_check
    check (resource_role in (
      'primary','supplementary','teacher_reference','learner_reading',
      'exercise','remedial','enrichment','project','assessment_source',
      'before_class','in_class','after_class','homework'
    )),
  drop constraint if exists chk_scheme_resource_pages,
  add constraint chk_scheme_resource_pages
    check (
      (page_start is null and page_end is null)
      or (page_start is not null and page_start > 0 and page_end is not null and page_end >= page_start)
    );

create index if not exists idx_scheme_resource_links_resource
  on public.scheme_lesson_resource_links(resource_id);

create or replace function public.ce_validate_scheme_resource_link()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  chapter_publication uuid;
  resource_publication uuid;
  resource_chapter uuid;
  resource_status text;
begin
  select publication_id into chapter_publication
  from public.vibe_chapters
  where id = new.chapter_id;

  if chapter_publication is null then
    raise exception 'Chapter % does not exist', new.chapter_id;
  end if;

  if chapter_publication <> new.publication_id then
    raise exception 'Chapter does not belong to publication';
  end if;

  select publication_id, chapter_id, status
  into resource_publication, resource_chapter, resource_status
  from public.learning_resources
  where id = new.resource_id;

  if resource_publication is null then
    raise exception 'Learning resource % does not exist', new.resource_id;
  end if;

  if resource_status <> 'active' then
    raise exception 'Learning resource % is not active', new.resource_id;
  end if;

  if resource_publication <> new.publication_id or resource_chapter <> new.chapter_id then
    raise exception 'Learning resource does not match publication/chapter';
  end if;

  if not exists (
    select 1 from public.vibe_publications p
    where p.id = new.publication_id and p.status = 'published'
  ) then
    raise exception 'Publication must be published before linking to a scheme lesson';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ce_validate_scheme_resource_link on public.scheme_lesson_resource_links;
create trigger ce_validate_scheme_resource_link
before insert or update on public.scheme_lesson_resource_links
for each row execute function public.ce_validate_scheme_resource_link();

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
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_school_id uuid;
  v_teacher_id uuid;
  v_resource_id uuid;
  v_row public.scheme_lesson_resource_links;
begin
  if v_uid is null then
    return jsonb_build_object('ok',false,'reason','auth_required');
  end if;

  select school_id, teacher_id into v_school_id, v_teacher_id
  from public.scheme_of_work
  where id = p_scheme_lesson_id;

  if v_school_id is null then
    return jsonb_build_object('ok',false,'reason','scheme_lesson_not_found');
  end if;

  if v_teacher_id is distinct from v_uid and not public.is_school_admin(v_school_id) then
    return jsonb_build_object('ok',false,'reason','not_authorized');
  end if;

  select id into v_resource_id
  from public.learning_resources
  where source_type = 'chapter'
    and publication_id = p_publication_id
    and chapter_id = p_chapter_id
    and status = 'active';

  if v_resource_id is null then
    return jsonb_build_object('ok',false,'reason','learning_resource_not_registered');
  end if;

  insert into public.scheme_lesson_resource_links(
    scheme_lesson_id, publication_id, chapter_id, resource_id,
    resource_role, sequence, page_start, page_end, exercise_refs, created_by
  ) values (
    p_scheme_lesson_id, p_publication_id, p_chapter_id, v_resource_id,
    p_resource_role, coalesce(p_sequence,1), p_page_start, p_page_end,
    coalesce(p_exercise_refs,'[]'::jsonb), v_uid
  )
  on conflict (scheme_lesson_id, chapter_id, resource_role)
  do update set
    resource_id = excluded.resource_id,
    publication_id = excluded.publication_id,
    sequence = excluded.sequence,
    page_start = excluded.page_start,
    page_end = excluded.page_end,
    exercise_refs = excluded.exercise_refs,
    updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'ok',true,
    'reason',null,
    'resource_link_id',v_row.id,
    'resource_id',v_row.resource_id,
    'resource_role',v_row.resource_role
  );
exception
  when check_violation then
    return jsonb_build_object('ok',false,'reason','constraint_violation');
end;
$$;

create or replace function public.list_scheme_lesson_resources(p_scheme_lesson_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_school_id uuid;
  v_teacher_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok',false,'reason','auth_required');
  end if;

  select school_id, teacher_id into v_school_id, v_teacher_id
  from public.scheme_of_work
  where id = p_scheme_lesson_id;

  if v_school_id is null then
    return jsonb_build_object('ok',false,'reason','scheme_lesson_not_found');
  end if;

  if v_teacher_id is distinct from v_uid
     and not public.is_school_admin(v_school_id)
     and not exists (
       select 1 from public.school_members sm
       where sm.school_id = v_school_id and sm.profile_id = v_uid
     ) then
    return jsonb_build_object('ok',false,'reason','not_authorized');
  end if;

  return jsonb_build_object(
    'ok',true,
    'reason',null,
    'resources',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',l.id,
        'resource_id',l.resource_id,
        'publication_id',l.publication_id,
        'chapter_id',l.chapter_id,
        'publication_title',p.title,
        'chapter_title',c.title,
        'resource_role',l.resource_role,
        'sequence',l.sequence,
        'page_start',l.page_start,
        'page_end',l.page_end,
        'exercise_refs',l.exercise_refs,
        'created_by',l.created_by,
        'created_at',l.created_at,
        'updated_at',l.updated_at
      ) order by l.sequence,l.resource_role)
      from public.scheme_lesson_resource_links l
      join public.vibe_publications p on p.id = l.publication_id
      join public.vibe_chapters c on c.id = l.chapter_id
      where l.scheme_lesson_id = p_scheme_lesson_id
    ),'[]'::jsonb)
  );
end;
$$;

revoke execute on function public.list_scheme_lesson_resources(uuid)
  from public, anon;
revoke execute on function public.upsert_scheme_lesson_resource(
  uuid,uuid,uuid,text,integer,integer,integer,jsonb
) from public, anon;
grant execute on function public.list_scheme_lesson_resources(uuid)
  to authenticated, service_role;
grant execute on function public.upsert_scheme_lesson_resource(
  uuid,uuid,uuid,text,integer,integer,integer,jsonb
) to authenticated, service_role;

insert into public.content_engine_authorities(domain,authoritative_table,authority_role,derived_tables,notes)
values(
  'scheme_resource',
  'public.scheme_lesson_resource_links',
  'Authoritative planning-time link between a scheme lesson and a registered learning resource',
  array['public.vibe_chapter_assignments','public.teaching_resource_links'],
  'Every scheme resource link must reference an active registered chapter resource and preserve publication/chapter identity.'
)
on conflict(domain) do update
set authoritative_table = excluded.authoritative_table,
    authority_role = excluded.authority_role,
    derived_tables = excluded.derived_tables,
    notes = excluded.notes,
    updated_at = now();

commit;
