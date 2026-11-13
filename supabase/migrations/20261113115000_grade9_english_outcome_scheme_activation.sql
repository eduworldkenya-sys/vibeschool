-- Grade 9 English: extend the EXISTING invoker-Scheme save contract, not a second engine.
-- Existing 75 canonical heading identities must remain intact; no outcomes or Scheme rows seeded.
-- Only active VibeSchool-authored outcomes with exact per-unit provenance, complete
-- inquiry/experience and active teaching guidance are eligible for teacher-authorized save.
begin;

do $grade9_english$
declare
  v_definition text;
  v_gate_old text := $old_gate$
  if not found then raise exception 'SCHEME_CURRICULUM_SUBSTRAND_NOT_FOUND'; end if;
$old_gate$;
  v_gate_new text := $new_gate$
  -- SCHEME_GRADE9_ENGLISH_READER_ACTIVE: only existing exact-heading source identities.
  if not found then
    select * into v_unit from public.cbc_strands s
    where s.id=p_sub_strand_id
      and s.grade='Grade 9'
      and s.source_ref ~ '^VS-REF-G09-EN-2024#([1-9]|1[0-5])[.][1-5][.]1$'
      and exists (
        select 1 from public.subjects global_subject
        where global_subject.id=s.subject_id
          and global_subject.school_id is null
          and global_subject.name='English'
      );
  end if;
  if not found then raise exception 'SCHEME_CURRICULUM_SUBSTRAND_NOT_FOUND'; end if;
$new_gate$;
  v_guide_old text := $old_guide$
  if not found then raise exception 'SCHEME_CURRICULUM_NOT_ACTIVE'; end if;
$old_guide$;
  v_guide_new text := $new_guide$
  if not found then raise exception 'SCHEME_CURRICULUM_NOT_ACTIVE'; end if;
  -- Grade 9 English cannot save a shell heading or missing pedagogical fields.
  if v_unit.grade='Grade 9' and (
     coalesce(cardinality(v_reader_inquiry),0)=0
     or coalesce(cardinality(v_reader_experiences),0)=0
     or btrim(coalesce(v_guide.learning_resources,''))=''
     or btrim(coalesce(v_guide.assessment_methods,''))=''
  ) then
    raise exception 'SCHEME_CANONICAL_CONTENT_INCOMPLETE';
  end if;
$new_guide$;
  v_count integer;
begin
  select count(*) into v_count
  from public.cbc_strands s
  where s.grade='Grade 9'
    and s.source_ref ~ '^VS-REF-G09-EN-2024#([1-9]|1[0-5])[.][1-5][.]1$'
    and exists (
      select 1 from public.subjects global_subject
      where global_subject.id=s.subject_id
        and global_subject.school_id is null
        and global_subject.name='English'
    );
  if v_count<>75 then raise exception 'GRADE9_ENGLISH_EXACT_INDEX_REQUIRED: %',v_count; end if;

  select pg_get_functiondef('public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])'::regprocedure)
    into v_definition;
  if v_definition is null then raise exception 'CANONICAL_SCHEME_FUNCTION_NOT_FOUND'; end if;
  if position('security definer' in lower(v_definition))>0
    then raise exception 'SCHEME_INVOKER_AUTHORITY_REQUIRED'; end if;

  if position('SCHEME_GRADE9_ENGLISH_READER_ACTIVE' in v_definition)>0 then
    -- Idempotent on re-application; never silently approve a partial patch.
    if position('SCHEME_CANONICAL_CONTENT_INCOMPLETE' in v_definition)=0
      then raise exception 'GRADE9_ENGLISH_PARTIAL_SCHEME_PATCH'; end if;
  else
    if position(v_gate_old in v_definition)=0 or position(v_guide_old in v_definition)=0
      then raise exception 'GRADE9_ENGLISH_SCHEME_PATCH_AUTHORITY_DRIFT'; end if;
    v_definition:=replace(v_definition,v_gate_old,v_gate_new);
    v_definition:=replace(v_definition,v_guide_old,v_guide_new);
    execute v_definition;
  end if;
end;
$grade9_english$;

revoke all on function public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])
  from public,anon;
grant execute on function public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])
  to authenticated;

do $verify_grade9_english$
begin
  if (select p.prosecdef from pg_proc p
        where p.oid='public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])'::regprocedure)
     or has_function_privilege('anon',
        'public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])','EXECUTE')
     or not has_function_privilege('authenticated',
        'public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])','EXECUTE')
  then raise exception 'GRADE9_ENGLISH_SCHEME_RPC_PRIVILEGE_DRIFT'; end if;
  if position('SCHEME_GRADE9_ENGLISH_READER_ACTIVE' in
     pg_get_functiondef('public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])'::regprocedure))=0
  then raise exception 'GRADE9_ENGLISH_SCHEME_RPC_NOT_ACTIVATED'; end if;
end;
$verify_grade9_english$;
commit;
