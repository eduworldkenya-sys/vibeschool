begin;

-- Production drift guard: classes stores the grade/level in classes.name.
-- commit_curriculum_scheme must never read classes.grade.
do $$
declare d text;
begin
  select pg_get_functiondef('public.commit_curriculum_scheme(uuid,uuid,uuid,uuid[])'::regprocedure) into d;
  if d ~ 'select[[:space:]]+c\.school_id[[:space:]]*,[[:space:]]*c\.grade[[:space:]]+into[[:space:]]+v_school_id' then
    raise exception 'SCHEME_SCHEMA_DRIFT: commit_curriculum_scheme references nonexistent classes.grade';
  end if;
  if d !~ 'c\.name' then
    raise exception 'SCHEME_SCHEMA_DRIFT: commit_curriculum_scheme must derive class grade from classes.name';
  end if;
end
$$;

commit;
