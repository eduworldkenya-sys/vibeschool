-- Grade 4 CRE and Creative Arts: teacher-owned Scheme lesson mapped to an
-- existing canonical sub-strand and explicit active VibeSchool outcomes.
-- This is planning, NOT source/KICD certification, publication or a timetable.
-- No new curriculum identity or duplicated curriculum rows are created.
-- Existing RLS only exposes verified outcomes and creator_claimed catalogues to
-- authenticated teachers. These 129 + 64 owner-authored ACTIVE outcomes use
-- different source types and would otherwise display as empty in the teacher
-- Curriculum Map. Expose ONLY the two exact, source-scoped Grade 4 catalogues.
-- Draft outcomes are intentionally excluded; this does not grant UPDATE/INSERT.
drop policy if exists grade4_cre_ca_active_outcomes_read on public.curriculum_learning_outcomes;
create policy grade4_cre_ca_active_outcomes_read
on public.curriculum_learning_outcomes
for select to authenticated
using (
  status='active'
  and created_by is null
  and (
    (
      source_type='publisher'
      and source_ref='owner-approved:grade4-cre:2026-11-22'
      and exists (
        select 1 from public.cbc_strands c
        where c.id=curriculum_learning_outcomes.sub_strand_id
          and c.subject_id='8165d513-035b-4019-9fdb-5b86a27335a1'::uuid
          and c.grade='Grade 4'
          and c.source_ref='owner-approved:grade4-cre:2026-11-22'
      )
    )
    or
    (
      source_type='generated'
      and source_ref='https://cbcelimu.com/wp-content/uploads/2024/12/Grade-4-Creative-Arts-Curriculum-Design-May-2024-final.pdf#vibeschool-paraphrase-2026-11-22'
      and exists (
        select 1 from public.cbc_strands c
        where c.id=curriculum_learning_outcomes.sub_strand_id
          and c.subject_id='6d68b57c-565d-4a04-879d-c77f588d6404'::uuid
          and c.grade='Grade 4'
          and c.source_ref like '%#owner-paraphrase-2026-11-22'
      )
    )
  )
);

create or replace function public.commit_grade4_cre_ca_scheme_lesson(
  p_class_id uuid,
  p_subject_id uuid,
  p_academic_term_id uuid,
  p_week integer,
  p_sub_strand_id uuid,
  p_outcome_ids uuid[]
)
returns public.scheme_of_work
language plpgsql
security invoker
set search_path = ''
as $g4_cre_ca$
declare
  v_unit public.cbc_strands%rowtype;
  v_global_subject uuid;
  v_subject_name text;
  v_source_type text;
  v_outcome_source text;
  v_count integer;
  v_distinct integer;
  v_objectives text;
  v_scheme public.scheme_of_work%rowtype;
  v_saved public.scheme_of_work%rowtype;
begin
  if auth.uid() is null then raise exception 'SCHEME_AUTH_REQUIRED'; end if;
  if p_outcome_ids is null or cardinality(p_outcome_ids) not between 1 and 12 then
    raise exception 'SCHEME_OUTCOME_SELECTION_REQUIRED';
  end if;
  select count(distinct id) into v_distinct from unnest(p_outcome_ids) as ids(id);
  if v_distinct is distinct from cardinality(p_outcome_ids) then
    raise exception 'SCHEME_DUPLICATE_OUTCOMES';
  end if;

  select s.id, s.name
    into v_global_subject, v_subject_name
  from public.subjects selected
  join public.subjects s on s.id=case
    when selected.school_id is null then selected.id else selected.global_subject_id end
  where selected.id=p_subject_id
    and s.school_id is null
    and s.global_subject_id is null;
  if v_global_subject is null then raise exception 'SCHEME_SUBJECT_IDENTITY_MISSING'; end if;

  select * into v_unit from public.cbc_strands c
  where c.id=p_sub_strand_id
    and c.grade='Grade 4'
    and c.subject_id=v_global_subject;
  if v_unit.id is null then raise exception 'SCHEME_CURRICULUM_IDENTITY_MISMATCH'; end if;

  if v_subject_name='Christian Religious Education'
     and v_unit.source_ref='owner-approved:grade4-cre:2026-11-22' then
    v_source_type:='publisher';
    v_outcome_source:='owner-approved:grade4-cre:2026-11-22';
  elsif v_subject_name='Creative Arts and Sports'
     and v_unit.source_ref like '%#owner-paraphrase-2026-11-22' then
    v_source_type:='generated';
    v_outcome_source:='https://cbcelimu.com/wp-content/uploads/2024/12/Grade-4-Creative-Arts-Curriculum-Design-May-2024-final.pdf#vibeschool-paraphrase-2026-11-22';
  else
    raise exception 'SCHEME_GRADE4_CRE_CA_SOURCE_UNSUPPORTED';
  end if;

  if not exists (select 1 from public.classes c where c.id=p_class_id and lower(btrim(c.name))='grade 4') then
    raise exception 'SCHEME_GRADE_MISMATCH';
  end if;

  select count(*), string_agg(o.outcome_text, E'\n' order by array_position(p_outcome_ids,o.id))
    into v_count, v_objectives
  from public.curriculum_learning_outcomes o
  where o.id=any(p_outcome_ids)
    and o.sub_strand_id=v_unit.id
    and o.status='active'
    and o.source_type=v_source_type
    and o.source_ref=v_outcome_source;
  if v_count is distinct from cardinality(p_outcome_ids) then
    raise exception 'SCHEME_CURRICULUM_OUTCOME_MISMATCH';
  end if;

  -- Reuse the existing school, teacher assignment, term, instructional week,
  -- tenant and advisory-lock checks. The entire RPC is one transaction.
  v_scheme:=public.commit_custom_scheme_item(
    p_class_id,p_subject_id,p_academic_term_id,p_week,
    v_unit.sub_strand,v_unit.name,null,null
  );

  update public.scheme_of_work set
    sub_strand_id=v_unit.id,
    sub_strand=v_unit.sub_strand,
    objectives=v_objectives,
    curriculum_outcome_id=p_outcome_ids[1],
    key_inquiry_question=null,
    learning_experiences=null,
    reference=v_unit.source_ref||' (VibeSchool curriculum reference; independent KICD outcome review pending)'
  where id=v_scheme.id and teacher_id=auth.uid()
  returning * into v_saved;
  if v_saved.id is null then raise exception 'SCHEME_LESSON_LINK_FAILED'; end if;

  insert into public.scheme_lesson_outcomes(scheme_lesson_id,curriculum_outcome_id)
  select v_saved.id, unnest(p_outcome_ids);

  return v_saved;
end;
$g4_cre_ca$;

revoke all on function public.commit_grade4_cre_ca_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[]) from public;
grant execute on function public.commit_grade4_cre_ca_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[]) to authenticated;
