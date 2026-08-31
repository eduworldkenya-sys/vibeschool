begin;

-- A teacher selecting a school is evidence for a claim, never authority.
create table if not exists public.teacher_school_claims (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique default ('VS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  school_id uuid references public.schools(id) on delete restrict,
  directory_school_id uuid references public.schools_directory(id) on delete restrict,
  discovery_request_id uuid references public.school_discovery_requests(id) on delete set null,
  requested_levels text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','needs_information','approved','rejected','cancelled','expired')),
  review_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_school_claim_target check (num_nonnulls(school_id, directory_school_id, discovery_request_id) >= 1),
  constraint teacher_school_claim_levels check (requested_levels <@ array['PRIMARY','JUNIOR','SENIOR_SECONDARY']::text[])
);

create unique index if not exists uq_teacher_school_claim_active
  on public.teacher_school_claims (
    teacher_id,
    coalesce(school_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(directory_school_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(discovery_request_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) where status in ('pending','needs_information');
create index if not exists idx_teacher_school_claim_queue on public.teacher_school_claims(status, created_at);
create index if not exists idx_teacher_school_claim_teacher on public.teacher_school_claims(teacher_id, created_at desc);

alter table public.teacher_school_claims enable row level security;
revoke all on table public.teacher_school_claims from public, anon;
grant select on table public.teacher_school_claims to authenticated;

drop policy if exists teacher_school_claims_read_own on public.teacher_school_claims;
create policy teacher_school_claims_read_own on public.teacher_school_claims
  for select to authenticated using (teacher_id = (select auth.uid()));

create table if not exists public.provisional_teacher_classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  grade text not null,
  stream text not null default '',
  subject text not null,
  promoted_class_id uuid references public.classes(id) on delete set null,
  promoted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(teacher_id, grade, stream, subject),
  check (grade in ('PP1','PP2','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12','Form 1','Form 2','Form 3','Form 4'))
);
alter table public.provisional_teacher_classes enable row level security;
revoke all on table public.provisional_teacher_classes from public, anon;
grant select on table public.provisional_teacher_classes to authenticated;
drop policy if exists provisional_teacher_classes_read_own on public.provisional_teacher_classes;
create policy provisional_teacher_classes_read_own on public.provisional_teacher_classes
  for select to authenticated using (teacher_id = (select auth.uid()));

create or replace function public.submit_teacher_school_claim(
  p_school_id uuid default null,
  p_directory_school_id uuid default null,
  p_discovery_request_id uuid default null,
  p_levels text[] default '{}'
) returns jsonb
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_claim public.teacher_school_claims%rowtype;
  v_levels text[];
  v_mapped_school uuid;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_uid and p.role::text='teacher' and p.account_status::text='active' and not coalesce(p.is_anonymized,false)) then
    raise exception 'active_teacher_required' using errcode='42501';
  end if;
  if num_nonnulls(p_school_id,p_directory_school_id,p_discovery_request_id) <> 1 then
    raise exception 'exactly_one_school_claim_target_required' using errcode='22023';
  end if;
  select coalesce(array_agg(distinct x order by x),'{}') into v_levels
  from unnest(coalesce(p_levels,'{}')) x;
  if coalesce(array_length(v_levels,1),0)=0 or not (v_levels <@ array['PRIMARY','JUNIOR','SENIOR_SECONDARY']::text[]) then
    raise exception 'valid_requested_level_required' using errcode='22023';
  end if;
  if p_school_id is not null and not exists(select 1 from public.schools s where s.id=p_school_id and s.deleted_at is null and s.status in ('pending','active')) then
    raise exception 'school_not_available' using errcode='22023';
  end if;
  if p_directory_school_id is not null then
    if not exists(select 1 from public.schools_directory d where d.id=p_directory_school_id and lower(coalesce(d.status,'active'))<>'closed') then
      raise exception 'directory_school_not_found' using errcode='22023';
    end if;
    select c.canonical_school_id into v_mapped_school
    from public.school_identity_candidates c
    where c.directory_school_id=p_directory_school_id and c.status in ('matched','new')
      and c.canonical_school_id is not null and c.reviewed_by is not null and c.reviewed_at is not null
    order by c.reviewed_at desc limit 1;
  end if;
  if p_discovery_request_id is not null and not exists(select 1 from public.school_discovery_requests r where r.id=p_discovery_request_id and r.requested_by=v_uid) then
    raise exception 'discovery_request_not_owned' using errcode='42501';
  end if;

  select * into v_claim from public.teacher_school_claims c
  where c.teacher_id=v_uid and c.status in ('pending','needs_information')
    and c.school_id is not distinct from coalesce(p_school_id,v_mapped_school)
    and c.directory_school_id is not distinct from p_directory_school_id
    and c.discovery_request_id is not distinct from p_discovery_request_id
  order by c.created_at desc limit 1;
  if found then
    update public.teacher_school_claims set requested_levels=v_levels,updated_at=now()
    where id=v_claim.id returning * into v_claim;
  else
    insert into public.teacher_school_claims(teacher_id,school_id,directory_school_id,discovery_request_id,requested_levels)
    values(v_uid,coalesce(p_school_id,v_mapped_school),p_directory_school_id,p_discovery_request_id,v_levels)
    returning * into v_claim;
  end if;
  return jsonb_build_object('claim_id',v_claim.id,'reference_code',v_claim.reference_code,'status',v_claim.status,
    'review_target_hours',24,'provisional_destination','/teacher/provisional');
end;
$$;

create or replace function public.get_my_teacher_school_claim()
returns jsonb language sql stable security definer
set search_path=public,auth,pg_temp
as $$
  select coalesce((select jsonb_build_object(
    'claim_id',c.id,'reference_code',c.reference_code,'status',c.status,'requested_levels',c.requested_levels,
    'school_name',coalesce(s.name,d.name,r.name),'created_at',c.created_at,'updated_at',c.updated_at,
    'review_note',case when c.status in ('needs_information','rejected') then c.review_note else null end,
    'review_target_hours',24
  ) from public.teacher_school_claims c
    left join public.schools s on s.id=c.school_id
    left join public.schools_directory d on d.id=c.directory_school_id
    left join public.school_discovery_requests r on r.id=c.discovery_request_id
    where c.teacher_id=auth.uid() order by c.created_at desc limit 1),'{}'::jsonb);
$$;

create or replace function public.create_provisional_teacher_class(p_grade text,p_stream text,p_subject text)
returns uuid language plpgsql security definer
set search_path=public,auth,pg_temp
as $$
declare v_uid uuid:=auth.uid(); v_id uuid;
begin
  if v_uid is null or not exists(select 1 from public.profiles p where p.id=v_uid and p.role::text='teacher' and p.account_status::text='active' and not coalesce(p.is_anonymized,false)) then
    raise exception 'active_teacher_required' using errcode='42501';
  end if;
  if p_grade not in ('PP1','PP2','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12','Form 1','Form 2','Form 3','Form 4') then
    raise exception 'invalid_class_level' using errcode='22023';
  end if;
  if length(trim(coalesce(p_subject,'')))<2 then raise exception 'subject_required' using errcode='22023'; end if;
  insert into public.provisional_teacher_classes(teacher_id,grade,stream,subject)
  values(v_uid,p_grade,trim(coalesce(p_stream,'')),trim(p_subject))
  on conflict(teacher_id,grade,stream,subject) do update set updated_at=now()
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.review_teacher_school_claim(p_claim_id uuid,p_action text,p_note text default null)
returns jsonb language plpgsql security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_uid uuid:=auth.uid(); c public.teacher_school_claims%rowtype; v_school uuid; pc record; v_subject uuid; v_class uuid;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_action not in ('approved','rejected','needs_information') then raise exception 'invalid_review_action' using errcode='22023'; end if;
  select * into c from public.teacher_school_claims where id=p_claim_id for update;
  if not found then raise exception 'claim_not_found' using errcode='22023'; end if;
  v_school:=c.school_id;
  if v_school is null and c.directory_school_id is not null then
    select x.canonical_school_id into v_school from public.school_identity_candidates x
    where x.directory_school_id=c.directory_school_id and x.status in ('matched','new') and x.reviewed_by is not null and x.reviewed_at is not null
    order by x.reviewed_at desc limit 1;
  end if;
  if not (coalesce(public.is_platform_owner(),false) or (v_school is not null and public.is_school_admin(v_school))) then
    raise exception 'claim_reviewer_authority_required' using errcode='42501';
  end if;
  if c.status not in ('pending','needs_information') then raise exception 'claim_already_resolved' using errcode='22023'; end if;
  if p_action='approved' and v_school is null then raise exception 'canonical_school_resolution_required' using errcode='22023'; end if;

  update public.teacher_school_claims set status=p_action,school_id=coalesce(school_id,v_school),review_note=nullif(trim(coalesce(p_note,'')),''),
    reviewed_by=v_uid,reviewed_at=now(),updated_at=now() where id=c.id;
  insert into public.notifications(school_id,user_id,title,body,type,related_id)
  values(
    v_school,c.teacher_id,
    case p_action when 'approved' then 'School membership approved' when 'needs_information' then 'School claim needs information' else 'School claim update' end,
    case p_action when 'approved' then 'Your verified Teacher OS school access is ready.' when 'needs_information' then coalesce(nullif(trim(p_note),''),'Please review and update your school claim.') else coalesce(nullif(trim(p_note),''),'Your school claim was not approved.') end,
    'teacher_school_claim',c.id
  );
  if p_action='approved' then
    insert into public.school_members(school_id,profile_id,role) values(v_school,c.teacher_id,'teacher') on conflict(school_id,profile_id) do nothing;
    update public.profiles set school_id=v_school where id=c.teacher_id;
    insert into public.teacher_profiles(profile_id,school_id) values(c.teacher_id,v_school)
      on conflict(profile_id) do update set school_id=excluded.school_id,updated_at=now();
    for pc in select * from public.provisional_teacher_classes where teacher_id=c.teacher_id and promoted_at is null loop
      select id into v_subject from public.subjects where school_id=v_school and name=pc.subject limit 1;
      if v_subject is null then insert into public.subjects(school_id,name) values(v_school,pc.subject) returning id into v_subject; end if;
      select id into v_class from public.classes where school_id=v_school and name=pc.grade and coalesce(stream,'')=pc.stream limit 1;
      if v_class is null then insert into public.classes(school_id,teacher_id,name,stream,subject) values(v_school,c.teacher_id,pc.grade,nullif(pc.stream,''),pc.subject) returning id into v_class; end if;
      insert into public.teacher_classes(school_id,teacher_id,class_id,subject_id,is_class_teacher)
        values(v_school,c.teacher_id,v_class,v_subject,true) on conflict do nothing;
      update public.provisional_teacher_classes set promoted_class_id=v_class,promoted_at=now(),updated_at=now() where id=pc.id;
    end loop;
  end if;
  return jsonb_build_object('claim_id',c.id,'status',p_action,'school_id',v_school);
end; $$;

create or replace function public.hq_list_teacher_school_claims(p_status text default 'pending',p_limit integer default 100)
returns jsonb language plpgsql stable security definer
set search_path=public,auth,pg_temp
as $$
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required' using errcode='42501'; end if;
  if p_status not in ('pending','needs_information','approved','rejected','cancelled','expired') then raise exception 'invalid_status'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from (
    select c.id,c.reference_code,c.status,c.requested_levels,c.created_at,c.updated_at,
      coalesce(s.name,d.name,r.name) school_name,coalesce(s.county,d.county,r.county) county,
      p.full_name teacher_name,c.school_id,c.directory_school_id,c.discovery_request_id
    from public.teacher_school_claims c join public.profiles p on p.id=c.teacher_id
    left join public.schools s on s.id=c.school_id left join public.schools_directory d on d.id=c.directory_school_id
    left join public.school_discovery_requests r on r.id=c.discovery_request_id
    where c.status=p_status order by c.created_at limit greatest(1,least(coalesce(p_limit,100),200))
  ) x),'[]'::jsonb);
