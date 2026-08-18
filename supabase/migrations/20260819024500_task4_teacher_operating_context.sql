begin;

create table if not exists public.teacher_active_school_preferences (
  teacher_id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.teacher_active_school_preferences enable row level security;

revoke all on table public.teacher_active_school_preferences from public, anon, authenticated;
grant select on table public.teacher_active_school_preferences to authenticated;
grant all on table public.teacher_active_school_preferences to service_role;

drop policy if exists teacher_active_school_preferences_read_own on public.teacher_active_school_preferences;
create policy teacher_active_school_preferences_read_own
on public.teacher_active_school_preferences
for select
to authenticated
using (teacher_id = (select auth.uid()));

-- teacher_profiles.school_id remains a compatibility pointer for older teacher
-- surfaces. It is not authority. A teacher may only persist a school in which
-- they hold teacher membership.
drop policy if exists pol_teacher_profiles_insert on public.teacher_profiles;
create policy pol_teacher_profiles_insert
on public.teacher_profiles
for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and (
    school_id is null
    or exists (
      select 1 from public.school_members sm
      where sm.profile_id = (select auth.uid())
        and sm.school_id = teacher_profiles.school_id
        and sm.role::text = 'teacher'
    )
  )
);

drop policy if exists pol_teacher_profiles_update on public.teacher_profiles;
create policy pol_teacher_profiles_update
on public.teacher_profiles
for update
to authenticated
using (profile_id = (select auth.uid()))
with check (
  profile_id = (select auth.uid())
  and (
    school_id is null
    or exists (
      select 1 from public.school_members sm
      where sm.profile_id = (select auth.uid())
        and sm.school_id = teacher_profiles.school_id
        and sm.role::text = 'teacher'
    )
  )
);

create or replace function public.teacher_set_active_school(p_school_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_school_id is null then
    raise exception 'teacher_school_scope_required';
  end if;
  if not exists (
    select 1
    from public.school_members sm
    where sm.profile_id = v_uid
      and sm.school_id = p_school_id
      and sm.role::text = 'teacher'
  ) then
    raise exception 'teacher_school_scope_not_authorized';
  end if;

  insert into public.teacher_active_school_preferences(teacher_id, school_id, updated_at)
  values (v_uid, p_school_id, clock_timestamp())
  on conflict (teacher_id)
  do update set school_id = excluded.school_id, updated_at = excluded.updated_at;

  -- Compatibility only: keep old teacher layout/profile readers aligned with
  -- the canonical preference. The membership check above is the authority.
  insert into public.teacher_profiles(profile_id, school_id)
  values (v_uid, p_school_id)
  on conflict (profile_id)
  do update set school_id = excluded.school_id, updated_at = clock_timestamp();

  return jsonb_build_object('teacher_id', v_uid, 'school_id', p_school_id);
end;
$$;

create or replace function public.teacher_get_operating_context(p_requested_school_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_school_id uuid;
  v_school_count integer := 0;
  v_term jsonb := null;
  v_schools jsonb := '[]'::jsonb;
  v_classes jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select count(distinct sm.school_id)
    into v_school_count
  from public.school_members sm
  where sm.profile_id = v_uid
    and sm.role::text = 'teacher';

  if v_school_count = 0 then
    return jsonb_build_object(
      'teacher_id', v_uid,
      'school_id', null,
      'school_count', 0,
      'schools', '[]'::jsonb,
      'classes', '[]'::jsonb,
      'active_term', null,
      'state', 'needs_school'
    );
  end if;

  if p_requested_school_id is not null then
    if not exists (
      select 1 from public.school_members sm
      where sm.profile_id = v_uid
        and sm.school_id = p_requested_school_id
        and sm.role::text = 'teacher'
    ) then
      raise exception 'teacher_school_scope_not_authorized';
    end if;
    v_school_id := p_requested_school_id;
  else
    select pref.school_id
      into v_school_id
    from public.teacher_active_school_preferences pref
    join public.school_members sm
      on sm.profile_id = v_uid
     and sm.school_id = pref.school_id
     and sm.role::text = 'teacher'
    where pref.teacher_id = v_uid;

    if v_school_id is null then
      -- Preserve an already-authorized compatibility choice if one exists.
      select tp.school_id
        into v_school_id
      from public.teacher_profiles tp
      join public.school_members sm
        on sm.profile_id = v_uid
       and sm.school_id = tp.school_id
       and sm.role::text = 'teacher'
      where tp.profile_id = v_uid;
    end if;

    if v_school_id is null then
      select sm.school_id
        into v_school_id
      from public.school_members sm
      left join public.teacher_classes tc
        on tc.teacher_id = v_uid
       and tc.school_id = sm.school_id
      where sm.profile_id = v_uid
        and sm.role::text = 'teacher'
      group by sm.school_id
      order by count(tc.id) desc, sm.school_id
      limit 1;
    end if;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'assignment_count', coalesce(x.assignment_count, 0),
      'active', s.id = v_school_id
    ) order by (s.id = v_school_id) desc, s.name, s.id
  ), '[]'::jsonb)
    into v_schools
  from public.school_members sm
  join public.schools s on s.id = sm.school_id
  left join lateral (
    select count(*)::integer as assignment_count
    from public.teacher_classes tc
    where tc.teacher_id = v_uid
      and tc.school_id = sm.school_id
  ) x on true
  where sm.profile_id = v_uid
    and sm.role::text = 'teacher';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'assignment_id', tc.id,
      'class_id', tc.class_id,
      'class_name', c.name,
      'stream', c.stream,
      'subject_id', tc.subject_id,
      'subject_name', subj.name,
      'is_class_teacher', tc.is_class_teacher
    ) order by c.name, c.stream nulls first, subj.name, tc.id
  ), '[]'::jsonb)
    into v_classes
  from public.teacher_classes tc
  join public.classes c
    on c.id = tc.class_id
   and c.school_id = tc.school_id
  join public.subjects subj
    on subj.id = tc.subject_id
  where tc.teacher_id = v_uid
    and tc.school_id = v_school_id;

  select jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'term', t.term,
      'academic_year', t.academic_year,
      'start_date', t.start_date,
      'end_date', t.end_date,
      'status', t.status
    )
    into v_term
  from public.academic_terms t
  where t.school_id = v_school_id
    and t.status = 'active'
  order by t.start_date desc, t.id
  limit 1;

  return jsonb_build_object(
    'teacher_id', v_uid,
    'school_id', v_school_id,
    'school_count', v_school_count,
    'schools', v_schools,
    'classes', v_classes,
    'active_term', v_term,
    'state', case when jsonb_array_length(v_classes) = 0 then 'needs_class' else 'ready' end
  );
end;
$$;

create or replace function public.teacher_set_active_twin_school(p_school_id uuid)
returns jsonb
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select public.teacher_set_active_school(p_school_id);
$$;

revoke all on function public.teacher_set_active_school(uuid) from public, anon;
revoke all on function public.teacher_get_operating_context(uuid) from public, anon;
revoke all on function public.teacher_set_active_twin_school(uuid) from public, anon;
grant execute on function public.teacher_set_active_school(uuid) to authenticated, service_role;
grant execute on function public.teacher_get_operating_context(uuid) to authenticated, service_role;
grant execute on function public.teacher_set_active_twin_school(uuid) to authenticated, service_role;

commit;
