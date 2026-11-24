-- #1984: enforce adult self-service at the canonical student creation RPC.
-- Existing student IDs remain valid. Underage learners use the separately
-- guardian-authorized managed-learner activation RPC.
begin;
create or replace function public.ensure_independent_learner_student(p_user_id uuid)
returns uuid language plpgsql security definer
set search_path=public,auth,pg_temp as $$
declare
  v_identity public.independent_learner_identities%rowtype;
  v_profile public.profiles%rowtype;
  v_student_id uuid;
  v_count integer;
begin
  if p_user_id is null then raise exception 'invalid_learner' using errcode='42501'; end if;
  select * into v_identity from public.independent_learner_identities
    where user_id=p_user_id for update;
  select * into v_profile from public.profiles
    where id=p_user_id for update;
  if v_identity.user_id is null or v_profile.id is null
    or v_identity.account_state is distinct from 'restricted'
    or v_identity.learner_email_verified_at is null
    or v_identity.grade_label is null
    or v_profile.account_status::text is distinct from 'active'
    or v_profile.is_anonymized is distinct from false
    or v_profile.role is not null
    or not exists(select 1 from auth.users u
      where u.id=p_user_id and u.email_confirmed_at is not null)
  then
    raise exception 'independent_learner_not_verified' using errcode='42501';
  end if;
  select count(*) into v_count from public.students
    where profile_id=p_user_id and deleted_at is null;
  if v_count>1 then raise exception 'ambiguous_learner_identity' using errcode='23505'; end if;
  if v_count=1 then
    -- Backwards compatibility: existing verified learner IDs and progress
    -- remain intact, even if their historical age band was unconfirmed.
    select id into v_student_id from public.students
      where profile_id=p_user_id and deleted_at is null limit 1;
    if exists(select 1 from public.student_classes
      where student_id=v_student_id and is_current)
      or exists(select 1 from public.students
        where id=v_student_id and class_id is not null)
    then raise exception 'existing_school_identity' using errcode='42501'; end if;
    return v_student_id;
  end if;
  -- Every NEW independent self-service account must have an adult declaration
  -- and must not be known underage from its canonical profile DOB.
  if v_identity.age_band is distinct from 'adult'
    or (v_profile.date_of_birth is not null
      and v_profile.date_of_birth > (current_date - interval '18 years')::date)
  then raise exception 'adult_learning_declaration_required' using errcode='42501'; end if;
  insert into public.students(profile_id,name,class_id,created_by)
   values(p_user_id,coalesce(nullif(btrim(v_profile.full_name),''),'Learner'),null,p_user_id)
   returning id into v_student_id;
  return v_student_id;
end;
$$;
revoke all on function public.ensure_independent_learner_student(uuid) from public,anon,authenticated;
grant execute on function public.ensure_independent_learner_student(uuid) to service_role;
notify pgrst,'reload schema';
commit;
