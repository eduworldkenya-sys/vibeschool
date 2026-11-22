begin;
create or replace function public.teacher_list_existing_grade_classes(p_school_id uuid,p_grade text)
returns jsonb language plpgsql stable security definer set search_path=public,auth,pg_temp as $$
declare v_uid uuid:=auth.uid();
begin
 if v_uid is null or not exists(select 1 from public.profiles p where p.id=v_uid and p.role::text='teacher' and p.account_status::text='active' and not coalesce(p.is_anonymized,false)) or not exists(select 1 from public.school_members sm where sm.profile_id=v_uid and sm.school_id=p_school_id and sm.role::text='teacher') then
 raise exception 'teacher_school_membership_required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'stream',c.stream) order by c.stream nulls first,c.id) from public.classes c where c.school_id=p_school_id and lower(btrim(c.name))=lower(btrim(p_grade))),'[]'::jsonb);
end $$;
revoke all on function public.teacher_list_existing_grade_classes(uuid,text) from public,anon,service_role;
grant execute on function public.teacher_list_existing_grade_classes(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;