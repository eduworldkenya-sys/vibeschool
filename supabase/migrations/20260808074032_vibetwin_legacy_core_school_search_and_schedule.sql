-- Adds deterministic school-record search plus today/tomorrow timetable routing.
-- Final search implementation is corrected in 20260808074116_vibetwin_legacy_core_school_search_runtime_fix.sql.

create or replace function public.student_twin_search_school_records(p_query text default null, p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path=public, pg_temp as $$
declare
  v_uid uuid:=auth.uid(); v_query text:=lower(btrim(coalesce(p_query,''))); v_limit integer:=greatest(1,least(coalesce(p_limit,20),50));
  v_school jsonb; v_tasks jsonb; v_sources jsonb; v_memory jsonb; v_results jsonb:='[]'::jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  v_school:=public.student_get_twin_school_context();
  v_tasks:=public.student_list_my_tasks();
  v_sources:=public.student_list_learning_transform_sources(50);
  v_memory:=public.student_get_learning_companion_snapshot();
  -- Production runtime fix for the aggregate query follows in the next migration.
  return jsonb_build_object('query',v_query,'items',v_results,'authoritative_mastery',false);
end; $$;

-- The production router in this ledger version added schedule/tomorrow routing and
-- combined private + school-record search. Its final current definition is already
-- replayed by 20260808073626 plus the runtime-safe search function below, so this
-- migration preserves ledger parity without duplicating the large router body.

revoke all on function public.student_twin_search_school_records(text,integer) from public, anon;
grant execute on function public.student_twin_search_school_records(text,integer) to authenticated;
