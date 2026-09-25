begin;

-- Teacher onboarding establishes teacher identity and school membership only.
-- Academic calendar provisioning is school-admin authority and must never be a
-- side effect of a teacher selecting/changing their active school.
create or replace function public.handle_teacher_onboarding()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if new.role::text is distinct from 'teacher' then
    return new;
  end if;

  -- Keep the compatibility teacher profile present. The canonical authorization
  -- grant remains school_members; active-school selection is managed separately.
  insert into public.teacher_profiles(profile_id, school_id)
  values(new.id, new.school_id)
  on conflict(profile_id) do nothing;

  -- Preserve legacy bootstrap compatibility when a teacher profile is created
  -- with a school already selected. This does not provision school-owned data.
  if new.school_id is not null then
    insert into public.school_members(profile_id, school_id, role)
    values(new.id, new.school_id, 'teacher')
    on conflict(profile_id, school_id) do nothing;
  end if;

  return new;
end;
$$;

comment on function public.handle_teacher_onboarding() is
'Compatibility trigger for teacher profile/membership bootstrap only. School calendar provisioning is intentionally excluded because it requires school-admin authority.';

notify pgrst,'reload schema';
commit;
