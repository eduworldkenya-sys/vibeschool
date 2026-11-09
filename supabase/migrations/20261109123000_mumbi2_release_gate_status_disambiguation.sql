-- Fix a PL/pgSQL RETURNS TABLE output-variable shadowing regression.
-- The output column "status" is implicit PL/pgSQL variable and must not be used
-- as an unqualified SELECT target in the release-checker's publication lookup.
-- Keep current owner, rights, curriculum, assessment and content checks unchanged.
do $repair$
declare v_def text;
begin
  select pg_get_functiondef('public.ce_run_publication_release_check(uuid)'::regprocedure) into v_def;
  if position('select status into v_publication_status from public.vibe_publications vp' in v_def) = 0 then
    raise exception 'Unexpected release checker definition; refusing blind repair';
  end if;
  v_def:=replace(v_def,
    'select status into v_publication_status from public.vibe_publications vp',
    'select vp.status into v_publication_status from public.vibe_publications vp');
  execute v_def;
end $repair$;
