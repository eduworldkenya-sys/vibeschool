begin;

-- Canonical teacher school context returns JSON, not a relation with an
-- active_school_id column. The prior responsibility readers fail with 42703.
-- Only extract that existing authority result correctly. Keep all identity,
-- membership, administrator, tenant and date checks; CREATE OR REPLACE retains
-- the existing function ACLs. No records, tables, RLS policies or grants change.

create or replace function public.teacher_get_my_school_responsibilities()
returns jsonb language plpgsql stable security definer set search_path=public,auth,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_school uuid; v_result jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  v_school := nullif(public.get_my_teacher_school_context()->>'active_school_id','')::uuid;
  if v_school is null then return jsonb_build_object('school_id',null,'teaching_roles','[]'::jsonb,'appointments','[]'::jsonb,'upcoming_appointments','[]'::jsonb); end if;
  if not public.is_operational_school_member(v_school) then raise exception 'school_membership_required' using errcode='42501'; end if;
  select jsonb_build_object(
    'school_id',v_school,
    'teaching_roles',coalesce((select jsonb_agg(jsonb_build_object('class_id',c.id,'class_name',concat_ws(' ',c.name,c.stream),'subject_name',sub.name,'is_class_teacher',tc.is_class_teacher) order by c.name,sub.name) from public.teacher_classes tc join public.classes c on c.id=tc.class_id and c.school_id=tc.school_id join public.subjects sub on sub.id=tc.subject_id where tc.teacher_id=v_uid and tc.school_id=v_school),'[]'::jsonb),
    'appointments',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'category',r.category,'scope_label',r.scope_label,'sharing_mode',r.sharing_mode,'member_role',m.member_role,'starts_on',m.starts_on,'ends_on',coalesce(m.ends_on,r.ends_on),'colleagues',coalesce((select jsonb_agg(jsonb_build_object('name',p.full_name,'role',cm.member_role) order by cm.member_role,p.full_name) from public.school_responsibility_members cm join public.profiles p on p.id=cm.profile_id where cm.responsibility_id=r.id and cm.ended_at is null and cm.starts_on<=current_date and (cm.ends_on is null or cm.ends_on>=current_date) and cm.profile_id<>v_uid),'[]'::jsonb)) order by r.starts_on desc) from public.school_responsibility_members m join public.school_responsibilities r on r.id=m.responsibility_id join public.profiles p on p.id=m.profile_id where r.school_id=v_school and m.profile_id=v_uid and r.ended_at is null and m.ended_at is null and m.starts_on<=current_date and coalesce(m.ends_on,r.ends_on,'infinity'::date)>=current_date),'[]'::jsonb),
    'upcoming_appointments',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'category',r.category,'scope_label',r.scope_label,'sharing_mode',r.sharing_mode,'member_role',m.member_role,'starts_on',m.starts_on,'ends_on',coalesce(m.ends_on,r.ends_on),'colleagues',coalesce((select jsonb_agg(jsonb_build_object('name',p.full_name,'role',cm.member_role) order by cm.member_role,p.full_name) from public.school_responsibility_members cm join public.profiles p on p.id=cm.profile_id where cm.responsibility_id=r.id and cm.ended_at is null and cm.starts_on=m.starts_on and coalesce(cm.ends_on,r.ends_on,'infinity'::date)>=cm.starts_on and cm.profile_id<>v_uid),'[]'::jsonb)) order by m.starts_on,r.title) from public.school_responsibility_members m join public.school_responsibilities r on r.id=m.responsibility_id join public.profiles p on p.id=m.profile_id where r.school_id=v_school and m.profile_id=v_uid and r.ended_at is null and m.ended_at is null and m.starts_on>current_date and coalesce(m.ends_on,r.ends_on,'infinity'::date)>=m.starts_on),'[]'::jsonb)
  ) into v_result;
  return v_result;
end; $$;

create or replace function public.teacher_get_school_responsibility_admin_context()
returns jsonb language plpgsql stable security definer set search_path=public,auth,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_school uuid; v_result jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  v_school := nullif(public.get_my_teacher_school_context()->>'active_school_id','')::uuid;
  if v_school is null then return jsonb_build_object('school_id',null,'teachers','[]'::jsonb); end if;
  if not public.is_school_admin(v_school) then raise exception 'school_admin_required' using errcode='42501'; end if;
  select jsonb_build_object(
    'school_id',v_school,
    'teachers',coalesce((
      select jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(nullif(btrim(p.full_name),''),'Teacher')) order by p.full_name,p.id)
      from public.school_members sm join public.profiles p on p.id=sm.profile_id
      where sm.school_id=v_school and sm.role::text='teacher' and coalesce(sm.status::text,'active')='active'
        and p.role::text='teacher' and p.account_status::text='active' and not coalesce(p.is_anonymized,false)
    ),'[]'::jsonb),
    'responsibilities',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'title',r.title,'category',r.category,'scope_label',r.scope_label,
        'sharing_mode',r.sharing_mode,'starts_on',r.starts_on,'ends_on',r.ends_on,
        'members',coalesce((
          select jsonb_agg(jsonb_build_object('id',m.profile_id,'name',coalesce(nullif(btrim(p.full_name),''),'Teacher'),'role',m.member_role) order by m.member_role,p.full_name)
          from public.school_responsibility_members m join public.profiles p on p.id=m.profile_id
          where m.responsibility_id=r.id and m.ended_at is null and m.starts_on<=current_date
            and coalesce(m.ends_on,r.ends_on,'infinity'::date)>=current_date
        ),'[]'::jsonb),
        'upcoming_members',coalesce((
          select jsonb_agg(jsonb_build_object('id',m.profile_id,'name',coalesce(nullif(btrim(p.full_name),''),'Teacher'),'role',m.member_role,'starts_on',m.starts_on) order by m.starts_on,m.member_role,p.full_name)
          from public.school_responsibility_members m join public.profiles p on p.id=m.profile_id
          where m.responsibility_id=r.id and m.ended_at is null and m.starts_on>current_date
            and coalesce(m.ends_on,r.ends_on,'infinity'::date)>=m.starts_on
        ),'[]'::jsonb),
        'history',coalesce((
          select jsonb_agg(jsonb_build_object('id',m.profile_id,'name',coalesce(nullif(btrim(p.full_name),''),'Teacher'),'role',m.member_role,'starts_on',m.starts_on,'ends_on',m.ends_on,'end_reason',m.end_reason,'ended_by_name',coalesce(nullif(btrim(ep.full_name),''),'School admin')) order by coalesce(m.ended_at,'-infinity'::timestamptz) desc,m.starts_on desc,m.member_role,p.full_name)
          from public.school_responsibility_members m join public.profiles p on p.id=m.profile_id
          left join public.profiles ep on ep.id=m.end_recorded_by
          where m.responsibility_id=r.id and (m.ended_at is not null or m.ends_on<current_date)
        ),'[]'::jsonb)
      ) order by r.starts_on desc)
      from public.school_responsibilities r
      where r.school_id=v_school and r.ended_at is null and coalesce(r.ends_on,'infinity'::date)>=current_date
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end; $$;

notify pgrst, 'reload schema';
commit;
