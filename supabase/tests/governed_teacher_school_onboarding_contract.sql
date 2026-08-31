begin;

do $$
declare d text;
begin
  if to_regclass('public.teacher_school_claims') is null then raise exception 'teacher school claim ledger missing'; end if;
  if to_regclass('public.provisional_teacher_classes') is null then raise exception 'provisional teacher class store missing'; end if;

  select pg_get_functiondef('public.submit_teacher_school_claim(uuid,uuid,uuid,text[])'::regprocedure) into d;
  if position('insert into public.school_members' in lower(d)) > 0 then
    raise exception 'claim submission must not grant school membership';
  end if;
  if position('insert into public.school_levels' in lower(d)) > 0 then
    raise exception 'teacher claim must not alter canonical school levels';
  end if;

  select pg_get_functiondef('public.review_teacher_school_claim(uuid,text,text)'::regprocedure) into d;
  if position('public.is_platform_owner()' in d)=0 or position('public.is_school_admin(v_school)' in d)=0 then
    raise exception 'claim review authority gate missing';
  end if;
  if position('insert into public.school_members' in lower(d))=0 then
    raise exception 'approved claim does not create governed membership';
  end if;
  if position('insert into public.notifications' in lower(d))=0 then
    raise exception 'claim status notification missing';
  end if;

  select pg_get_functiondef('public.connect_teacher_to_school(uuid,text)'::regprocedure) into d;
  if position('submit_teacher_school_claim' in d)=0 or position('school_members' in d)>0 then
    raise exception 'legacy canonical connector still bypasses claims';
  end if;
  select pg_get_functiondef('public.connect_teacher_to_directory_school(uuid,text)'::regprocedure) into d;
  if position('submit_teacher_school_claim' in d)=0 or position('school_members' in d)>0 then
    raise exception 'legacy directory connector still bypasses claims';
  end if;

  select pg_get_functiondef('public.get_my_auth_journey_state()'::regprocedure) into d;
  if position('TEACHER_SCHOOL_CLAIM_PENDING' in d)=0 or position('/teacher/provisional' in d)=0 then
    raise exception 'provisional journey state missing';
  end if;
  if position('TEACHER_CLASS_REQUIRED' in d)>0 then
    raise exception 'class remains a hard authorization requirement';
  end if;
end $$;

rollback;
