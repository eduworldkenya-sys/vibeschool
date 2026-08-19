begin;

-- Task 26: Teacher Profile is self-service presentation/professional context,
-- never a back door into school/HR/finance authority.

create or replace function public.guard_teacher_profile_self_service()
returns trigger
language plpgsql
security invoker
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- Service/database maintenance has no end-user uid and remains governed by its
  -- own role/grants. Admin writes to another teacher remain subject to RLS.
  if v_uid is null or new.profile_id is distinct from v_uid then
    return new;
  end if;

  -- A historical teacher_profiles row is not itself proof that the caller is a
  -- current teacher. Null/other roles must not regain Teacher self-service by
  -- directly targeting a legacy professional-profile row.
  if not exists (
    select 1
    from public.profiles p
    where p.id = v_uid
      and p.role = 'teacher'
      and p.account_status::text = 'active'
  ) then
    raise exception 'teacher_profile_not_authorized'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.school_id is not null
       or new.employment_type is not null
       or new.subjects_taught is not null
       or new.designation is not null
       or new.gender is not null
       or new.date_of_birth is not null
       or new.nationality is not null
       or new.twin_notes is not null
       or coalesce(new.leave_balance, 0) <> 0
       or new.appraisal_score is not null
       or new.appraisal_notes is not null
       or new.finance_ref is not null
       or coalesce(new.documents, '[]'::jsonb) <> '[]'::jsonb then
      raise exception 'teacher_profile_authoritative_fields_school_managed'
        using errcode = '42501';
    end if;
  else
    if new.school_id is distinct from old.school_id
       or new.employment_type is distinct from old.employment_type
       or new.subjects_taught is distinct from old.subjects_taught
       or new.designation is distinct from old.designation
       or new.gender is distinct from old.gender
       or new.date_of_birth is distinct from old.date_of_birth
       or new.nationality is distinct from old.nationality
       or new.twin_notes is distinct from old.twin_notes
       or new.leave_balance is distinct from old.leave_balance
       or new.appraisal_score is distinct from old.appraisal_score
       or new.appraisal_notes is distinct from old.appraisal_notes
       or new.finance_ref is distinct from old.finance_ref
       or new.documents is distinct from old.documents
       or new.created_at is distinct from old.created_at then
      raise exception 'teacher_profile_authoritative_fields_school_managed'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_teacher_profile_self_service() from public, anon, authenticated;

drop trigger if exists trg_guard_teacher_profile_self_service on public.teacher_profiles;
create trigger trg_guard_teacher_profile_self_service
before insert or update on public.teacher_profiles
for each row execute function public.guard_teacher_profile_self_service();

create or replace function public.teacher_update_my_profile(
  p_full_name text,
  p_phone text default null,
  p_bio text default null,
  p_gender text default null,
  p_date_of_birth date default null,
  p_tsc_number text default null,
  p_teaching_style text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_full_name text := nullif(btrim(coalesce(p_full_name, '')), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  v_tsc text := nullif(btrim(coalesce(p_tsc_number, '')), '');
  v_style text := nullif(btrim(coalesce(p_teaching_style, '')), '');
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_uid and p.role = 'teacher' and p.account_status::text = 'active'
  ) then
    raise exception 'teacher_profile_not_authorized' using errcode = '42501';
  end if;

  if v_full_name is null or length(v_full_name) > 120 then
    raise exception 'teacher_profile_name_invalid' using errcode = '22023';
  end if;

  if v_phone is not null and length(v_phone) > 32 then
    raise exception 'teacher_profile_phone_invalid' using errcode = '22023';
  end if;

  if v_bio is not null and length(v_bio) > 600 then
    raise exception 'teacher_profile_bio_invalid' using errcode = '22023';
  end if;

  if v_tsc is not null and length(v_tsc) > 40 then
    raise exception 'teacher_profile_tsc_invalid' using errcode = '22023';
  end if;

  if v_style is not null and length(v_style) > 1000 then
    raise exception 'teacher_profile_teaching_style_invalid' using errcode = '22023';
  end if;

  update public.profiles
  set full_name = v_full_name,
      phone = v_phone,
      bio = v_bio,
      gender = nullif(btrim(coalesce(p_gender, '')), ''),
      date_of_birth = p_date_of_birth,
      updated_at = clock_timestamp()
  where id = v_uid;

  insert into public.teacher_profiles(profile_id, tsc_number, teaching_style, created_at, updated_at)
  values (v_uid, v_tsc, v_style, clock_timestamp(), clock_timestamp())
  on conflict (profile_id) do update
  set tsc_number = excluded.tsc_number,
      teaching_style = excluded.teaching_style,
      updated_at = excluded.updated_at;

  return jsonb_build_object(
    'profile_id', v_uid,
    'saved', true
  );
end;
$$;

revoke all on function public.teacher_update_my_profile(text,text,text,text,date,text,text) from public, anon;
grant execute on function public.teacher_update_my_profile(text,text,text,text,date,text,text) to authenticated, service_role;

commit;
