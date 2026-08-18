-- Restore repository <-> production parity for the adaptive revision planner.
--
-- Production contains this wrapper, but a clean replay of the repository did
-- not recreate it. The canonical student identity migration immediately after
-- this file patches its legacy profile-keyed predicates to students.id.
--
-- Fail closed on unexpected environments: create only when absent. Existing
-- production behavior is left untouched until the canonicalization migration.

do $$
begin
  if to_regprocedure('public.student_generate_adaptive_revision_plan(date,integer)') is null then
    execute $fn$
      create function public.student_generate_adaptive_revision_plan(
        p_start_date date default current_date,
        p_days integer default 7
      )
      returns jsonb
      language plpgsql
      security definer
      set search_path = 'public','pg_temp'
      as $body$
      declare
        v_uid uuid:=auth.uid();
        v_student_id uuid;
        v_context jsonb;
        v_exam_valid boolean:=false;
        v_result jsonb;
        v_safe_count integer:=0;
        v_removed integer:=0;
      begin
        if v_uid is null then raise exception 'not_authenticated'; end if;
        select id into v_student_id
        from public.students
        where profile_id=v_uid and deleted_at is null
        limit 1;
        if v_student_id is null then raise exception 'learner_identity_not_found'; end if;

        v_context:=public.student_get_adaptive_revision_context();
        v_exam_valid:=coalesce((v_context->>'exam_context_valid')::boolean,false);
        v_result:=public.student_generate_adaptive_revision_plan_v1(p_start_date,p_days);

        with removed as (
          delete from public.student_revision_plan_items p
          where p.student_id=v_uid and p.status='planned'
            and p.plan_date between p_start_date and p_start_date+greatest(1,least(coalesce(p_days,7),31))-1
            and p.source->>'generated_by'='student_generate_adaptive_revision_plan'
            and (
              coalesce(p.topic,'') ~* '^TWIN-SEED-'
              or coalesce(p.subject,'') ~* '^TWIN-SEED-'
              or coalesce(p.reason,'') ilike '%SYNTHETIC TWIN TEST%'
              or (not v_exam_valid and p.source->>'lane' in ('spaced_retest','kcse_coverage'))
              or (
                not v_exam_valid
                and p.source->>'lane'='practice_history'
                and exists(
                  select 1
                  from public.student_practice_attempts pa
                  join public.exam_question_bank q on q.id=pa.exam_question_id
                  where pa.student_id in (v_student_id,v_uid)
                    and lower(coalesce(pa.subject,''))=lower(coalesce(p.subject,''))
                    and lower(coalesce(pa.topic,''))=lower(coalesce(p.topic,''))
                    and q.form::text='Form 4'
                )
                and not exists(
                  select 1
                  from public.student_practice_attempts pa
                  left join public.exam_question_bank q on q.id=pa.exam_question_id
                  where pa.student_id in (v_student_id,v_uid)
                    and lower(coalesce(pa.subject,''))=lower(coalesce(p.subject,''))
                    and lower(coalesce(pa.topic,''))=lower(coalesce(p.topic,''))
                    and (q.id is null or q.form::text<>'Form 4')
                )
              )
              or (
                p.source->>'lane'='mistake_recovery'
                and exists(
                  select 1
                  from public.student_mistake_notebook m
                  where m.student_id in (v_student_id,v_uid)
                    and lower(coalesce(m.subject,''))=lower(coalesce(p.subject,''))
                    and lower(coalesce(m.topic,''))=lower(coalesce(p.topic,''))
                    and (
                      coalesce(m.topic,'') ~* '^TWIN-SEED-'
                      or coalesce(m.prompt_snapshot,'') ilike '%SYNTHETIC TWIN TEST%'
                    )
                )
              )
            )
          returning 1
        )
        select count(*) into v_removed from removed;

        select count(*) into v_safe_count
        from public.student_revision_plan_items p
        where p.student_id=v_uid and p.status='planned'
          and p.plan_date between p_start_date and p_start_date+greatest(1,least(coalesce(p_days,7),31))-1
          and p.source->>'generated_by'='student_generate_adaptive_revision_plan';

        return v_result || jsonb_build_object(
          'added_or_refreshed',v_safe_count,
          'unsafe_candidates_removed',v_removed,
          'exam_context_valid',v_exam_valid,
          'stage_and_provenance_guard','p10_v2'
        );
      end;
      $body$;
    $fn$;
  end if;
end $$;

revoke all on function public.student_generate_adaptive_revision_plan(date,integer) from public;
revoke all on function public.student_generate_adaptive_revision_plan(date,integer) from anon;
grant execute on function public.student_generate_adaptive_revision_plan(date,integer) to authenticated;
grant execute on function public.student_generate_adaptive_revision_plan(date,integer) to service_role;
