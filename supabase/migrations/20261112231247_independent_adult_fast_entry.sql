-- Independent adult fast entry: school and child setup are optional onboarding
-- steps. This changes only the destination resolver, never canonical role claims,
-- student identities, school memberships, parent relationships or their RLS.
-- Retain the existing restricted independent learner route unchanged.
create or replace function public.get_my_onboarding_state()
returns jsonb
language sql stable security definer
set search_path to public, auth, pg_temp
as $$
  with base as (select public.get_my_auth_journey_state() as j),
  eligible as (
    select i.grade_label
      from public.independent_learner_identities i
      join public.profiles p on p.id=i.user_id
     where i.user_id=(select auth.uid())
       and i.account_state='restricted'
       and i.learner_email_verified_at is not null
       and i.grade_label is not null
       and p.role is null
       and p.account_status::text='active'
       and not p.is_anonymized
       and (select count(*) from public.students s where s.profile_id=i.user_id and s.deleted_at is null)<=1
       and not exists (
         select 1 from public.students s
         join public.student_classes sc on sc.student_id=s.id and sc.is_current=true
         where s.profile_id=i.user_id and s.deleted_at is null
       )
       and not exists (
         select 1 from public.students s
          where s.profile_id=i.user_id and s.deleted_at is null and s.class_id is not null
       )
     limit 1
  )
  select case
    when (j->>'role')='teacher' and (j->>'reason_code')='TEACHER_SCHOOL_REQUIRED'
      then j || jsonb_build_object('state','ready','destination','/teacher/pulse',
                                    'reason_code','INDEPENDENT_TEACHER_READY','school_link_optional',true)
    when (j->>'role')='parent' and (j->>'reason_code')='PARENT_CHILD_REQUIRED'
      then j || jsonb_build_object('state','ready','destination','/parent',
                                    'reason_code','PARENT_READY_TO_LINK','child_link_optional',true)
    when (j->>'reason_code')='ROLE_UNCLAIMED' and exists(select 1 from eligible)
      then jsonb_build_object('authenticated',true,'role','student','state','ready',
                              'destination','/student','independent',true,
                              'grade_label',(select grade_label from eligible),
                              'reason_code','INDEPENDENT_LEARNER_VERIFIED')
    else j
  end
  from base;
$$;
revoke all on function public.get_my_onboarding_state() from public, anon;
grant execute on function public.get_my_onboarding_state() to authenticated, service_role;
