-- Grade 3 Kiswahili: extend the SAME authenticated, invoker-Scheme commit RPC.
-- Only a persisted original VibeSchool sub-strand with exact outcome refs,
-- complete active pedagogy and an authorised teacher can be saved.
-- No source-exact KICD text, seed, teacher impersonation or Scheme row here.
begin;

do $grade3_kiswahili$
declare
  v_definition text;
  v_gate_old text := $old_gate$
  if not found then raise exception 'SCHEME_CURRICULUM_SUBSTRAND_NOT_FOUND'; end if;
$old_gate$;
  v_gate_new text := $new_gate$
  -- SCHEME_GRADE3_KISWAHILI_ORIGINAL_ACTIVE
  if not found then
    select * into v_unit from public.cbc_strands s
    where s.id=p_sub_strand_id
      and s.grade='Grade 3'
      and s.source_ref ~ '^VS-CUR-G03-SW-2026#[a-zA-Z0-9._-]+$'
      and exists (
        select 1 from public.subjects global_subject
        where global_subject.id=s.subject_id
          and global_subject.school_id is null
          and global_subject.name='Kiswahili'
      );
  end if;
  if not found then raise exception 'SCHEME_CURRICULUM_SUBSTRAND_NOT_FOUND'; end if;
$new_gate$;
  v_guard_old text := $old_guard$
  select case when s.school_id is null then s.id else s.global_subject_id end
$old_guard$;
  v_guard_new text := $new_guard$
  -- Never commit an empty Grade 3 Kiswahili shell, even if a stale row
  -- appears active: require inquiry, experiences, resources and assessment.
  if v_unit.grade='Grade 3' and v_unit.source_ref like 'VS-CUR-G03-SW-2026#%' and (
     v_unit.source_ref !~ '^VS-CUR-G03-SW-2026#[a-zA-Z0-9._-]+$'
     or coalesce(cardinality(v_reader_inquiry),0)=0
     or coalesce(cardinality(v_reader_experiences),0)=0
     or btrim(coalesce(v_guide.learning_resources,''))=''
     or btrim(coalesce(v_guide.assessment_methods,''))=''
  ) then raise exception 'SCHEME_CANONICAL_CONTENT_INCOMPLETE'; end if;

  select case when s.school_id is null then s.id else s.global_subject_id end
$new_guard$;
begin
  select pg_get_functiondef('public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])'::regprocedure)
    into v_definition;
  if v_definition is null then raise exception 'CANONICAL_SCHEME_FUNCTION_NOT_FOUND'; end if;
  if position('security definer' in lower(v_definition))>0
    then raise exception 'SCHEME_INVOKER_AUTHORITY_REQUIRED'; end if;
  if position('SCHEME_GRADE9_ENGLISH_READER_ACTIVE' in v_definition)=0
    then raise exception 'GRADE3_KISWAHILI_SCHEME_PREDECESSOR_MISSING'; end if;
  if position('SCHEME_GRADE3_KISWAHILI_ORIGINAL_ACTIVE' in v_definition)>0 then
    if position('Never commit an empty Grade 3 Kiswahili shell' in v_definition)=0
      then raise exception 'GRADE3_KISWAHILI_PARTIAL_SCHEME_PATCH'; end if;
  else
    if position(v_gate_old in v_definition)=0 or position(v_guard_old in v_definition)=0
      then raise exception 'GRADE3_KISWAHILI_SCHEME_AUTHORITY_DRIFT'; end if;
    v_definition:=replace(v_definition,v_gate_old,v_gate_new);
    v_definition:=replace(v_definition,v_guard_old,v_guard_new);
    execute v_definition;
  end if;
end;
$grade3_kiswahili$;

revoke all on function public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])
  from public,anon;
grant execute on function public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])
  to authenticated;

do $verify_grade3_kiswahili$
begin
  if (select p.prosecdef from pg_proc p
        where p.oid='public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])'::regprocedure)
     or has_function_privilege('anon',
        'public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])','EXECUTE')
     or not has_function_privilege('authenticated',
        'public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])','EXECUTE')
  then raise exception 'GRADE3_KISWAHILI_SCHEME_RPC_PRIVILEGE_DRIFT'; end if;
  if position('SCHEME_GRADE3_KISWAHILI_ORIGINAL_ACTIVE' in
     pg_get_functiondef('public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])'::regprocedure))=0
  then raise exception 'GRADE3_KISWAHILI_SCHEME_RPC_NOT_ACTIVATED'; end if;
end;
$verify_grade3_kiswahili$;

commit;
