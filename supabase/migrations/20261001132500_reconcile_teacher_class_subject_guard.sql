begin;
-- Reconcile the UUID overload used by trg_teacher_classes_curriculum_guard with
-- the canonical grade_subject_authority used by onboarding and assignment RPCs.
create or replace function public.is_valid_teaching_subject_for_grade(p_grade text,p_subject_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(
   select 1
   from public.subjects local
   left join public.subjects global on global.id=local.global_subject_id
   join public.grade_subject_authority g
     on g.grade=btrim(p_grade)
    and lower(btrim(g.subject_name))=lower(btrim(coalesce(global.name,local.name)))
    and g.effective_from<=current_date
    and (g.effective_to is null or g.effective_to>=current_date)
   where local.id=p_subject_id
 );
$$;
revoke all on function public.is_valid_teaching_subject_for_grade(text,uuid) from public,anon;
grant execute on function public.is_valid_teaching_subject_for_grade(text,uuid) to authenticated,service_role;
notify pgrst,'reload schema';
commit;