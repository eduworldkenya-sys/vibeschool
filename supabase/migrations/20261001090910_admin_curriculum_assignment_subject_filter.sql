begin;
create or replace function public.admin_get_allowed_assignment_subjects(p_school_id uuid,p_class_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,auth,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_grade text;
begin
 if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if not exists(select 1 from public.school_members sm where sm.profile_id=v_uid and sm.school_id=p_school_id and sm.role::text in ('admin','owner')) then raise exception 'school_admin_required' using errcode='42501'; end if;
 select c.name into v_grade from public.classes c where c.id=p_class_id and c.school_id=p_school_id;
 if v_grade is null then raise exception 'invalid_assignment_class' using errcode='22023'; end if;
 return jsonb_build_object('grade',v_grade,'subjects',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) order by s.name) from public.subjects s where s.school_id=p_school_id and public.is_valid_teaching_subject_for_grade(v_grade,s.id)),'[]'::jsonb));
end $$;
revoke all on function public.admin_get_allowed_assignment_subjects(uuid,uuid) from public,anon,service_role;
grant execute on function public.admin_get_allowed_assignment_subjects(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;