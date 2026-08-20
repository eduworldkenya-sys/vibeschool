begin;

alter table public.student_claim_codes
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid;

drop index if exists public.uq_student_claim_codes_active_shared_per_student;
create unique index uq_student_claim_codes_active_shared_per_student
on public.student_claim_codes(student_id)
where role='shared' and claimed=false and revoked_at is null;

create or replace function public.teacher_generate_shared_claim_code(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_student public.students%rowtype;
  v_code text;
  v_expires timestamptz := now() + interval '30 days';
  v_allowed boolean := false;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_student from public.students where id=p_student_id and deleted_at is null;
  if not found then raise exception 'student_not_found'; end if;

  select exists(
    select 1 from public.teacher_classes tc
    join public.student_classes sc on sc.class_id=tc.class_id and sc.school_id=tc.school_id and sc.student_id=p_student_id and sc.is_current=true
    where tc.teacher_id=auth.uid()
  ) or exists(
    select 1 from public.student_classes sc
    join public.school_members sm on sm.school_id=sc.school_id and sm.profile_id=auth.uid()
    where sc.student_id=p_student_id and sc.is_current=true and sm.role::text in ('owner','admin')
  ) into v_allowed;
  if not v_allowed then raise exception 'unauthorized_teacher'; end if;

  update public.student_claim_codes
  set revoked_at=coalesce(revoked_at,now()), revoked_by=coalesce(revoked_by,auth.uid())
  where student_id=p_student_id and role='shared' and claimed=false and revoked_at is null;

  loop
    v_code := upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,8));
    exit when not exists(select 1 from public.student_claim_codes where code=v_code);
  end loop;

  insert into public.student_claim_codes(student_id,code,role,claimed,expires_at)
  values(p_student_id,v_code,'shared',false,v_expires);
  return jsonb_build_object('status','success','student_id',p_student_id,'student_name',v_student.name,'code',v_code,'expires_at',v_expires);
end;
$$;

