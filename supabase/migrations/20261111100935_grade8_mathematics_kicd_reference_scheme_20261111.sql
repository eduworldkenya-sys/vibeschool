-- Grade 8 Mathematics: source-linked 2024 KICD structure and separately authored teaching guidance.
-- KICD PDF is copyrighted: this migration stores short catalog facts, a publisher link,
-- and original VibeSchool outcome guidance. It does NOT reproduce or verify official outcomes.
-- Existing legacy cbc_strands, teacher schemes, term weeks and timetable rows are preserved.
-- authorization-test: public.grade8_mathematics_reader_bindings
begin;
create table if not exists public.grade8_mathematics_reader_bindings (
  source_ref text primary key,
  sub_strand_id uuid not null unique references public.cbc_strands(id) on delete restrict,
  source_url text not null,
  source_version text not null,
  key_inquiry_questions text[] not null default '{}',
  suggested_experiences text[] not null default '{}',
  status text not null default 'active' check(status in ('active','archived')),
  created_at timestamptz not null default now()
);
alter table public.grade8_mathematics_reader_bindings enable row level security;
revoke all on public.grade8_mathematics_reader_bindings from public,anon,authenticated;
grant select on public.grade8_mathematics_reader_bindings to authenticated;
drop policy if exists grade8_math_bindings_read on public.grade8_mathematics_reader_bindings;
create policy grade8_math_bindings_read on public.grade8_mathematics_reader_bindings
 for select to authenticated using (status='active');
