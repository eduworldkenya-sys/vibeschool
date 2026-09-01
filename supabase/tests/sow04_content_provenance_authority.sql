do $$ declare d text; begin
 if to_regclass('public.curriculum_content_lesson_versions') is null then raise exception 'missing lesson versions'; end if;
 if to_regprocedure('public.materialize_curriculum_content_lessons(uuid)') is null then raise exception 'missing materializer'; end if;
 if to_regprocedure('public.materialize_confirmed_curriculum_content_lessons_trigger()') is null then raise exception 'missing confirmed-content materialization trigger'; end if;
 if not exists(select 1 from pg_indexes where schemaname='public' and indexname='uq_scheme_curriculum_lesson_occurrence') then raise exception 'missing occurrence uniqueness'; end if;
 select lower(pg_get_functiondef('public.materialize_curriculum_content_lessons(uuid)'::regprocedure)) into d;
 if position('source_type<>''vibeschool''' in replace(d,' ',''))=0 or position('status<>''confirmed''' in replace(d,' ',''))=0 then raise exception 'materializer does not fail closed'; end if;
 if position('jsonb_array_length(lessons)<>c.periods' in replace(d,' ',''))=0 then raise exception 'period decomposition not enforced'; end if;
 if to_regprocedure('public.scheme_capture_provenance()') is null or to_regprocedure('public.scheme_provenance_immutable()') is null then raise exception 'missing provenance triggers'; end if;
 if to_regprocedure('public.commit_curriculum_scheme(uuid,uuid,uuid,uuid[])') is null then raise exception 'missing Scheme commit authority'; end if;
 select lower(pg_get_functiondef('public.commit_curriculum_scheme(uuid,uuid,uuid,uuid[])'::regprocedure)) into d;
 if position('curriculum_content_lesson_version_id' in d)=0 then raise exception 'Scheme commit does not persist canonical lesson version'; end if;
 if position('scheme_lesson_decomposition_required' in d)=0 then raise exception 'Scheme commit does not fail closed on missing decomposition'; end if;
 if position('order by lv.lesson_number' in d)=0 then raise exception 'Scheme commit does not preserve canonical lesson order'; end if;
end $$;
