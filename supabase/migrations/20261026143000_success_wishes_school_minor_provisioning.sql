-- School-assisted receiver identity provisioning. No public signup, checkout or SMS is activated.
-- The initial pilot is restricted to minors with an active enrollment, a school-attested
-- primary guardian link, and a confirmed guardian phone from Supabase Auth.
-- A school record reference is stored only as a hash, not a raw admission/identity number.
-- access: service-only public.success_wish_receiver_provisioning_audit
-- authorization-test: public.success_wish_receiver_provisioning_audit
create unique index if not exists success_wish_receivers_student_unique
  on public.success_wish_receivers(student_id) where student_id is not null;

create table if not exists public.success_wish_receiver_provisioning_audit (
  receiver_id uuid primary key references public.success_wish_receivers(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  school_id uuid not null references public.schools(id) on delete restrict,
  guardian_link_id uuid not null references public.parent_student_links(id) on delete restrict,
  school_admin_id uuid not null references auth.users(id) on delete restrict,
  school_record_reference_digest text not null check (school_record_reference_digest ~ '^[a-f0-9]{64}$'),
  provisioning_method text not null default 'school_admin_attested_primary_guardian'
    check (provisioning_method = 'school_admin_attested_primary_guardian'),
  attested_at timestamptz not null default now()
);
alter table public.success_wish_receiver_provisioning_audit enable row level security;
revoke all on public.success_wish_receiver_provisioning_audit from public, anon, authenticated;
grant select, insert, update, delete on public.success_wish_receiver_provisioning_audit to service_role;

-- Atomic: concurrent retries can never create distinct inboxes for one canonical student.
-- SECURITY INVOKER + service_role-only EXECUTE. Caller must already verify Auth phone.
create or replace function public.success_wish_school_provision_minor(
  p_school uuid, p_student uuid, p_guardian_link uuid, p_admin uuid,
  p_phone text, p_reference_digest text
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_receiver_id uuid;
  v_name text;
  v_school_name text;
  v_dob date;
  v_link_id uuid;
  v_existing record;
begin
  if p_phone !~ '^[+]254[17][0-9]{8}$'
    or p_reference_digest !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid verified guardian identity inputs' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.school_members m
    join public.profiles pr on pr.id=m.profile_id
    where m.school_id=p_school and m.profile_id=p_admin and m.role='admin'
      and pr.account_status='active' and pr.is_anonymized=false
  ) then
    raise exception 'Authorised school administrator required' using errcode='42501';
  end if;
  select s.name,s.date_of_birth into v_name,v_dob
  from public.students s
  where s.id=p_student and s.deleted_at is null;
  if v_name is null or v_dob is null or v_dob > current_date
    or v_dob <= (current_date - interval '18 years')::date then
    raise exception 'Verified school minor with date of birth required' using errcode='23514';
  end if;
  if not exists(
    select 1 from public.student_classes sc
    join public.classes c on c.id=sc.class_id
    where sc.student_id=p_student and sc.school_id=p_school
      and c.school_id=p_school and sc.is_current=true and sc.left_at is null
  ) then raise exception 'Current enrollment in this school is required' using errcode='23514'; end if;
  select l.id into v_link_id from public.parent_student_links l
  where l.id=p_guardian_link and l.student_id=p_student and l.school_id=p_school
    and l.is_primary=true and l.receives_alerts=true
    and l.relationship in ('mother','father','parent','guardian');
  if v_link_id is null then
    raise exception 'Verified primary guardian linkage required' using errcode='23514';
  end if;
  select s.name into v_school_name from public.schools s
    where s.id=p_school and s.deleted_at is null and s.status='active';
  if v_school_name is null then
    raise exception 'An active school is required' using errcode='23514';
  end if;
  insert into public.success_wish_receivers (
    student_id,display_name,school_label,phone_e164,guardian_phone_e164,
    consent_status,consent_route
  ) values (
    p_student,v_name,v_school_name,p_phone,p_phone,'pending','guardian'
  )
  on conflict (student_id) where student_id is not null do nothing
  returning id into v_receiver_id;

  if v_receiver_id is null then
    select r.id, r.consent_status, r.guardian_phone_e164,
           a.school_id, a.guardian_link_id
    into v_existing
    from public.success_wish_receivers r
    left join public.success_wish_receiver_provisioning_audit a on a.receiver_id=r.id
    where r.student_id=p_student;
    if v_existing.id is null or v_existing.consent_status='revoked'
      or v_existing.guardian_phone_e164 is distinct from p_phone
      or v_existing.school_id is distinct from p_school
      or v_existing.guardian_link_id is distinct from p_guardian_link then
      raise exception 'Existing recipient needs authorised identity review'
        using errcode='23514';
    end if;
    return v_existing.id;
  end if;

  insert into public.success_wish_receiver_provisioning_audit (
    receiver_id,student_id,school_id,guardian_link_id,school_admin_id,
    school_record_reference_digest
  ) values (
    v_receiver_id,p_student,p_school,p_guardian_link,p_admin,p_reference_digest
  );
  return v_receiver_id;
end;
$$;
revoke all on function public.success_wish_school_provision_minor(uuid,uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.success_wish_school_provision_minor(uuid,uuid,uuid,uuid,text,text)
  to service_role;
