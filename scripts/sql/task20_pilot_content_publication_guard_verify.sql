\set ON_ERROR_STOP on

begin;

-- The validator and guarded publication gateway must exist.
do $$
begin
  if to_regprocedure('public.content_validate_textbook_publication(uuid)') is null then
    raise exception 'missing content_validate_textbook_publication(uuid)';
  end if;
  if to_regprocedure('public.publish_textbook(uuid)') is null then
    raise exception 'missing publish_textbook(uuid)';
  end if;
end;
$$;

-- Browser discovery may inspect its own readiness, but anonymous callers must not.
do $$
begin
  if has_function_privilege('anon', 'public.content_validate_textbook_publication(uuid)', 'EXECUTE') then
    raise exception 'anon must not execute publication validator';
  end if;
  if not has_function_privilege('authenticated', 'public.content_validate_textbook_publication(uuid)', 'EXECUTE') then
    raise exception 'authenticated author/editor lane must be able to inspect readiness';
  end if;
  if has_function_privilege('anon', 'public.publish_textbook(uuid)', 'EXECUTE') then
    raise exception 'anon must not execute publication gateway';
  end if;
end;
$$;

-- Security-definer functions must pin search_path and publication must call validation first.
do $$
declare
  v_validator_def text := pg_get_functiondef('public.content_validate_textbook_publication(uuid)'::regprocedure);
  v_publish_def text := pg_get_functiondef('public.publish_textbook(uuid)'::regprocedure);
  v_validate_pos integer;
  v_publish_update_pos integer;
begin
  if position('SET search_path TO ''public'', ''pg_temp''' in v_validator_def) = 0 then
    raise exception 'validator search_path is not pinned';
  end if;
  if position('SET search_path TO ''public'', ''pg_temp''' in v_publish_def) = 0 then
    raise exception 'publication gateway search_path is not pinned';
  end if;

  v_validate_pos := position('content_validate_textbook_publication' in v_publish_def);
  v_publish_update_pos := position('UPDATE public.vibe_publications' in v_publish_def);
  if v_validate_pos = 0 or v_publish_update_pos = 0 or v_validate_pos >= v_publish_update_pos then
    raise exception 'publication validation must happen before publication state mutation';
  end if;

  if position('chapter_readiness_failed' in v_validator_def) = 0
     or position('subject_not_canonical' in v_validator_def) = 0
     or position('missing_level' in v_validator_def) = 0
     or position('missing_subject' in v_validator_def) = 0 then
    raise exception 'validator is missing required Task 20 fail-closed checks';
  end if;
end;
$$;

-- Missing publication must fail readiness without mutating anything.
do $$
declare
  v_result jsonb;
begin
  v_result := public.content_validate_textbook_publication('00000000-0000-0000-0000-000000000000'::uuid);
  if coalesce((v_result ->> 'ok')::boolean, true) then
    raise exception 'missing publication unexpectedly validated';
  end if;
  if not (v_result -> 'issues') ? 'publication_not_found' then
    raise exception 'missing-publication reason not preserved';
  end if;
end;
$$;

rollback;