create temporary table _vs_g8_catalog (source_ref text primary key,unit jsonb not null) on commit drop;
insert into _vs_g8_catalog(source_ref,unit)
select 'VS-CUR-G08-MA-2026#'||(unit->>'id'),unit
from jsonb_array_elements('[{"id":"1.1","strand":"Numbers","title":"Integers","lessons":6,"outcomes":["Interpret positive numbers, negative numbers and zero in familiar situations such as elevation and temperature.","Place signed integers correctly on a number line and compare their positions.","Demonstrate addition of integers using steps along a number line.","Demonstrate subtraction of integers using steps along a number line.","Explain a sensible answer to a real-world problem involving integers."],"inquiry":["How does a number line help us reason about values below zero?"],"experiences":["Act out movement above, below and across zero; draw and explain number-line calculations."]},{"id":"1.2","strand":"Numbers","title":"Fractions","lessons":6,"outcomes":["Identify the reciprocal of a non-zero fraction or whole number.","Evaluate fraction expressions involving several arithmetic operations in the correct order.","Use fraction calculations to decide quantities and costs in a realistic problem."],"inquiry":["How can the order of operations change the answer when fractions are involved?"],"experiences":["Use fraction strips and shopping quantities to check worked solutions."]},{"id":"1.3","strand":"Numbers","title":"Decimals","lessons":8,"outcomes":["Write fractions in decimal notation and distinguish terminating from recurring decimal forms.","Express a recurring decimal as a fraction, explaining the method.","Round a decimal value to a stated number of decimal places.","Round a numerical value to a specified number of significant figures.","Represent very large or small numbers in standard form.","Evaluate mixed decimal calculations using a reliable order of operations.","Select an appropriate degree of precision for a practical measurement."],"inquiry":["What level of precision makes a decimal result useful?"],"experiences":["Compare rounded measurements, investigate repeating decimals, and check calculations with a calculator."]},{"id":"1.4","strand":"Numbers","title":"Squares and Square Roots","lessons":6,"outcomes":["Find squares of suitable numbers using multiplication or a reference table.","Determine square roots by checking the inverse relationship with squares.","Use mathematical tables and a calculator to evaluate squares and square roots.","Apply square numbers or square roots to a practical measurement problem."],"inquiry":["How can we check whether a square-root result is reasonable?"],"experiences":["Use square-grid models, tables and a calculator to compare methods."]},{"id":"1.5","strand":"Numbers","title":"Rates, Ratio, Proportions and Percentages","lessons":14,"outcomes":["Calculate and compare rates using matching units.","Compare ratios and divide a quantity into a given ratio.","Calculate an increase or decrease and express it as a percentage change.","Use percentage calculations to compare everyday prices and quantities.","Solve direct proportion problems using equivalent ratios.","Investigate inverse proportion using a realistic time-or-work example.","Explain the mathematical basis of a proportional decision."],"inquiry":["When is a proportional relationship direct and when is it inverse?"],"experiences":["Compare phone data prices, share a quantity in a ratio and discuss real purchases."]},{"id":"2.1","strand":"Algebra","title":"Algebraic Expressions","lessons":6,"outcomes":["Identify common factors and factorise an algebraic expression.","Simplify algebraic fractions by reducing common factors when valid.","Substitute numerical values into an algebraic expression.","Check an algebraic result by substituting a simple test value."],"inquiry":["How does factorising make an expression easier to work with?"],"experiences":["Use algebra tiles or hand-drawn diagrams to test equivalent expressions."]},{"id":"2.2","strand":"Algebra","title":"Linear Equations","lessons":7,"outcomes":["Form two linear equations in two unknown quantities from a practical situation.","Solve a pair of simultaneous linear equations by substitution.","Solve the same kind of equations by elimination.","Interpret and verify the solution within the original problem."],"inquiry":["How can two related conditions help us find two unknown values?"],"experiences":["Model the purchase of two items with equations and compare solution methods."]},{"id":"3.1","strand":"Measurements","title":"Circles","lessons":5,"outcomes":["Recognise the radius, diameter and circumference of a circular object.","Estimate and calculate the circumference of a circle.","Calculate the length of a circular arc from an appropriate central angle.","Check calculated lengths against measurements of a circular object."],"inquiry":["How are the length around a circle and its diameter related?"],"experiences":["Measure round objects with string and calculate whole circumferences and arcs."]},{"id":"3.2","strand":"Measurements","title":"Area","lessons":10,"outcomes":["Calculate the area of circles using given dimensions.","Determine the area of a circular sector.","Calculate the surface area of cubes and cuboids from diagrams or nets.","Work out the surface area of a cylinder.","Work out the surface area of a triangular prism.","Estimate or determine the area of an irregular plane figure using suitable methods."],"inquiry":["How can a complicated surface be divided into simpler measurable parts?"],"experiences":["Draw nets, measure surfaces and compare estimates of irregular shapes."]},{"id":"3.3","strand":"Measurements","title":"Money","lessons":9,"outcomes":["Explain the difference between principal, interest and total amount.","Calculate simple interest for a stated rate and period.","Determine compound interest for a short multi-year period.","Compare appreciation and depreciation of an asset over time.","Calculate and compare a hire-purchase arrangement with a cash price."],"inquiry":["Which payment choice has the lowest overall cost?"],"experiences":["Compare Kenyan shilling price tags, loan examples and instalment plans using worked calculations."]},{"id":"4.1","strand":"Geometry","title":"Geometrical Constructions","lessons":12,"outcomes":["Use a ruler and pair of compasses accurately to construct basic angles and lines.","Construct specified geometrical figures from given measurements.","Explain construction steps and check lengths, angles and relationships.","Apply geometric constructions to a simple design task."],"inquiry":["Why are precise construction steps important in design?"],"experiences":["Create annotated compass-and-ruler constructions and compare accuracy."]},{"id":"4.2","strand":"Geometry","title":"Coordinates and Graphs","lessons":14,"outcomes":["Locate and label ordered pairs on a Cartesian plane.","Plot points representing an everyday relationship.","Draw and interpret an appropriate graph from coordinates or a table.","Describe a pattern or trend using the graphical evidence."],"inquiry":["How can a graph show a relationship that is difficult to see in a table?"],"experiences":["Plot a travel or price dataset on squared paper and discuss its meaning."]},{"id":"4.3","strand":"Geometry","title":"Scale Drawing","lessons":14,"outcomes":["Interpret a scale statement or ratio on a plan or map.","Convert between measurements on a scale drawing and actual distances.","Make a labelled scale drawing of a familiar object or space.","Select a reasonable scale and check that a drawing represents its subject accurately."],"inquiry":["How can a small plan represent a much larger real space accurately?"],"experiences":["Measure a classroom object and produce a scaled plan with labelled dimensions."]},{"id":"4.4","strand":"Geometry","title":"Common Solids","lessons":16,"outcomes":["Identify common three-dimensional solids using everyday objects.","Sketch and interpret the nets of cubes, cuboids, cylinders, pyramids and cones.","Calculate the surface area of common solids by working from their nets.","Determine a route or distance between points along the surface of a solid.","Build and compare hollow and compact solid models using suitable materials."],"inquiry":["How does a flat net become a three-dimensional solid?"],"experiences":["Make paper nets, measure their faces and build solid models."]},{"id":"5.1","strand":"Data Handling and Probability","title":"Data Representation and Interpretation","lessons":10,"outcomes":["Organise numerical observations into a useful table.","Draw a labelled bar graph from a small dataset.","Describe and compare the values shown by a bar graph.","Plot and interpret a line graph of changing values.","Find and interpret the mean, median and mode for a dataset."],"inquiry":["Which graph or summary best communicates what the data shows?"],"experiences":["Collect a small class dataset, draw charts and compare numerical summaries."]},{"id":"5.2","strand":"Data Handling and Probability","title":"Probability","lessons":7,"outcomes":["List the possible outcomes of a simple chance experiment.","Express probability as a fraction between zero and one for equally likely outcomes.","Compare calculated chance with the results of repeated trials.","Explain what a probability value says about an everyday event."],"inquiry":["How reliable is a prediction of an uncertain event?"],"experiences":["Roll dice or toss a coin repeatedly and compare observed frequencies with expected probabilities."]}]'::jsonb) unit;
do $preflight$
begin
 if (select count(*) from _vs_g8_catalog)<>16
    or (select sum((unit->>'lessons')::int) from _vs_g8_catalog)<>150
    or (select count(distinct unit->>'strand') from _vs_g8_catalog)<>5
 then raise exception 'GRADE8_MATH_CATALOG_MISMATCH'; end if;
 if (select count(*) from public.subjects where name='Mathematics' and school_id is null and global_subject_id is null)<>1
 then raise exception 'GRADE8_MATH_GLOBAL_SUBJECT_MISSING'; end if;
 if exists (
   select 1 from _vs_g8_catalog t
   join public.subjects sub on sub.name='Mathematics' and sub.school_id is null and sub.global_subject_id is null
   join public.cbc_strands s on s.subject_id=sub.id and s.grade='Grade 8'
     and s.name=t.unit->>'strand' and s.sub_strand=t.unit->>'title'
   where s.source_ref is not null and s.source_ref<>t.source_ref
 ) then raise exception 'GRADE8_MATH_CONFLICTING_EXISTING_SOURCE'; end if;
