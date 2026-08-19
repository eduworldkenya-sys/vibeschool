begin;

create or replace function public.connect_teacher_to_directory_school(
  p_directory_id uuid,
  p_level text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_school uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_level is not null and p_level not in ('PRIMARY','JUNIOR','SENIOR_SECONDARY') then
    raise exception 'Invalid education level';
  end if;
  if not exists (
    select 1 from public.schools_directory d
    where d.id=p_directory_id and lower(coalesce(d.status,'active')) <> 'closed'
  ) then
    raise exception 'Directory school not found';
  end if;

  select c.canonical_school_id into v_school
  from public.school_identity_candidates c
  join public.schools s
    on s.id=c.canonical_school_id
   and s.deleted_at is null
   and s.status in ('pending','active')
  where c.directory_school_id=p_directory_id
    and c.status in ('matched','new')
    and c.canonical_school_id is not null
    and c.reviewed_by is not null
    and c.reviewed_at is not null
  order by c.reviewed_at desc,c.updated_at desc
  limit 1;

  if v_school is null then raise exception 'school_identity_review_required'; end if;

  insert into public.school_members(school_id,profile_id,role)
  values(v_school,v_uid,'teacher')
  on conflict(school_id,profile_id) do nothing;

  update public.profiles set school_id=v_school where id=v_uid;

  insert into public.teacher_profiles(profile_id,school_id)
  values(v_uid,v_school)
  on conflict(profile_id) do update set school_id=excluded.school_id;

  if p_level is not null then
    insert into public.school_levels(school_id,level)
    values(v_school,p_level)
    on conflict do nothing;
  end if;

  return v_school;
end;
$$;

revoke all on function public.connect_teacher_to_directory_school(uuid,text) from public, anon, service_role;
grant execute on function public.connect_teacher_to_directory_school(uuid,text) to authenticated;

comment on function public.connect_teacher_to_directory_school(uuid,text) is
  'Connects the current teacher only to an owner-reviewed canonical school identity; clean-rebuild reconciliation of production-safe implementation.';

notify pgrst, 'reload schema';
commit;
