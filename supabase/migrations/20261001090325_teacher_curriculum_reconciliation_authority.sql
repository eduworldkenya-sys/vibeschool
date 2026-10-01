begin;

create or replace function public.teacher_get_operating_context(p_requested_school_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,auth,pg_temp as $$
declare
 v_uid uuid:=auth.uid(); v_school_id uuid; v_school_count integer:=0;
 v_term jsonb:=null; v_schools jsonb:='[]'::jsonb; v_classes jsonb:='[]'::jsonb;
 v_reconciliation_count integer:=0;
begin
 if v_uid is null then raise exception 'not_authenticated'; end if;
 select count(distinct sm.school_id) into v_school_count from public.school_members sm where sm.profile_id=v_uid and sm.role::text='teacher';
 if v_school_count=0 then return jsonb_build_object('teacher_id',v_uid,'school_id',null,'school_count',0,'schools','[]'::jsonb,'classes','[]'::jsonb,'active_term',null,'reconciliation_count',0,'state','needs_school'); end if;
 if p_requested_school_id is not null then
  if not exists(select 1 from public.school_members sm where sm.profile_id=v_uid and sm.school_id=p_requested_school_id and sm.role::text='teacher') then raise exception 'teacher_school_scope_not_authorized'; end if;
  v_school_id:=p_requested_school_id;
 else
  select pref.school_id into v_school_id from public.teacher_active_school_preferences pref join public.school_members sm on sm.profile_id=v_uid and sm.school_id=pref.school_id and sm.role::text='teacher' where pref.teacher_id=v_uid;
  if v_school_id is null then select sm.school_id into v_school_id from public.school_members sm left join public.teacher_classes tc on tc.teacher_id=v_uid and tc.school_id=sm.school_id where sm.profile_id=v_uid and sm.role::text='teacher' group by sm.school_id order by count(tc.id) desc,sm.school_id limit 1; end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'assignment_count',coalesce(x.assignment_count,0),'active',s.id=v_school_id) order by (s.id=v_school_id) desc,s.name,s.id),'[]'::jsonb) into v_schools
 from public.school_members sm join public.schools s on s.id=sm.school_id left join lateral(select count(*)::integer assignment_count from public.teacher_classes tc where tc.teacher_id=v_uid and tc.school_id=sm.school_id)x on true where sm.profile_id=v_uid and sm.role::text='teacher';
 select coalesce(jsonb_agg(jsonb_build_object('assignment_id',tc.id,'class_id',tc.class_id,'class_name',c.name,'stream',c.stream,'subject_id',tc.subject_id,'subject_name',subj.name,'is_class_teacher',tc.is_class_teacher,'curriculum_valid',public.is_valid_teaching_subject_for_grade(c.name,tc.subject_id),'curriculum_state',case when public.is_valid_teaching_subject_for_grade(c.name,tc.subject_id) then 'valid' else 'needs_reconciliation' end) order by c.name,c.stream nulls first,subj.name,tc.id),'[]'::jsonb),
 count(*) filter(where not public.is_valid_teaching_subject_for_grade(c.name,tc.subject_id))::integer into v_classes,v_reconciliation_count
 from public.teacher_classes tc join public.classes c on c.id=tc.class_id and c.school_id=tc.school_id join public.subjects subj on subj.id=tc.subject_id and subj.school_id=tc.school_id where tc.teacher_id=v_uid and tc.school_id=v_school_id;
 select jsonb_build_object('id',t.id,'name',t.name,'term',t.term,'academic_year',t.academic_year,'start_date',t.start_date,'end_date',t.end_date,'status',t.status) into v_term from public.academic_terms t where t.school_id=v_school_id and t.status='active' order by t.start_date desc,t.id limit 1;
 return jsonb_build_object('teacher_id',v_uid,'school_id',v_school_id,'school_count',v_school_count,'schools',v_schools,'classes',v_classes,'active_term',v_term,'reconciliation_count',v_reconciliation_count,'state',case when jsonb_array_length(v_classes)=0 then 'needs_class' when v_reconciliation_count>0 then 'needs_curriculum_reconciliation' else 'ready' end);
end $$;
revoke all on function public.teacher_get_operating_context(uuid) from public,anon;
grant execute on function public.teacher_get_operating_context(uuid) to authenticated,service_role;

create or replace function public.teacher_reconcile_class_subject(p_assignment_id uuid,p_subject text)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_tc public.teacher_classes%rowtype; v_grade text; v_global uuid; v_name text; v_local uuid;
begin
 if v_uid is null then raise exception 'not_authenticated'; end if;
 select tc.* into v_tc from public.teacher_classes tc join public.school_members sm on sm.school_id=tc.school_id and sm.profile_id=v_uid and sm.role::text='teacher' where tc.id=p_assignment_id and tc.teacher_id=v_uid;
 if v_tc.id is null then raise exception 'teacher_assignment_not_authorized' using errcode='42501'; end if;
 select c.name into v_grade from public.classes c where c.id=v_tc.class_id and c.school_id=v_tc.school_id;
 select s.id,s.name into v_global,v_name from public.subjects s where s.school_id is null and lower(btrim(s.name))=lower(btrim(p_subject)) limit 1;
 if v_global is null or not (exists(select 1 from public.curriculum c where c.grade=v_grade and lower(btrim(c.subject))=lower(btrim(v_name))) or exists(select 1 from public.cbc_strands cs where cs.grade=v_grade and cs.subject_id=v_global)) then raise exception 'invalid_subject_for_level' using errcode='22023'; end if;
 select s.id into v_local from public.subjects s where s.school_id=v_tc.school_id and s.global_subject_id=v_global limit 1;
 if v_local is null then insert into public.subjects(school_id,name,global_subject_id) values(v_tc.school_id,v_name,v_global) returning id into v_local; end if;
 if exists(select 1 from public.teacher_classes tc where tc.teacher_id=v_uid and tc.class_id=v_tc.class_id and tc.subject_id=v_local and tc.id<>v_tc.id) then raise exception 'assignment_already_exists' using errcode='23505'; end if;
 update public.teacher_classes set subject_id=v_local where id=v_tc.id;
 return jsonb_build_object('assignment_id',v_tc.id,'class_id',v_tc.class_id,'grade',v_grade,'subject_id',v_local,'subject_name',v_name,'curriculum_state','valid');
end $$;
revoke all on function public.teacher_reconcile_class_subject(uuid,text) from public,anon,service_role;
grant execute on function public.teacher_reconcile_class_subject(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
