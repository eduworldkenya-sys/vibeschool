do $$
declare
  v_ok boolean;
  v_def text;
  v_routine regprocedure;
begin
  if to_regprocedure('public.scheme_lesson_title_is_instructional(text)') is null then
    raise exception 'missing lesson title quality predicate';
  end if;

  select public.scheme_lesson_title_is_instructional('Locate and investigate') into v_ok;
  if v_ok then
    raise exception 'activity-only title was accepted';
  end if;

  select public.scheme_lesson_title_is_instructional('Demonstrate mastery') into v_ok;
  if v_ok then
    raise exception 'generic mastery title was accepted';
  end if;

  select public.scheme_lesson_title_is_instructional('Investigating Traditional Government in Buganda') into v_ok;
  if not v_ok then
    raise exception 'content-bearing lesson title was rejected';
  end if;

  select public.scheme_lesson_title_is_instructional('Comparison of Traditional Governance Systems') into v_ok;
  if not v_ok then
    raise exception 'content-bearing comparison title was rejected';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'curriculum_content_lesson_versions'
      and t.tgname = 'trg_curriculum_content_lesson_title_quality'
      and not t.tgisinternal
  ) then
    raise exception 'missing canonical lesson title guard trigger';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'scheme_of_work'
      and t.tgname = 'trg_curriculum_scheme_instructional_completeness'
      and not t.tgisinternal
  ) then
    raise exception 'missing curriculum Scheme completeness guard trigger';
  end if;

  select lower(pg_get_functiondef('public.guard_curriculum_scheme_instructional_completeness()'::regprocedure))
    into v_def;

  if position('scheme_curriculum_enrichment_required' in v_def) = 0 then
    raise exception 'Scheme completeness guard does not fail closed';
  end if;

  if position('key_inquiry_question' in v_def) = 0
     or position('learning_experiences' in v_def) = 0
     or position('assessment_methods' in v_def) = 0
     or position('learning_resources' in v_def) = 0
     or position('objectives' in v_def) = 0 then
    raise exception 'Scheme completeness guard is missing required planning fields';
  end if;

  foreach v_routine in array array[
    'public.resolve_academic_term_for_date(uuid,date)'::regprocedure,
    'public.resolve_instructional_week_for_date(uuid,date)'::regprocedure,
    'public.resolve_subject_weekly_allocation(uuid,uuid)'::regprocedure,
    'public.commit_custom_scheme_item(uuid,uuid,uuid,integer,text,text,uuid,text)'::regprocedure
  ] loop
    if has_function_privilege('public', v_routine, 'EXECUTE') then
      raise exception 'PUBLIC still has execute on %', v_routine;
    end if;
    if has_function_privilege('anon', v_routine, 'EXECUTE') then
      raise exception 'anon still has execute on %', v_routine;
    end if;
    if not has_function_privilege('authenticated', v_routine, 'EXECUTE') then
      raise exception 'authenticated lost execute on %', v_routine;
    end if;
  end loop;
end $$;