end; $$;

-- Legacy connection functions no longer create authorization rows. Existing clients
-- receive a stable identifier while the canonical journey remains provisional.
create or replace function public.connect_teacher_to_school(p_school_id uuid,p_level text default null)
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v jsonb;
begin
  v:=public.submit_teacher_school_claim(p_school_id,null,null,array[p_level]);
  return (v->>'claim_id')::uuid;
end; $$;
create or replace function public.connect_teacher_to_directory_school(p_directory_id uuid,p_level text default null)
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v jsonb;
begin
  v:=public.submit_teacher_school_claim(null,p_directory_id,null,array[p_level]);
  return (v->>'claim_id')::uuid;
end; $$;

-- A class is optional for platform access. Unverified teachers get a restricted
-- provisional workspace; school-scoped authority still requires school_members.
create or replace function public.get_my_auth_journey_state()
returns jsonb language plpgsql stable security definer
set search_path=public,auth,pg_temp
as $$
declare v_uid uuid:=auth.uid(); p public.profiles%rowtype; v_student_count int:=0; v_student_id uuid; v_has_school boolean:=false; v_has_child boolean:=false; v_has_admin boolean:=false; v_has_claim boolean:=false;
begin
  if v_uid is null then return jsonb_build_object('authenticated',false,'role',null,'account_status',null,'is_anonymized',false,'profile_complete',false,'authority_complete',false,'state','authentication_required','destination','/login','reason_code','AUTHENTICATION_REQUIRED','canonical_identity_id',null); end if;
  select * into p from public.profiles where id=v_uid;
  if p.id is null then return jsonb_build_object('authenticated',true,'role',null,'account_status',null,'is_anonymized',false,'profile_complete',false,'authority_complete',false,'state','profile_missing','destination','/auth/error?reason=profile_missing','reason_code','PROFILE_MISSING','canonical_identity_id',null); end if;
  if p.account_status::text<>'active' or p.is_anonymized then return jsonb_build_object('authenticated',true,'role',null,'account_status',p.account_status::text,'is_anonymized',p.is_anonymized,'profile_complete',p.role is not null,'authority_complete',false,'state','account_unavailable','destination','/auth/error?reason=account_unavailable','reason_code',case when p.is_anonymized then 'ACCOUNT_ANONYMIZED' else 'ACCOUNT_NOT_ACTIVE' end,'canonical_identity_id',null); end if;
  if p.role is null then return jsonb_build_object('authenticated',true,'role',null,'account_status',p.account_status::text,'is_anonymized',false,'profile_complete',false,'authority_complete',false,'state','role_unclaimed','destination','/auth/error?reason=account_unregistered','reason_code','ROLE_UNCLAIMED','canonical_identity_id',null); end if;
  if p.role::text='teacher' then
    select exists(select 1 from public.school_members sm where sm.profile_id=v_uid and sm.role::text='teacher') into v_has_school;
    if not v_has_school then
      select exists(select 1 from public.teacher_school_claims c where c.teacher_id=v_uid and c.status in ('pending','needs_information')) into v_has_claim;
      return jsonb_build_object('authenticated',true,'role','teacher','account_status',p.account_status::text,'is_anonymized',false,'profile_complete',true,'authority_complete',false,
        'state',case when v_has_claim then 'provisional' else 'needs_school' end,
        'destination',case when v_has_claim then '/teacher/provisional' else '/teacher/onboarding/school' end,
        'reason_code',case when v_has_claim then 'TEACHER_SCHOOL_CLAIM_PENDING' else 'TEACHER_SCHOOL_REQUIRED' end,'canonical_identity_id',v_uid);
    end if;
    return jsonb_build_object('authenticated',true,'role','teacher','account_status',p.account_status::text,'is_anonymized',false,'profile_complete',true,'authority_complete',true,'state','ready','destination','/teacher/pulse','reason_code','OK','canonical_identity_id',v_uid);
  end if;
  if p.role::text='student' then
    select count(*),min(s.id) into v_student_count,v_student_id from public.students s where s.profile_id=v_uid and s.deleted_at is null;
    if v_student_count=0 then return jsonb_build_object('authenticated',true,'role','student','account_status',p.account_status::text,'is_anonymized',false,'profile_complete',true,'authority_complete',false,'state','needs_student_identity','destination','/student/claim','reason_code','STUDENT_DOMAIN_MISSING','canonical_identity_id',null); end if;
    if v_student_count>1 then return jsonb_build_object('authenticated',true,'role','student','account_status',p.account_status::text,'is_anonymized',false,'profile_complete',true,'authority_complete',false,'state','identity_conflict','destination','/auth/error?reason=identity_conflict','reason_code','AMBIGUOUS_LEARNER_IDENTITY','canonical_identity_id',null); end if;
    return jsonb_build_object('authenticated',true,'role','student','account_status',p.account_status::text,'is_anonymized',false,'profile_complete',true,'authority_complete',true,'state','ready','destination','/student','reason_code','OK','canonical_identity_id',v_student_id);
  end if;
  if p.role::text='parent' then
    select exists(select 1 from public.parent_student_links psl join public.students s on s.id=psl.student_id and s.deleted_at is null where psl.parent_id=v_uid) into v_has_child;
    if not v_has_child then return jsonb_build_object('authenticated',true,'role','parent','account_status',p.account_status::text,'is_anonymized',false,'profile_complete',true,'authority_complete',true,'state','needs_child','destination','/parent/students','reason_code','PARENT_CHILD_REQUIRED','canonical_identity_id',v_uid); end if;
    return jsonb_build_object('authenticated',true,'role','parent','account_status',p.account_status::text,'is_anonymized',false,'profile_complete',true,'authority_complete',true,'state','ready','destination','/parent','reason_code','OK','canonical_identity_id',v_uid);
  end if;
  if p.role::text='admin' then
    select exists(select 1 from public.school_members sm where sm.profile_id=v_uid and sm.role::text in ('admin','owner')) into v_has_admin;
    if not v_has_admin then return jsonb_build_object('authenticated',true,'role',null,'claimed_role','admin','account_status',p.account_status::text,'is_anonymized',false,'profile_complete',true,'authority_complete',false,'state','authority_incomplete','destination','/auth/error?reason=admin_membership_missing','reason_code','ADMIN_MEMBERSHIP_MISSING','canonical_identity_id',null); end if;
    return jsonb_build_object('authenticated',true,'role','admin','account_status',p.account_status::text,'is_anonymized',false,'profile_complete',true,'authority_complete',true,'state','ready','destination','/admin','reason_code','OK','canonical_identity_id',v_uid);
  end if;
  if p.role::text='global_user' then return jsonb_build_object('authenticated',true,'role','global_user','account_status',p.account_status::text,'is_anonymized',false,'profile_complete',true,'authority_complete',true,'state','ready','destination','/global','reason_code','OK','canonical_identity_id',v_uid); end if;
  return jsonb_build_object('authenticated',true,'role',null,'claimed_role',p.role,'account_status',p.account_status::text,'is_anonymized',false,'profile_complete',true,'authority_complete',false,'state','unknown_role','destination','/auth/error?reason=role_unresolved','reason_code','UNKNOWN_ROLE','canonical_identity_id',null);
end; $$;

revoke all on function public.submit_teacher_school_claim(uuid,uuid,uuid,text[]) from public,anon;
revoke all on function public.get_my_teacher_school_claim() from public,anon;
revoke all on function public.create_provisional_teacher_class(text,text,text) from public,anon;
revoke all on function public.review_teacher_school_claim(uuid,text,text) from public,anon;
revoke all on function public.hq_list_teacher_school_claims(text,integer) from public,anon;
grant execute on function public.submit_teacher_school_claim(uuid,uuid,uuid,text[]) to authenticated,service_role;
grant execute on function public.get_my_teacher_school_claim() to authenticated,service_role;
grant execute on function public.create_provisional_teacher_class(text,text,text) to authenticated,service_role;
grant execute on function public.review_teacher_school_claim(uuid,text,text) to authenticated,service_role;
grant execute on function public.hq_list_teacher_school_claims(text,integer) to authenticated,service_role;

notify pgrst,'reload schema';
commit;
