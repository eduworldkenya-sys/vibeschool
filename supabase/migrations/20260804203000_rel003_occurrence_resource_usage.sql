begin;

create table if not exists public.teaching_occurrence_resource_usage (
  id uuid primary key default gen_random_uuid(),
  teaching_occurrence_id uuid not null
    references public.teaching_occurrences(id)
    on delete cascade,
  lesson_plan_id uuid not null
    references public.lesson_plans(id)
    on delete cascade,
  resource_id uuid not null
    references public.learning_resources(id)
    on delete restrict,
  resource_link_id uuid not null
    references public.teaching_resource_links(id)
    on delete cascade,
  school_id uuid not null
    references public.schools(id)
    on delete cascade,
  teacher_id uuid not null
    references public.profiles(id)
    on delete cascade,
  class_id uuid not null
    references public.classes(id)
    on delete cascade,
  subject_id uuid not null
    references public.subjects(id)
    on delete cascade,
  used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (teaching_occurrence_id, resource_id)
);

create index if not exists
  teaching_occurrence_resource_usage_teacher_idx
on public.teaching_occurrence_resource_usage(
  teacher_id,
  used_at desc
);

create index if not exists
  teaching_occurrence_resource_usage_class_idx
on public.teaching_occurrence_resource_usage(
  class_id,
  used_at desc
);

create index if not exists
  teaching_occurrence_resource_usage_subject_idx
on public.teaching_occurrence_resource_usage(
  subject_id,
  used_at desc
);

create index if not exists
  teaching_occurrence_resource_usage_resource_idx
on public.teaching_occurrence_resource_usage(
  resource_id,
  used_at desc
);

alter table
  public.teaching_occurrence_resource_usage
enable row level security;

create policy
  teaching_occurrence_resource_usage_teacher_select
on public.teaching_occurrence_resource_usage
for select
to authenticated
using (
  teacher_id = (select auth.uid())
);

create policy
  teaching_occurrence_resource_usage_teacher_insert
on public.teaching_occurrence_resource_usage
for insert
to authenticated
with check (
  teacher_id = (select auth.uid())
);

create or replace function
  public.mark_occurrence_resource_used(
    p_occurrence_id uuid,
    p_lesson_plan_id uuid,
    p_resource_id uuid
  )
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  occurrence_row public.teaching_occurrences%rowtype;
  lesson_row public.lesson_plans%rowtype;
  link_row public.teaching_resource_links%rowtype;
  usage_id uuid;
begin
  if caller is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'not_authenticated'
    );
  end if;

  select *
  into occurrence_row
  from public.teaching_occurrences
  where id = p_occurrence_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'occurrence_not_found'
    );
  end if;

  if occurrence_row.teacher_id <> caller then
    return jsonb_build_object(
      'ok', false,
      'error', 'occurrence_not_owned'
    );
  end if;

  if occurrence_row.lifecycle
     not in ('in_progress', 'completed') then
    return jsonb_build_object(
      'ok', false,
      'error', 'occurrence_not_started'
    );
  end if;

  select *
  into lesson_row
  from public.lesson_plans
  where id = p_lesson_plan_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'lesson_plan_not_found'
    );
  end if;

  if lesson_row.teacher_id <> caller
     or lesson_row.school_id
        is distinct from occurrence_row.school_id
     or lesson_row.class_id
        is distinct from occurrence_row.class_id
     or lesson_row.subject_id
        is distinct from occurrence_row.subject_id
     or lesson_row.timetable_slot_id
        is distinct from occurrence_row.timetable_slot_id
     or lesson_row.taught_date
        is distinct from occurrence_row.occurrence_date
  then
    return jsonb_build_object(
      'ok', false,
      'error', 'lesson_occurrence_mismatch'
    );
  end if;

  select *
  into link_row
  from public.teaching_resource_links
  where lesson_plan_id = p_lesson_plan_id
    and resource_id = p_resource_id
    and target_type = 'lesson_plan'
  order by sequence, id
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'resource_not_attached'
    );
  end if;

  insert into
    public.teaching_occurrence_resource_usage(
      teaching_occurrence_id,
      lesson_plan_id,
      resource_id,
      resource_link_id,
      school_id,
      teacher_id,
      class_id,
      subject_id
    )
  values (
    occurrence_row.id,
    lesson_row.id,
    p_resource_id,
    link_row.id,
    occurrence_row.school_id,
    caller,
    occurrence_row.class_id,
    occurrence_row.subject_id
  )
  on conflict (
    teaching_occurrence_id,
    resource_id
  )
  do update set
    resource_link_id =
      excluded.resource_link_id,
    used_at =
      public.teaching_occurrence_resource_usage.used_at
  returning id into usage_id;

  return jsonb_build_object(
    'ok', true,
    'usage_id', usage_id,
    'occurrence_id', occurrence_row.id,
    'resource_id', p_resource_id
  );
end;
$$;

create or replace function
  public.list_occurrence_resource_usage(
    p_occurrence_id uuid
  )
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  occurrence_owner uuid;
  result jsonb;
begin
  if caller is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'not_authenticated',
      'items', '[]'::jsonb
    );
  end if;

  select teacher_id
  into occurrence_owner
  from public.teaching_occurrences
  where id = p_occurrence_id;

  if occurrence_owner is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'occurrence_not_found',
      'items', '[]'::jsonb
    );
  end if;

  if occurrence_owner <> caller then
    return jsonb_build_object(
      'ok', false,
      'error', 'occurrence_not_owned',
      'items', '[]'::jsonb
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'usage_id', u.id,
        'resource_id', u.resource_id,
        'resource_link_id', u.resource_link_id,
        'lesson_plan_id', u.lesson_plan_id,
        'used_at', u.used_at,
        'title', lr.title,
        'source_type', lr.source_type,
        'usage_role', trl.usage_role
      )
      order by u.used_at, u.id
    ),
    '[]'::jsonb
  )
  into result
  from public.teaching_occurrence_resource_usage u
  join public.learning_resources lr
    on lr.id = u.resource_id
  join public.teaching_resource_links trl
    on trl.id = u.resource_link_id
  where u.teaching_occurrence_id =
    p_occurrence_id;

  return jsonb_build_object(
    'ok', true,
    'items', result
  );
end;
$$;

create or replace view
  public.teacher_resource_usage_analytics
with (security_invoker = true)
as
select
  teacher_id,
  school_id,
  class_id,
  subject_id,
  resource_id,
  count(*)::bigint as usage_count,
  count(
    distinct teaching_occurrence_id
  )::bigint as occurrence_count,
  min(used_at) as first_used_at,
  max(used_at) as last_used_at
from public.teaching_occurrence_resource_usage
group by
  teacher_id,
  school_id,
  class_id,
  subject_id,
  resource_id;

revoke all on function
  public.mark_occurrence_resource_used(
    uuid,
    uuid,
    uuid
  )
from public, anon;

revoke all on function
  public.list_occurrence_resource_usage(uuid)
from public, anon;

grant execute on function
  public.mark_occurrence_resource_used(
    uuid,
    uuid,
    uuid
  )
to authenticated, service_role;

grant execute on function
  public.list_occurrence_resource_usage(uuid)
to authenticated, service_role;

grant select on
  public.teacher_resource_usage_analytics
to authenticated, service_role;

comment on table
  public.teaching_occurrence_resource_usage
is
  'Canonical ledger of learning resources actually used in an exact teaching occurrence.';

comment on view
  public.teacher_resource_usage_analytics
is
  'Teacher-scoped aggregate of actual occurrence resource usage, not attachment counts.';

commit;