create or replace function public.lookup_student_claim(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.student_claim_codes%rowtype;
  v_student public.students%rowtype;
  v_class public.classes%rowtype;
  v_guardian_linked boolean := false;
begin
  select * into v_row from public.student_claim_codes
  where code=upper(trim(p_code)) and role='shared' and revoked_at is null
  limit 1;
  if not found then
    if exists(select 1 from public.student_claim_codes where code=upper(trim(p_code)) and revoked_at is not null) then return jsonb_build_object('status','replaced'); end if;
    return jsonb_build_object('status','not_found');
  end if;
  if v_row.expires_at is not null and v_row.expires_at < now() then return jsonb_build_object('status','expired'); end if;

  select * into v_student from public.students where id=v_row.student_id and deleted_at is null;
  if not found then return jsonb_build_object('status','student_not_found'); end if;
  select c.* into v_class from public.student_classes sc
  join public.classes c on c.id=sc.class_id and c.school_id=sc.school_id
  where sc.student_id=v_student.id and sc.is_current=true
  order by sc.joined_at desc,sc.id desc limit 1;
  if not found then return jsonb_build_object('status','class_not_found'); end if;
  if v_student.class_id is distinct from v_class.id then return jsonb_build_object('status','enrollment_conflict'); end if;

  select exists(select 1 from public.parent_student_links psl where psl.student_id=v_student.id and psl.school_id=v_class.school_id and coalesce(psl.access_level::text,'') <> 'none') into v_guardian_linked;
  return jsonb_build_object('status',case when v_row.student_claimed_at is not null or v_student.profile_id is not null then 'already_claimed' else 'ready' end,'student_id',v_student.id,'student_name',v_student.name,'admission_number',v_student.admission_number,'class_id',v_class.id,'class_name',v_class.name,'stream',v_class.stream,'school_id',v_class.school_id,'guardian_linked',v_guardian_linked,'parent_claimed',v_row.parent_claimed_at is not null,'student_claimed',v_row.student_claimed_at is not null,'expires_at',v_row.expires_at);
end;
$$;

create or replace function public.finalize_student_provisioning(p_code text,p_user_id uuid,p_full_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.student_claim_codes%rowtype;
  v_student public.students%rowtype;
  v_class_id uuid;
  v_school_id uuid;
  v_parent_linked boolean;
  v_profile_role text;
begin
  if current_user not in ('postgres','service_role') then raise exception 'service_role_required'; end if;
  if p_user_id is null then raise exception 'user_id_required'; end if;
  select * into v_row from public.student_claim_codes where code=upper(trim(p_code)) and role='shared' and revoked_at is null limit 1 for update;
  if not found then return jsonb_build_object('status',case when exists(select 1 from public.student_claim_codes where code=upper(trim(p_code)) and revoked_at is not null) then 'replaced' else 'not_found' end); end if;
  select * into v_student from public.students where id=v_row.student_id limit 1 for update;
  if not found or v_student.deleted_at is not null then return jsonb_build_object('status','student_not_found'); end if;
  if v_student.profile_id=p_user_id and v_row.student_claimed_at is not null then return jsonb_build_object('status','success','student_id',v_student.id,'replayed',true); end if;
  if v_row.student_claimed_at is not null or v_student.profile_id is not null then return jsonb_build_object('status','already_claimed'); end if;
  if v_row.expires_at is not null and v_row.expires_at<now() then return jsonb_build_object('status','expired'); end if;
  select sc.class_id,sc.school_id into v_class_id,v_school_id from public.student_classes sc where sc.student_id=v_student.id and sc.is_current=true order by sc.joined_at desc,sc.id desc limit 1;
  if v_school_id is null then return jsonb_build_object('status','school_not_found'); end if;
  if v_student.class_id is distinct from v_class_id then return jsonb_build_object('status','enrollment_conflict'); end if;
  v_parent_linked := exists(select 1 from public.parent_student_links psl where psl.student_id=v_student.id and psl.school_id=v_school_id and coalesce(psl.access_level::text,'') <> 'none');
  if not v_parent_linked then return jsonb_build_object('status','guardian_required'); end if;
  select p.role::text into v_profile_role from public.profiles p where p.id=p_user_id for update;
  if not found then return jsonb_build_object('status','profile_missing'); end if;
  if v_profile_role is not null and v_profile_role<>'student' then return jsonb_build_object('status','profile_role_conflict'); end if;
  update public.students set profile_id=p_user_id where id=v_student.id and profile_id is null;
  if not found then return jsonb_build_object('status','already_claimed'); end if;
  update public.profiles set role='student',school_id=v_school_id,full_name=v_student.name,updated_at=now() where id=p_user_id;
  insert into public.school_members(school_id,profile_id,role) values(v_school_id,p_user_id,'student') on conflict(school_id,profile_id) do update set role=excluded.role;
  update public.student_claim_codes set student_claimed_at=coalesce(student_claimed_at,now()),student_claimed_by=coalesce(student_claimed_by,p_user_id),claimed=true,claimed_at=coalesce(claimed_at,now()),claimed_by=coalesce(claimed_by,p_user_id) where id=v_row.id and student_claimed_at is null;
  return jsonb_build_object('status','success','student_id',v_student.id,'student_name',v_student.name,'replayed',false);
end;
$$;

-- Parent redemption shares the same credential lifecycle. A parent claim must not
-- consume the learner's later activation opportunity and revoked codes must fail closed.
create or replace function public.redeem_parent_claim(p_code text,p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_code_row public.student_claim_codes%rowtype;
  v_student public.students%rowtype;
  v_school_id uuid;
  v_existing_link_id uuid;
  v_role text;
  v_status text;
  v_anonymized boolean;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'unauthorized_identity' using errcode='42501'; end if;
  select p.role::text,p.account_status::text,coalesce(p.is_anonymized,false) into v_role,v_status,v_anonymized from public.profiles p where p.id=p_user_id for update;
  if not found or v_role is distinct from 'parent' or v_status is distinct from 'active' or v_anonymized then raise exception 'parent_authority_required' using errcode='42501'; end if;

  select * into v_code_row from public.student_claim_codes where code=upper(trim(p_code)) and role in ('parent','shared') and revoked_at is null limit 1 for update;
  if not found then
    if exists(select 1 from public.student_claim_codes where code=upper(trim(p_code)) and revoked_at is not null) then return 'replaced'; end if;
    return 'not_found';
  end if;
  if v_code_row.parent_claimed_at is not null then return 'already_claimed'; end if;
  if v_code_row.expires_at is not null and v_code_row.expires_at<now() then return 'expired'; end if;
  select * into v_student from public.students where id=v_code_row.student_id for update;
  if not found or v_student.deleted_at is not null then return 'student_not_found'; end if;
  select sc.school_id into v_school_id from public.student_classes sc where sc.student_id=v_student.id and sc.is_current=true order by sc.joined_at desc,sc.id desc limit 1;
  if v_school_id is null then return 'school_not_found'; end if;

  select psl.id into v_existing_link_id from public.parent_student_links psl where psl.parent_id=p_user_id and psl.student_id=v_student.id order by psl.created_at desc limit 1 for update;
  if v_existing_link_id is not null then
    update public.parent_student_links set school_id=v_school_id,access_level='full',receives_alerts=true,updated_at=now() where id=v_existing_link_id;
  else
    insert into public.parent_student_links(parent_id,student_id,school_id,relationship,is_primary,can_pickup,receives_alerts,access_level) values(p_user_id,v_student.id,v_school_id,'parent',false,false,true,'full');
  end if;
  insert into public.school_members(school_id,profile_id,role,joined_at) values(v_school_id,p_user_id,'parent',now()) on conflict(school_id,profile_id) do nothing;
  update public.profiles set school_id=coalesce(school_id,v_school_id),updated_at=now() where id=p_user_id;
  update public.student_claim_codes set parent_claimed_at=now(),parent_claimed_by=p_user_id,claimed_by=coalesce(claimed_by,p_user_id),claimed_at=coalesce(claimed_at,now()) where id=v_code_row.id;
  return case when v_existing_link_id is null then 'success' else 'already_linked' end;
end;
$$;

revoke all on function public.lookup_student_claim(text) from public, anon, authenticated;
grant execute on function public.lookup_student_claim(text) to service_role;
revoke all on function public.teacher_generate_shared_claim_code(uuid) from public, anon;
grant execute on function public.teacher_generate_shared_claim_code(uuid) to authenticated, service_role;
revoke all on function public.finalize_student_provisioning(text,uuid,text) from public, anon, authenticated;
grant execute on function public.finalize_student_provisioning(text,uuid,text) to service_role;
revoke all on function public.redeem_parent_claim(text,uuid) from public, anon, service_role;
grant execute on function public.redeem_parent_claim(text,uuid) to authenticated;

commit;
