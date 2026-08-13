create or replace function public.get_my_onboarding_state()
returns jsonb language plpgsql security invoker set search_path=public as $$
declare p public.profiles%rowtype; school_count integer:=0; class_count integer:=0; child_count integer:=0;
begin
 select * into p from public.profiles where id=auth.uid();
 if p.id is null then return jsonb_build_object('state','profile_missing','next_action','complete_profile'); end if;
 if p.role='student' then return jsonb_build_object('state','ready','next_action','none','destination','/student'); end if;
 if p.role='admin' then return jsonb_build_object('state','ready','next_action','none','destination','/admin'); end if;
 if p.role='global_user' then return jsonb_build_object('state','ready','next_action','none','destination','/global'); end if;
 if p.role='teacher' then
   select count(*) into school_count from public.school_members sm where sm.profile_id=p.id;
   select count(*) into class_count from public.teacher_classes tc where tc.teacher_id=p.id and coalesce(tc.is_active,true);
   if school_count=0 then return jsonb_build_object('state','needs_school','next_action','find_school','destination','/teacher/onboarding/school'); end if;
   if class_count=0 then return jsonb_build_object('state','needs_class','next_action','choose_class','destination','/teacher/onboarding/class'); end if;
   return jsonb_build_object('state','ready','next_action','none','destination','/teacher/pulse');
 end if;
 if p.role='parent' then
   select count(*) into child_count from public.parent_student_links psl where psl.parent_id=p.id;
   if child_count=0 then return jsonb_build_object('state','needs_child','next_action','connect_child','destination','/parent/students'); end if;
   return jsonb_build_object('state','ready','next_action','none','destination','/parent');
 end if;
 return jsonb_build_object('state','unknown_role','next_action','contact_support');
end; $$;
revoke all on function public.get_my_onboarding_state() from public,anon;
grant execute on function public.get_my_onboarding_state() to authenticated;