end;$preflight$;
insert into public.cbc_strands
 (subject_id,grade,name,sub_strand,strand_order,sub_strand_order,
  key_inquiry_questions,suggested_experiences,source_ref)
select sub.id,'Grade 8',t.unit->>'strand',t.unit->>'title',
 split_part(t.unit->>'id','.',1)::int,split_part(t.unit->>'id','.',2)::int,
 array(select jsonb_array_elements_text(t.unit->'inquiry')),
 array(select jsonb_array_elements_text(t.unit->'experiences')),t.source_ref
from _vs_g8_catalog t
join public.subjects sub on sub.name='Mathematics' and sub.school_id is null and sub.global_subject_id is null
on conflict(subject_id,grade,name,sub_strand) do nothing;
insert into public.grade8_mathematics_reader_bindings
 (source_ref,sub_strand_id,source_url,source_version,key_inquiry_questions,suggested_experiences)
select t.source_ref,s.id,
 'https://kicd.ac.ke/wp-content/uploads/2024/06/Mathematics-Grade-8-Design-Formatted-April-2024.pdf', 'KICD revised 2024',
 array(select jsonb_array_elements_text(t.unit->'inquiry')),
 array(select jsonb_array_elements_text(t.unit->'experiences'))
from _vs_g8_catalog t
join public.subjects sub on sub.name='Mathematics' and sub.school_id is null and sub.global_subject_id is null
join public.cbc_strands s on s.subject_id=sub.id and s.grade='Grade 8'
 and s.name=t.unit->>'strand' and s.sub_strand=t.unit->>'title'
