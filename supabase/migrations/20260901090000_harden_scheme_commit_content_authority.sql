begin;

-- SOW-02/SOW-06: curriculum-backed Scheme commits are authoritative only when
-- confirmed VibeSchool curriculum_content exists and every required planning
-- field is present. Sequence allocation is serialized server-side.
create or replace function public.commit_curriculum_scheme(
  p_class_id uuid,
  p_subject_id uuid,
  p_academic_term_id uuid,
  p_curriculum_ids uuid[]
)
returns setof public.scheme_of_work
language plpgsql
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_school_id uuid;
  v_grade text;
  v_term integer;
  v_global_subject_id uuid;
  v_next_sequence integer;
  v_curriculum_id uuid;
  v_curr public.curriculum%rowtype;
  v_content public.curriculum_content%rowtype;
  v_ctx jsonb;
  v_outcomes text;
  v_kiq text;
  v_experiences text;
  v_resources text;
  v_assessment text;
  v_inserted public.scheme_of_work%rowtype;
begin
  if v_uid is null then raise exception 'SCHEME_AUTH_REQUIRED'; end if;
  if p_curriculum_ids is null or cardinality(p_curriculum_ids)=0 then raise exception 'SCHEME_CURRICULUM_REQUIRED'; end if;
  if cardinality(p_curriculum_ids) <> (select count(distinct x) from unnest(p_curriculum_ids) x) then
    raise exception 'SCHEME_DUPLICATE_CURRICULUM_IDS';
  end if;

  select c.school_id,nullif(btrim(c.name),'') into v_school_id,v_grade
  from public.classes c where c.id=p_class_id;
  if v_school_id is null then raise exception 'SCHEME_CLASS_NOT_FOUND'; end if;
  if v_grade is null then raise exception 'SCHEME_CLASS_GRADE_REQUIRED'; end if;

  if not exists (
    select 1 from public.teacher_classes tc
    where tc.teacher_id=v_uid and tc.school_id=v_school_id
      and tc.class_id=p_class_id and tc.subject_id=p_subject_id
  ) then raise exception 'SCHEME_ASSIGNMENT_REQUIRED'; end if;

  select at.term into v_term
  from public.academic_terms at
  where at.id=p_academic_term_id and at.school_id=v_school_id;
  if v_term is null then raise exception 'SCHEME_TERM_NOT_IN_SCHOOL'; end if;

  select case when s.school_id is null then s.id else s.global_subject_id end
  into v_global_subject_id
  from public.subjects s
  where s.id=p_subject_id and (s.school_id=v_school_id or s.school_id is null);
  if v_global_subject_id is null then raise exception 'SCHEME_SUBJECT_TAXONOMY_REQUIRED'; end if;

  if exists (
    select 1 from unnest(p_curriculum_ids) x
    left join public.curriculum c
      on c.id=x and c.global_subject_id=v_global_subject_id
     and c.grade=v_grade and c.term=v_term
    where c.id is null
  ) then raise exception 'SCHEME_CURRICULUM_IDENTITY_MISMATCH'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_class_id::text||':'||p_subject_id::text||':'||p_academic_term_id::text,0));

  select coalesce(max(s.sequence_number),0)+1 into v_next_sequence
  from public.scheme_of_work s
  where s.class_id=p_class_id and s.subject_id=p_subject_id
    and s.academic_term_id=p_academic_term_id;

  for v_curriculum_id in
    select x from unnest(p_curriculum_ids) x
    join public.curriculum c on c.id=x
    left join public.cbc_strands cs on cs.id=c.sub_strand_id
    order by coalesce(cs.strand_order,2147483647),coalesce(cs.sub_strand_order,2147483647),c.week,c.created_at,c.id
  loop
    select * into v_curr from public.curriculum where id=v_curriculum_id;

    if exists (
      select 1 from public.scheme_of_work s
      where s.class_id=p_class_id and s.subject_id=p_subject_id
        and s.academic_term_id=p_academic_term_id
        and s.curriculum_id=v_curriculum_id and s.source='curriculum'
    ) then continue; end if;

    v_content:=null;
    select cc.* into v_content
    from public.curriculum_content cc
    where cc.curriculum_id=v_curriculum_id
      and cc.source_type='vibeschool' and cc.status='confirmed'
    order by cc.version desc,cc.updated_at desc nulls last limit 1;
    if v_content.id is null then raise exception 'SCHEME_CANONICAL_CONTENT_REQUIRED:%',v_curriculum_id; end if;

    v_ctx:=coalesce(v_content.lesson_context,'{}'::jsonb);
    select nullif(btrim(string_agg(value,'; ')),'') into v_outcomes
    from jsonb_array_elements_text(case when jsonb_typeof(v_ctx->'outcomes')='array' then v_ctx->'outcomes' else '[]'::jsonb end);
    v_kiq:=nullif(btrim(coalesce(v_ctx->>'key_inquiry_question',case when jsonb_typeof(v_ctx->'key_inquiry_questions')='array' then (select string_agg(value,'; ') from jsonb_array_elements_text(v_ctx->'key_inquiry_questions')) end,'')),'');
    select nullif(btrim(string_agg(value,'; ')),'') into v_experiences
    from jsonb_array_elements_text(case when jsonb_typeof(v_ctx->'learning_experiences')='array' then v_ctx->'learning_experiences' else '[]'::jsonb end);
    select nullif(btrim(string_agg(value,'; ')),'') into v_resources
    from jsonb_array_elements_text(case when jsonb_typeof(v_ctx->'learning_resources')='array' then v_ctx->'learning_resources' else '[]'::jsonb end);
    select nullif(btrim(string_agg(value,'; ')),'') into v_assessment
    from jsonb_array_elements_text(case when jsonb_typeof(v_ctx->'assessment_methods')='array' then v_ctx->'assessment_methods' else '[]'::jsonb end);

    if v_outcomes is null or v_kiq is null or v_experiences is null or v_resources is null or v_assessment is null then
      raise exception 'SCHEME_CANONICAL_CONTENT_INCOMPLETE:%',v_curriculum_id;
    end if;

    insert into public.scheme_of_work(
      school_id,teacher_id,class_id,subject_id,curriculum_id,curriculum_content_id,
      academic_term_id,curriculum_type,grade,subject,term,week,strand,sub_strand,
      topic,objectives,key_inquiry_question,learning_experiences,learning_resources,
      assessment_methods,status,source,content_status,sequence_number
    ) values (
      v_school_id,v_uid,p_class_id,p_subject_id,v_curr.id,v_content.id,
      p_academic_term_id,'cbc',v_curr.grade,v_curr.subject,v_curr.term,greatest(v_curr.week,1),
      v_curr.strand,v_curr.sub_strand,v_curr.topic,v_outcomes,v_kiq,v_experiences,
      v_resources,v_assessment,'planned','curriculum','complete',v_next_sequence
    ) returning * into v_inserted;

    v_next_sequence:=v_next_sequence+1;
    return next v_inserted;
  end loop;
  return;
end;
$function$;

revoke all on function public.commit_curriculum_scheme(uuid,uuid,uuid,uuid[]) from public,anon;
grant execute on function public.commit_curriculum_scheme(uuid,uuid,uuid,uuid[]) to authenticated;

commit;
