-- Merged grade 6 Mathematics + English support for existing authenticated Scheme RPC.
-- Keep the live, security-invoker implementation; only add canonical Grade 6 Math bindings.
-- Existing Grade 1, Grade 8, and Grade 6 English logic is preserved.
begin;
CREATE OR REPLACE FUNCTION public.commit_mapped_scheme_lesson(p_class_id uuid, p_subject_id uuid, p_academic_term_id uuid, p_week integer, p_sub_strand_id uuid, p_outcome_ids uuid[])
 RETURNS scheme_of_work
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_unit public.cbc_strands%rowtype;
  v_guide public.curriculum_unit_guidance%rowtype;
  v_global_subject uuid;
  v_grade text;
  v_count integer;
  v_distinct integer;
  v_objectives text;
  v_first uuid;
  v_scheme public.scheme_of_work%rowtype;
  v_saved public.scheme_of_work%rowtype;
  v_reader_ref text;
  v_reader_inquiry text[];
  v_reader_experiences text[];
begin
  if (select auth.uid()) is null then raise exception 'SCHEME_AUTH_REQUIRED'; end if;
  if p_outcome_ids is null or cardinality(p_outcome_ids) not between 1 and 12 then
    raise exception 'SCHEME_OUTCOME_SELECTION_REQUIRED';
  end if;
  select count(distinct x) into v_distinct from unnest(p_outcome_ids) as x;
  if v_distinct<>cardinality(p_outcome_ids) then
    raise exception 'SCHEME_DUPLICATE_OUTCOMES';
  end if;

  -- Reuse Creative Activities source refs, or the audited VibeSchool reader
  -- binding for Mathematics/English. Legacy placeholders keep their original
  -- source_ref and identity; no official KICD promotion happens here.
  select * into v_unit from public.cbc_strands s
  where s.id=p_sub_strand_id and (
      (s.grade='Grade 1' and
        (s.source_ref like 'VS-CUR-G01-CA-2026#%'
         or exists (select 1 from public.grade1_curriculum_reader_bindings b
                    where b.sub_strand_id=s.id and b.status='active')))
      or (s.grade='Grade 8' and exists
        (select 1 from public.grade8_mathematics_reader_bindings b
         where b.sub_strand_id=s.id and b.status='active'))
      or (s.grade='Grade 8' and exists
        (select 1 from public.grade8_english_reader_bindings b
         where b.sub_strand_id=s.id and b.status='active'))
      or (s.grade='Grade 6' and exists
        (select 1 from public.grade6_english_reader_bindings b
         where b.sub_strand_id=s.id and b.status='active'))
      or (s.grade='Grade 6' and exists
        (select 1 from public.grade6_mathematics_reader_bindings b
         where b.sub_strand_id=s.id and b.status='active'))
    );
  if not found then raise exception 'SCHEME_CURRICULUM_SUBSTRAND_NOT_FOUND'; end if;

  select b.source_ref,b.key_inquiry_questions,b.suggested_experiences
    into v_reader_ref,v_reader_inquiry,v_reader_experiences
  from public.grade1_curriculum_reader_bindings b
  where b.sub_strand_id=v_unit.id and b.status='active';
  if not found then
    select b.source_ref,b.key_inquiry_questions,b.suggested_experiences
      into v_reader_ref,v_reader_inquiry,v_reader_experiences
    from public.grade8_mathematics_reader_bindings b
    where b.sub_strand_id=v_unit.id and b.status='active';
  end if;
  if v_reader_ref is null then
    select b.source_ref,b.key_inquiry_questions,b.suggested_experiences
      into v_reader_ref,v_reader_inquiry,v_reader_experiences
    from public.grade8_english_reader_bindings b
    where b.sub_strand_id=v_unit.id and b.status='active';
  end if;
  if v_reader_ref is null then
    select b.source_ref,b.key_inquiry_questions,b.suggested_experiences
      into v_reader_ref,v_reader_inquiry,v_reader_experiences
    from public.grade6_english_reader_bindings b
    where b.sub_strand_id=v_unit.id and b.status='active';
  end if;
  if v_reader_ref is null then
    select b.source_ref,b.key_inquiry_questions,b.suggested_experiences
      into v_reader_ref,v_reader_inquiry,v_reader_experiences
    from public.grade6_mathematics_reader_bindings b
    where b.sub_strand_id=v_unit.id and b.status='active';
  end if;
  if v_reader_ref is null then
    v_reader_ref:=v_unit.source_ref;
    v_reader_inquiry:=v_unit.key_inquiry_questions;
    v_reader_experiences:=v_unit.suggested_experiences;
  end if;
  select * into v_guide from public.curriculum_unit_guidance
    where sub_strand_id=v_unit.id and content_status='active';
  if not found then raise exception 'SCHEME_CURRICULUM_NOT_ACTIVE'; end if;

  select case when s.school_id is null then s.id else s.global_subject_id end
    into v_global_subject
  from public.subjects s where s.id=p_subject_id;
  select c.name into v_grade from public.classes c where c.id=p_class_id;
  if v_global_subject is distinct from v_unit.subject_id
    or lower(btrim(coalesce(v_grade,'')))<>lower(v_unit.grade)
  then raise exception 'SCHEME_CURRICULUM_IDENTITY_MISMATCH'; end if;

  select count(*),string_agg(o.outcome_text,E'\n' order by array_position(p_outcome_ids,o.id))
    into v_count,v_objectives
  from public.curriculum_learning_outcomes o
  where o.id=any(p_outcome_ids) and o.sub_strand_id=v_unit.id
    and o.status='active' and o.source_type='creator_claimed'
    and o.source_ref like v_reader_ref||'/%';
  if v_count<>cardinality(p_outcome_ids) then
    raise exception 'SCHEME_CURRICULUM_OUTCOME_MISMATCH'; end if;

  v_first:=p_outcome_ids[1];
  v_scheme:=public.commit_custom_scheme_item(
    p_class_id,p_subject_id,p_academic_term_id,p_week,v_unit.sub_strand,v_unit.name,null,null
  );
  update public.scheme_of_work set
      sub_strand_id=v_unit.id,
      sub_strand=v_unit.sub_strand,
      objectives=v_objectives,
      curriculum_outcome_id=v_first,
      key_inquiry_question=array_to_string(v_reader_inquiry,'; '),
      learning_experiences=array_to_string(v_reader_experiences,E'\n'),
      learning_resources=v_guide.learning_resources,
      assessment_methods=v_guide.assessment_methods,
      reference=v_reader_ref||case when v_unit.grade in ('Grade 8','Grade 6')
       then ' (KICD 2024 structure; independently authored VibeSchool teaching outcomes)'
       else ' (VibeSchool-authored; KICD reconciliation pending)' end
  where id=v_scheme.id and teacher_id=auth.uid()
  returning * into v_saved;
  if v_saved.id is null then raise exception 'SCHEME_LESSON_LINK_FAILED'; end if;

  insert into public.scheme_lesson_outcomes(scheme_lesson_id,curriculum_outcome_id)
  select v_saved.id,unnest(p_outcome_ids);
  return v_saved;
end;
$function$;
revoke all on function public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[]) from public,anon;
grant execute on function public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[]) to authenticated;
commit;
