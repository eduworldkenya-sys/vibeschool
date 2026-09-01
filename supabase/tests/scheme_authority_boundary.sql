-- SOW-02/SOW-03/SOW-06/SOW-08/SOW-09 authority contract.
-- Read-only structural assertions against a reconstructed schema.

do $$
declare
  d text;
begin
  if to_regprocedure('public.commit_curriculum_scheme(uuid,uuid,uuid,uuid[])') is null then
    raise exception 'missing commit_curriculum_scheme';
  end if;
  select lower(pg_get_functiondef('public.commit_curriculum_scheme(uuid,uuid,uuid,uuid[])'::regprocedure)) into d;
  if position('pg_advisory_xact_lock' in d)=0 then raise exception 'curriculum commit lacks transactional sequence lock'; end if;
  if position('curriculum_content' in d)=0 or position('status=''confirmed''' in replace(d,' ',''))=0 then raise exception 'curriculum commit lacks confirmed canonical content gate'; end if;
  if position('scheme_canonical_content_incomplete' in d)=0 then raise exception 'curriculum commit lacks completeness rejection'; end if;
  if position('global_subject_id' in d)=0 then raise exception 'curriculum commit lacks canonical subject identity'; end if;
  if position('c.grade=v_grade' in replace(d,' ',''))=0 then raise exception 'curriculum commit does not validate canonical grade'; end if;

  if to_regprocedure('public.resolve_academic_term_for_date(uuid,date)') is null then raise exception 'missing date-to-term resolver'; end if;
  select lower(pg_get_functiondef('public.resolve_academic_term_for_date(uuid,date)'::regprocedure)) into d;
  if position('between at.start_date and at.end_date' in d)=0 then raise exception 'term resolver is not date authoritative'; end if;
  if position('overlapping_terms' in d)=0 then raise exception 'term resolver does not fail on overlap'; end if;

  if to_regprocedure('public.resolve_instructional_week_for_date(uuid,date)') is null then raise exception 'missing instructional-week resolver'; end if;
  select lower(pg_get_functiondef('public.resolve_instructional_week_for_date(uuid,date)'::regprocedure)) into d;
  if position('term_weeks' in d)=0 then raise exception 'instructional-week resolver does not use term_weeks'; end if;
  if position('overlapping_instructional_weeks' in d)=0 then raise exception 'instructional-week resolver does not fail on overlap'; end if;

  if to_regprocedure('public.resolve_subject_weekly_allocation(uuid,uuid)') is null then raise exception 'missing canonical allocation resolver'; end if;
  select lower(pg_get_functiondef('public.resolve_subject_weekly_allocation(uuid,uuid)'::regprocedure)) into d;
  if position('global_subject_id' in d)=0 then raise exception 'weekly allocation remains label-authoritative'; end if;

  if to_regprocedure('public.commit_custom_scheme_item(uuid,uuid,uuid,integer,text,text,uuid,text)') is null then raise exception 'missing custom Scheme commit RPC'; end if;
  select lower(pg_get_functiondef('public.commit_custom_scheme_item(uuid,uuid,uuid,integer,text,text,uuid,text)'::regprocedure)) into d;
  if position('pg_advisory_xact_lock' in d)=0 then raise exception 'custom commit lacks transactional sequence lock'; end if;
  if position('scheme_lesson_resource_links' in d)=0 then raise exception 'custom commit does not attach resource in same transaction'; end if;
  if position('term_weeks' in d)=0 then raise exception 'custom commit accepts non-calendar weeks'; end if;

  if has_function_privilege('authenticated','public.generate_scheme_from_curriculum(uuid,uuid,uuid,boolean)','EXECUTE') then
    raise exception 'legacy partial generator still executable by authenticated';
  end if;
  if has_function_privilege('authenticated','public.ensure_scheme_from_curriculum(uuid,uuid,uuid)','EXECUTE') then
    raise exception 'legacy auto-repair generator still executable by authenticated';
  end if;
end $$;

do $$
begin
  if not exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='subject_weekly_allocations' and column_name='global_subject_id'
  ) then raise exception 'subject_weekly_allocations lacks canonical subject id'; end if;

  if to_regprocedure('public.list_scheme_lesson_resources_batch(uuid[])') is null then
    raise exception 'missing batch Scheme resource RPC';
  end if;
end $$;
