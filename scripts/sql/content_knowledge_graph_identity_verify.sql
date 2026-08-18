\set ON_ERROR_STOP on

begin;

do $$
declare
  v_fn text;
begin
  select pg_get_functiondef('public.student_get_learning_product_recommendations(integer)'::regprocedure)
  into v_fn;

  if v_fn not like '%count(*)%'
     or v_fn not like '%v_student_count <> 1%'
     or v_fn not like '%ambiguous_learner_identity%'
     or v_fn not like '%learner_identity_not_found%' then
    raise exception 'knowledge graph identity contract: learner recommendation does not fail closed on zero/multiple learner rows';
  end if;
end $$;

rollback;

\echo 'Content Knowledge Graph Learner Identity Contract: PASS'
