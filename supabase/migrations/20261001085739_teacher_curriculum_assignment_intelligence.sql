begin;

-- Teaching assignment is curriculum-constrained. Content/library browsing is
-- deliberately untouched: a teacher may discover/read material outside their
-- current teaching assignment.

create or replace function public.is_valid_teaching_subject_for_grade(p_grade text,p_subject_id uuid)
returns boolean language sql stable security invoker set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.subjects local
    left join public.subjects global on global.id=local.global_subject_id
    where local.id=p_subject_id and (
      exists(select 1 from public.curriculum c where c.grade=btrim(p_grade)
        and lower(btrim(c.subject))=lower(btrim(coalesce(global.name,local.name))))
      or exists(select 1 from public.cbc_strands cs join public.subjects root on root.id=cs.subject_id
        where cs.grade=btrim(p_grade)
          and lower(btrim(root.name))=lower(btrim(coalesce(global.name,local.name))))
    )
  );
$$;
revoke all on function public.is_valid_teaching_subject_for_grade(text,uuid) from public,anon;
grant execute on function public.is_valid_teaching_subject_for_grade(text,uuid) to authenticated,service_role;

create or replace function public.get_allowed_teaching_subjects(p_school_id uuid,p_grade text)
returns jsonb language plpgsql stable security definer set search_path=public,auth,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_grade text:=btrim(coalesce(p_grade,''));
begin
 if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if not exists(select 1 from public.school_members sm where sm.profile_id=v_uid and sm.school_id=p_school_id and sm.role::text in ('teacher','admin','owner'))
   then raise exception 'school_membership_required' using errcode='42501'; end if;
 if not exists(select 1 from public.classes c where c.school_id=p_school_id and c.name=v_grade)
    and v_grade <> all(array['PP1','PP2','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12','Form 1','Form 2','Form 3','Form 4'])
   then raise exception 'invalid_class_level_for_school' using errcode='22023'; end if;
 return jsonb_build_object('state','ready','subjects',coalesce((
   select jsonb_agg(x.subject order by x.subject) from (
     select distinct btrim(c.subject) subject from public.curriculum c where c.grade=v_grade and nullif(btrim(c.subject),'') is not null
     union
     select distinct btrim(s.name) from public.cbc_strands cs join public.subjects s on s.id=cs.subject_id
       where cs.grade=v_grade and s.school_id is null and nullif(btrim(s.name),'') is not null
   ) x
 ),'[]'::jsonb));
end $$;
revoke all on function public.get_allowed_teaching_subjects(uuid,text) from public,anon,service_role;
grant execute on function public.get_allowed_teaching_subjects(uuid,text) to authenticated;

create or replace function public.guard_teacher_class_curriculum_assignment()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_grade text;
begin
 select c.name into v_grade from public.classes c where c.id=new.class_id and c.school_id=new.school_id;
 if v_grade is null then raise exception 'invalid_assignment_class' using errcode='22023'; end if;
 if not public.is_valid_teaching_subject_for_grade(v_grade,new.subject_id) then
   raise exception 'invalid_subject_for_level' using errcode='22023';
 end if;
 return new;
end $$;

drop trigger if exists trg_teacher_classes_curriculum_guard on public.teacher_classes;
create trigger trg_teacher_classes_curriculum_guard
before insert or update of school_id,class_id,subject_id on public.teacher_classes
for each row execute function public.guard_teacher_class_curriculum_assignment();

-- Existing historical mismatches are preserved for explicit reconciliation;
-- all new/changed assignments are guarded by the trigger above.

notify pgrst,'reload schema';
commit;
