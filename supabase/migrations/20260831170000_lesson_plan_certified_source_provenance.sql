-- Lesson plans are deterministic teaching products derived from Scheme authority
-- and exact certified VibeSchool content. Source provenance is enforced at the
-- persistence boundary so browser/model failure cannot detach a saved plan from
-- the certified resource versions used for the same curriculum identity.

begin;

create or replace function public.lesson_plan_pin_certified_sources()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.teacher_id is null then
    return new;
  end if;

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
  )
  select
    candidate.resource_id,
    candidate.resource_version_id,
    'lesson_plan',
    new.id,
    'source',
    row_number() over (
      order by candidate.explicit_scheme_link desc,
               candidate.certified_at desc,
               candidate.resource_id
    )::integer,
    '[]'::jsonb,
    '[]'::jsonb,
    new.teacher_id
  from (
    select distinct on (r.id)
      r.id as resource_id,
      v.id as resource_version_id,
      v.certified_at,
      exists (
        select 1
        from public.teaching_resource_links sl
        where new.scheme_id is not null
          and sl.target_type = 'scheme_lesson'
          and sl.scheme_lesson_id = new.scheme_id
          and sl.resource_id = r.id
      ) as explicit_scheme_link
    from public.learning_resources r
    join public.learning_resource_versions v
      on v.resource_id = r.id
     and v.lifecycle_status = 'certified'
    where r.status = 'active'
      and r.asset_kind is distinct from 'lesson_plan'
      and (r.purpose is null or r.purpose = any(array['teach','reference']::text[]))
      and (
        exists (
          select 1
          from public.teaching_resource_links sl
          where new.scheme_id is not null
            and sl.target_type = 'scheme_lesson'
            and sl.scheme_lesson_id = new.scheme_id
            and sl.resource_id = r.id
        )
        or (new.curriculum_id is not null and r.curriculum_id = new.curriculum_id)
        or (new.strand_id is not null and r.sub_strand_id = new.strand_id)
      )
    order by r.id, v.certified_at desc, v.version desc
  ) candidate
  on conflict (resource_id, lesson_plan_id, usage_role)
    where lesson_plan_id is not null
  do update
    set resource_version_id = excluded.resource_version_id,
        updated_at = now();

  return new;
end;
$$;

revoke all on function public.lesson_plan_pin_certified_sources()
  from public, anon, authenticated;

drop trigger if exists lesson_plan_pin_certified_sources
  on public.lesson_plans;

create trigger lesson_plan_pin_certified_sources
after insert or update of scheme_id, curriculum_id, strand_id
on public.lesson_plans
for each row
execute function public.lesson_plan_pin_certified_sources();

comment on function public.lesson_plan_pin_certified_sources() is
  'Pins exact certified teaching/reference source versions to a saved Scheme/curriculum-linked lesson plan. Never treats another lesson_plan asset as source authority.';

commit;
