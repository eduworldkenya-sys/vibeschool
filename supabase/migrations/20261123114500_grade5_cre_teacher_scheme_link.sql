-- Grade 5 CRE: preserve the existing 30 canonical curriculum unit identities
-- and connect teachers' Curriculum Map to their own Scheme of Work.
-- Sub-strand plans are permitted before outcomes are reviewed; such plans
-- deliberately carry NO official/approved learning outcome identity.
-- The Grade 4 CRE/CA workflow and all existing data remain unchanged.
-- No automatic scheduling, publishing, certification or role expansion.
--
-- Only active, source-attributed, platform-owned outcomes become selectable.
-- The 17 current Grade 5 CRE outcomes are DRAFT, so this policy does NOT
-- expose or activate them. All 30 unit headings remain mapped in cbc_strands.
create policy grade5_cre_active_outcomes_teacher_read
on public.curriculum_learning_outcomes
for select to authenticated
using (
  status='active'
  and source_type='official'
  and created_by is null
  and strpos(coalesce(source_ref,''),'https://kicd.ac.ke/wp-content/uploads/2024/10/CRE-GRADE-5-DESIGN-Revised.pdf')>0
  and exists (
    select 1 from public.cbc_strands c
    where c.id=curriculum_learning_outcomes.sub_strand_id
      and c.subject_id='8165d513-035b-4019-9fdb-5b86a27335a1'::uuid
      and c.grade='Grade 5'
      and strpos(coalesce(c.source_ref,''),'https://kicd.ac.ke/wp-content/uploads/2024/10/CRE-GRADE-5-DESIGN-Revised.pdf')>0
  )
);

create or replace function public.commit_grade5_cre_scheme_unit(
  p_class_id uuid,
  p_subject_id uuid,
  p_academic_term_id uuid,
  p_week integer,
  p_sub_strand_id uuid,
  p_outcome_ids uuid[] default '{}'::uuid[]
)
returns public.scheme_of_work
language plpgsql
security invoker
set search_path=''
as $g5_cre_scheme$
declare
  v_unit public.cbc_strands%rowtype;
  v_global_subject uuid;
  v_count integer;
  v_distinct integer;
  v_objectives text;
  v_scheme public.scheme_of_work%rowtype;
  v_saved public.scheme_of_work%rowtype;
begin
  if auth.uid() is null then raise exception 'SCHEME_AUTH_REQUIRED'; end if;
  if p_outcome_ids is null or cardinality(p_outcome_ids)>12 then
    raise exception 'SCHEME_OUTCOME_SELECTION_INVALID';
  end if;
  select count(distinct id) into v_distinct from unnest(p_outcome_ids) as ids(id);
  if v_distinct is distinct from cardinality(p_outcome_ids) then
    raise exception 'SCHEME_DUPLICATE_OUTCOMES';
  end if;

  -- A teacher may pass the assigned school's subject, but the global subject
  -- identity must be exactly CRE, never the generic Religious Education area.
  select root_subject.id into v_global_subject
  from public.subjects selected
  join public.subjects root_subject on root_subject.id=case
    when selected.school_id is null then selected.id else selected.global_subject_id end
  where selected.id=p_subject_id
    and root_subject.school_id is null
    and root_subject.global_subject_id is null
    and root_subject.name='Christian Religious Education'
    and root_subject.id='8165d513-035b-4019-9fdb-5b86a27335a1'::uuid;
  if v_global_subject is null then raise exception 'SCHEME_SUBJECT_IDENTITY_MISMATCH'; end if;

  -- Exact selected curriculum unit, not a hardcoded parallel curriculum.
  select * into v_unit from public.cbc_strands c
  where c.id=p_sub_strand_id
    and c.subject_id=v_global_subject
    and c.grade='Grade 5'
    and c.term is null and c.week is null
    and strpos(coalesce(c.source_ref,''),'https://kicd.ac.ke/wp-content/uploads/2024/10/CRE-GRADE-5-DESIGN-Revised.pdf')>0;
  if v_unit.id is null then raise exception 'SCHEME_CURRICULUM_IDENTITY_MISMATCH'; end if;

  if not exists (
    select 1 from public.classes c
    where c.id=p_class_id
      and lower(btrim(c.name)) ~ '^(grade|class)[[:space:]]*5([[:space:]]|$)'
  ) then raise exception 'SCHEME_GRADE_MISMATCH'; end if;

  -- An empty list creates only an honest sub-strand plan, so teachers can
  -- prepare all 30 units without fabricating the 26 missing outcome sets.
  -- Nonempty lists must belong to this unit and be ACTIVE, not DRAFT.
  select count(*),
    string_agg(o.outcome_text,E'\n' order by array_position(p_outcome_ids,o.id))
  into v_count,v_objectives
  from public.curriculum_learning_outcomes o
  where o.id=any(p_outcome_ids)
    and o.sub_strand_id=v_unit.id
    and o.status='active'
    and o.source_type='official'
    and o.created_by is null
    and strpos(coalesce(o.source_ref,''),'https://kicd.ac.ke/wp-content/uploads/2024/10/CRE-GRADE-5-DESIGN-Revised.pdf')>0;
  if v_count is distinct from cardinality(p_outcome_ids) then
    raise exception 'SCHEME_CURRICULUM_OUTCOME_MISMATCH';
  end if;

  -- Delegates ALL school, class, subject, teacher-assignment, term/week,
  -- locking and tenant checks to the existing canonical Scheme writer.
  v_scheme := public.commit_custom_scheme_item(
    p_class_id,p_subject_id,p_academic_term_id,p_week,
    v_unit.sub_strand,v_unit.name,null,null
  );

  update public.scheme_of_work set
    sub_strand_id=v_unit.id,
    sub_strand=v_unit.sub_strand,
    objectives=v_objectives,
    curriculum_outcome_id=case when v_count>0 then p_outcome_ids[1] else null end,
    reference=v_unit.source_ref||' (VibeSchool planning reference; KICD outcome equivalence not certified)'
  where id=v_scheme.id and teacher_id=auth.uid()
  returning * into v_saved;
  if v_saved.id is null then raise exception 'SCHEME_LESSON_LINK_FAILED'; end if;

  insert into public.scheme_lesson_outcomes(scheme_lesson_id,curriculum_outcome_id)
  select v_saved.id, unnest(p_outcome_ids);

  return v_saved;
end;
$g5_cre_scheme$;

revoke all on function public.commit_grade5_cre_scheme_unit(uuid,uuid,uuid,integer,uuid,uuid[]) from public;
grant execute on function public.commit_grade5_cre_scheme_unit(uuid,uuid,uuid,integer,uuid,uuid[]) to authenticated;