on conflict(source_ref) do nothing;
insert into public.curriculum_unit_guidance
 (sub_strand_id,suggested_lessons,learning_resources,assessment_methods,competencies,safety_notes,content_status)
select b.sub_strand_id,(t.unit->>'lessons')::int,
 'Teacher-authored examples, exercise books, mathematical instruments and the original KICD Grade 8 reference link',
 'Worked examples, questioning, written tasks and observed learner explanation',
 'Reasoning, mathematical communication, problem solving, collaboration',
 'Use appropriate age-safe practical materials and supervised ICT access','active'
from _vs_g8_catalog t join public.grade8_mathematics_reader_bindings b on b.source_ref=t.source_ref
on conflict(sub_strand_id) do nothing;
insert into public.curriculum_learning_outcomes
 (sub_strand_id,outcome_text,outcome_code,source_type,source_ref,status)
select b.sub_strand_id,o.text,
 'VS-G8-MA-'||(t.unit->>'id')||'-'||o.ordinality,
 'creator_claimed',t.source_ref||'/'||o.ordinality,'active'
from _vs_g8_catalog t
join public.grade8_mathematics_reader_bindings b on b.source_ref=t.source_ref
cross join lateral jsonb_array_elements_text(t.unit->'outcomes')
 with ordinality as o(text,ordinality)
where not exists(select 1 from public.curriculum_learning_outcomes x
 where x.source_ref=t.source_ref||'/'||o.ordinality);
drop policy if exists grade8_math_original_outcomes_read on public.curriculum_learning_outcomes;
create policy grade8_math_original_outcomes_read on public.curriculum_learning_outcomes
 for select to authenticated using (
  status='active' and source_type='creator_claimed' and created_by is null
  and source_ref like 'VS-CUR-G08-MA-2026#%'
 );
drop policy if exists grade8_math_guidance_read on public.curriculum_unit_guidance;
create policy grade8_math_guidance_read on public.curriculum_unit_guidance
 for select to authenticated using (
  content_status='active' and exists(select 1 from public.grade8_mathematics_reader_bindings b
   where b.sub_strand_id=curriculum_unit_guidance.sub_strand_id and b.status='active')
 );
do $verify$
begin
 if (select count(*) from public.grade8_mathematics_reader_bindings where status='active'
       and source_ref like 'VS-CUR-G08-MA-2026#%')<>16
   or (select coalesce(sum(g.suggested_lessons),0) from public.grade8_mathematics_reader_bindings b
       join public.curriculum_unit_guidance g on g.sub_strand_id=b.sub_strand_id and g.content_status='active'
       where b.source_ref like 'VS-CUR-G08-MA-2026#%')<>150
   or (select count(*) from public.curriculum_learning_outcomes o
       where o.source_ref like 'VS-CUR-G08-MA-2026#%' and o.status='active')<>75
 then raise exception 'GRADE8_MATH_PERSISTENCE_INCOMPLETE'; end if;
end;$verify$;
-- Extend the existing invoker RPC, preserving all Grade 1 authorization boundaries.
create or replace function public.commit_mapped_scheme_lesson(
  p_class_id uuid,
  p_subject_id uuid,
  p_academic_term_id uuid,
  p_week integer,
  p_sub_strand_id uuid,
  p_outcome_ids uuid[]
) returns public.scheme_of_work
language plpgsql
security invoker
set search_path=''
as $function$
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
      reference=v_reader_ref||case when v_unit.grade='Grade 8'
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
