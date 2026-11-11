-- Grade 6 Mathematics: source-linked 2024 KICD structure and separately authored teaching guidance.
-- KICD PDF is copyrighted: this migration stores short catalog facts, a publisher link,
-- and original VibeSchool outcome guidance. It does NOT reproduce or verify official outcomes.
-- Existing legacy cbc_strands, teacher schemes, term weeks and timetable rows are preserved.
-- authorization-test: public.grade6_mathematics_reader_bindings
begin;
create table if not exists public.grade6_mathematics_reader_bindings (
  source_ref text primary key,
  sub_strand_id uuid not null unique references public.cbc_strands(id) on delete restrict,
  source_url text not null,
  source_version text not null,
  key_inquiry_questions text[] not null default '{}',
  suggested_experiences text[] not null default '{}',
  status text not null default 'active' check(status in ('active','archived')),
  created_at timestamptz not null default now()
);
alter table public.grade6_mathematics_reader_bindings enable row level security;
revoke all on public.grade6_mathematics_reader_bindings from public,anon,authenticated;
grant select on public.grade6_mathematics_reader_bindings to authenticated;
drop policy if exists grade6_math_bindings_read on public.grade6_mathematics_reader_bindings;
create policy grade6_math_bindings_read on public.grade6_mathematics_reader_bindings
 for select to authenticated using (status='active');
create temporary table _vs_g6_catalog (source_ref text primary key,unit jsonb not null) on commit drop;
insert into _vs_g6_catalog(source_ref,unit)
select 'VS-CUR-G06-MA-2026#'||(unit->>'id'),unit
from jsonb_array_elements('[{"id":"1.1","title":"Whole Numbers","strand":"Numbers","lessons":20,"outcomes":["Identify the position and total value of digits in numbers extending into the millions.","Read numbers into the millions when presented in numeral form.","Write number names for quantities up to one hundred thousand and convert names back to numerals.","Arrange whole numbers up to one hundred thousand in increasing or decreasing order.","Round numbers not exceeding one hundred thousand to the nearest thousand.","Find the square of a whole number up to one hundred by multiplying it by itself.","Identify the square roots of perfect-square numbers up to ten thousand.","Explain uses of large numbers, square numbers and square roots in familiar situations."],"experiences":["Build and compare multi-digit numbers using place-value charts and Kenyan population or harvest figures.","Order number cards, round them, and check square and square-root pairs with arrays or graph paper."],"inquiry":["How does the position of a digit change its value?","How can we check that a number is a perfect square?"],"resources":"Place-value charts, number cards, squared paper and counters.","assessment":"Check reading, writing, ordering, rounding, squares and square roots using unfamiliar examples.","competencies":"Critical thinking and problem solving; communication and collaboration; integrity, responsibility and inclusive participation."},{"id":"1.2","title":"Multiplication","strand":"Numbers","lessons":6,"outcomes":["Multiply a whole number of up to four digits by a number of up to two digits.","Estimate a product by first rounding each factor to the nearest ten.","Create and extend multiplication patterns whose terms do not exceed one thousand.","Choose multiplication to solve practical problems involving groups and quantities."],"experiences":["Compare expanded-form multiplication with a standard written method using market stock examples.","Round factors before multiplying, then create and explain a pattern using number cards."],"inquiry":["How can estimating first help us check our answer?"],"resources":"Place-value grids, number cards and exercise books.","assessment":"Verify correct products, reasonable estimates and pattern rules.","competencies":"Critical thinking and problem solving; communication and collaboration; integrity, responsibility and inclusive participation."},{"id":"1.3","title":"Division","strand":"Numbers","lessons":6,"outcomes":["Divide whole numbers of up to four digits by whole numbers of up to three digits, using suitable methods.","Estimate quotients by rounding the dividend and divisor to the nearest ten.","Work through practical problems combining the four operations on whole numbers up to three digits.","Select division in everyday situations involving sharing or grouping."],"experiences":["Share agricultural produce into equal groups and check results through multiplication.","Solve mixed-operation problems and explain why the chosen sequence of steps makes sense."],"inquiry":["How can multiplication help us check a division answer?"],"resources":"Grouping counters, number cards and place-value charts.","assessment":"Assess division, quotient estimates and mixed-operation reasoning.","competencies":"Critical thinking and problem solving; communication and collaboration; integrity, responsibility and inclusive participation."},{"id":"1.4","title":"Fractions","strand":"Numbers","lessons":12,"outcomes":["Add fractions having different denominators after finding an appropriate common denominator.","Subtract fractions having unlike denominators using equivalent forms.","Add mixed numbers in practical situations.","Subtract mixed numbers with or without regrouping.","Find the reciprocal of a proper fraction with a numerator of one digit.","Find the square of a fraction with a one-digit numerator and a denominator of up to two digits.","Express a fraction as a percentage where an equivalent hundredth is available.","Express percentages as fractions in simplest suitable form.","Apply fractions, reciprocals and percentages to familiar sharing and comparison problems."],"experiences":["Use strips and equivalent-fraction grids to show addition and subtraction before written calculation.","Compare reciprocals, squares and percentages using parts of a school garden or similar context."],"inquiry":["Why is a shared denominator useful when combining fractions?","How are hundredths related to percentages?"],"resources":"Fraction strips, hundred grids and paper circles.","assessment":"Check common-denominator steps, mixed numbers, reciprocals, squares and percentage conversion.","competencies":"Critical thinking and problem solving; communication and collaboration; integrity, responsibility and inclusive participation."},{"id":"1.5","title":"Decimals","strand":"Numbers","lessons":12,"outcomes":["Identify the value of each digit in decimal numbers down to ten-thousandths.","Round decimal values accurately to one, two or three decimal places.","Convert common fractions into decimal numbers and decimals back to fractions.","Express decimal numbers as percentages and percentages as decimals.","Add decimal quantities with up to four places after the decimal point.","Subtract decimal quantities with up to four decimal places.","Use decimals to describe and compare measurements and prices."],"experiences":["Represent decimal place values on grids and match them to fractions.","Record measurements, round them to a stated precision and practise aligned-column calculations."],"inquiry":["Why is decimal place value important when adding two measurements?"],"resources":"Decimal place-value charts, hundred grids and measuring tools.","assessment":"Check rounding, conversions and decimal operations.","competencies":"Critical thinking and problem solving; communication and collaboration; integrity, responsibility and inclusive participation."},{"id":"1.6","title":"Inequalities","strand":"Numbers","lessons":8,"outcomes":["Write a one-variable inequality to describe a comparison or restriction.","Simplify basic inequalities through valid operations on both sides.","Solve simple inequalities involving a single unknown.","Use inequality symbols to communicate real limits or ranges."],"experiences":["Translate classroom capacity rules into greater-than and less-than statements.","Try different values on a number line and justify which ones satisfy an inequality."],"inquiry":["How is an inequality different from an equation?"],"resources":"Number lines, comparison cards and learner-made problems.","assessment":"Check inequality construction, solutions and interpretation.","competencies":"Critical thinking and problem solving; communication and collaboration; integrity, responsibility and inclusive participation."},{"id":"2.1","title":"Length","strand":"Measurement","lessons":14,"outcomes":["Use millimetres to measure and record short lengths precisely.","Explain the relationship between centimetres and millimetres.","Change measurements in centimetres and millimetres into millimetres.","Add measurements expressed in centimetres and millimetres.","Subtract measurements expressed in centimetres and millimetres.","Multiply lengths expressed in centimetres and millimetres by whole numbers.","Divide lengths expressed in centimetres and millimetres by whole numbers.","Measure the length around a circular object using a practical method.","Compare a circle''s circumference with its diameter using repeated observations.","Select suitable length units for practical measuring problems."],"experiences":["Measure stationery in millimetres and solve multi-step questions involving units.","Wrap string around circular lids, measure the string and compare the result with each diameter."],"inquiry":["When are millimetres more useful than centimetres?","What relationship do different circular objects share?"],"resources":"Rulers, measuring tapes, circular lids and string.","assessment":"Check units, conversions, arithmetic and practical circumference measurements.","competencies":"Critical thinking and problem solving; communication and collaboration; integrity, responsibility and inclusive participation."},{"id":"2.2","title":"Area","strand":"Measurement","lessons":6,"outcomes":["Find the area of a triangle in square centimetres by relating it to a rectangle.","Calculate the area of figures made from rectangles, squares and triangles.","Estimate the area inside a circle by counting squares on a grid.","Apply area estimation and calculations to familiar design or space-planning problems."],"experiences":["Cut a rectangle diagonally and compare the two triangular areas.","Draw composite shapes and circles on squared paper to calculate or estimate their areas."],"inquiry":["How does a rectangle help us calculate the area of a triangle?"],"resources":"Squared paper, rulers and pre-cut shapes.","assessment":"Assess triangle and composite calculations and sensible circle estimates.","competencies":"Critical thinking and problem solving; communication and collaboration; integrity, responsibility and inclusive participation."},{"id":"2.3","title":"Capacity","strand":"Measurement","lessons":6,"outcomes":["Explain the connection between cubic centimetres, millilitres and litres for capacity.","Convert capacities from litres into millilitres.","Convert capacities from millilitres into litres.","Choose suitable units when comparing the capacity of containers."],"experiences":["Compare a cubic centimetre and a millilitre using safe measured water quantities.","Change amounts on household container labels between litres and millilitres."],"inquiry":["Why must we use equivalent units to compare capacity?"],"resources":"Graduated jugs, marked bottles, clean water and trays.","assessment":"Check measurement and conversions between litres and millilitres.","competencies":"Critical thinking and problem solving; communication and collaboration; integrity, responsibility and inclusive participation."},{"id":"2.4","title":"Mass","strand":"Measurement","lessons":14,"outcomes":["Recognise the tonne as a measurement unit used for very heavy loads.","Identify familiar loads that are appropriately described in tonnes.","Explain how kilograms relate to tonnes.","Estimate masses of large objects or loads using tonnes.","Convert values in tonnes into kilograms.","Convert values in kilograms into tonnes.","Add masses expressed in tonnes and kilograms.","Subtract masses expressed in tonnes and kilograms.","Multiply mass quantities by whole numbers.","Divide mass quantities by whole numbers."],"experiences":["Investigate approximate masses of trucks and their loads compared with 1,000 kilograms.","Prepare transport records involving mass conversions, combined loads and shared loads."],"inquiry":["Why do people use tonnes instead of kilograms for very heavy objects?"],"resources":"Mass charts, weighing-scale examples and transport records.","assessment":"Assess unit selection, estimates, conversions and the four operations.","competencies":"Critical thinking and problem solving; communication and collaboration; integrity, responsibility and inclusive participation."},{"id":"2.5","title":"Time","strand":"Measurement","lessons":10,"outcomes":["Distinguish a.m. and p.m. when describing everyday times.","Record times correctly using twelve-hour notation.","Relate twelve-hour times to the twenty-four-hour clock.","Convert twelve-hour time into twenty-four-hour notation.","Convert twenty-four-hour notation back into twelve-hour time.","Read departure and arrival information from journey timetables."],"experiences":["Compare analogue clock readings with digital twenty-four-hour displays.","Use a Kenyan journey timetable to interpret departure, arrival and elapsed time."],"inquiry":["How do we distinguish seven o''clock in the morning from seven o''clock in the evening?"],"resources":"Clock models and sample bus or train schedules.","assessment":"Check accurate clock conversions and timetable interpretation.","competencies":"Critical thinking and problem solving; communication and collaboration; integrity, responsibility and inclusive participation."},{"id":"2.6","title":"Money","strand":"Measurement","lessons":8,"outcomes":["Prepare a simple budget for a familiar school or household activity.","Distinguish cost price from selling price in a transaction.","Calculate profit by comparing the selling price and cost price.","Calculate loss when an item sells for less than it cost.","Identify taxes such as value added tax and income tax in familiar examples.","Use financial calculations to make responsible everyday choices."],"experiences":["Prepare a school-club activity budget using prices in Kenyan shillings.","Run a simulated shop, compare cost and selling prices, and examine sample receipts with tax."],"inquiry":["How can a budget help us avoid spending more than we have?"],"resources":"Price lists, sample receipts and mock currency.","assessment":"Check budgets, profit and loss calculations and basic tax identification.","competencies":"Critical thinking and problem solving; communication and collaboration; integrity, responsibility and inclusive participation."},{"id":"3.1","title":"Lines","strand":"Geometry","lessons":6,"outcomes":["Construct parallel lines using appropriate drawing tools.","Bisect a line segment by construction.","Draw a line at right angles to a given line.","Identify practical uses of parallel lines, bisectors and perpendicular lines."],"experiences":["Use rulers, set squares and compasses to construct pairs of parallel and perpendicular lines.","Construct a perpendicular bisector and compare methods in pairs."],"inquiry":["How can we check that our constructed line forms a right angle?"],"resources":"Rulers, set squares, compasses and squared paper.","assessment":"Check construction accuracy and explanation of the method.","competencies":"Critical thinking and problem solving; communication and collaboration; integrity, responsibility and inclusive participation."},{"id":"3.2","title":"Angles","strand":"Geometry","lessons":6,"outcomes":["Identify angles that sit next to each other along a straight line.","Measure angles along a straight line with a protractor.","Use the angle total along a straight line to find an unknown angle.","Determine the sum of the interior angles of triangles and rectangles.","Construct equilateral, isosceles and right-angled triangles.","Measure and compare angles inside triangles of different types.","Apply angle relationships to drawings and design problems."],"experiences":["Measure adjacent angles formed when a straight line is crossed by another.","Fit together cut-out triangle corners, then construct and label different kinds of triangles."],"inquiry":["How can one measured angle help us work out another?"],"resources":"Protractors, rulers, triangle cut-outs and pencils.","assessment":"Check angle measurements, totals and geometric construction.","competencies":"Critical thinking and problem solving; communication and collaboration; integrity, responsibility and inclusive participation."},{"id":"3.3","title":"3-D Objects","strand":"Geometry","lessons":6,"outcomes":["Name the vertices, edges and faces of cubes and cuboids.","Describe the flat and curved surfaces of a cylinder.","Identify two-dimensional shapes that form faces of common three-dimensional objects.","Give everyday examples of solid shapes and explain their uses."],"experiences":["Inspect safe cartons and record faces, edges and vertices.","Unfold prepared nets of cuboids, cubes and cylinders to identify the plane shapes."],"inquiry":["What flat shapes appear when we open out a box?"],"resources":"Clean boxes, safe cylindrical containers and nets.","assessment":"Assess identification of object features and correct explanation of nets.","competencies":"Critical thinking and problem solving; communication and collaboration; integrity, responsibility and inclusive participation."},{"id":"4.1","title":"Bar Graphs","strand":"Data Handling","lessons":10,"outcomes":["Organise counts or observations into a frequency table.","Represent information with a pictograph and a clear key.","Display counted quantities using equal-sized objects arranged in groups.","Draw a correctly labelled bar graph from an observed data set.","Compare categories and calculate totals from a bar graph.","Explain decisions that can be supported by a clear, accurately labelled graph."],"experiences":["Survey a class, tally responses and arrange findings in a frequency table.","Display one data set using object piles, a pictograph and a bar graph, then compare the displays."],"inquiry":["How do scales and labels help us read a graph correctly?"],"resources":"Tally sheets, counters and graph paper.","assessment":"Check data totals, graph axes, scales and interpretation.","competencies":"Critical thinking and problem solving; communication and collaboration; integrity, responsibility and inclusive participation."}]'::jsonb) unit;
do $preflight$
begin
 if (select count(*) from _vs_g6_catalog)<>16
    or (select sum((unit->>'lessons')::int) from _vs_g6_catalog)<>150
    or (select count(distinct unit->>'strand') from _vs_g6_catalog)<>4
 then raise exception 'GRADE6_MATH_CATALOG_MISMATCH'; end if;
 if (select count(*) from public.subjects where name='Mathematics' and school_id is null and global_subject_id is null)<>1
 then raise exception 'GRADE6_MATH_GLOBAL_SUBJECT_MISSING'; end if;
 if exists (
   select 1 from _vs_g6_catalog t
   join public.subjects sub on sub.name='Mathematics' and sub.school_id is null and sub.global_subject_id is null
   join public.cbc_strands s on s.subject_id=sub.id and s.grade='Grade 6'
     and s.name=t.unit->>'strand' and s.sub_strand=t.unit->>'title'
   where s.source_ref is not null and s.source_ref<>t.source_ref
 ) then raise exception 'GRADE6_MATH_CONFLICTING_EXISTING_SOURCE'; end if;
end;$preflight$;
insert into public.cbc_strands
 (subject_id,grade,name,sub_strand,strand_order,sub_strand_order,
  key_inquiry_questions,suggested_experiences,source_ref)
select sub.id,'Grade 6',t.unit->>'strand',t.unit->>'title',
 split_part(t.unit->>'id','.',1)::int,split_part(t.unit->>'id','.',2)::int,
 array(select jsonb_array_elements_text(t.unit->'inquiry')),
 array(select jsonb_array_elements_text(t.unit->'experiences')),t.source_ref
from _vs_g6_catalog t
join public.subjects sub on sub.name='Mathematics' and sub.school_id is null and sub.global_subject_id is null
on conflict(subject_id,grade,name,sub_strand) do nothing;
insert into public.grade6_mathematics_reader_bindings
 (source_ref,sub_strand_id,source_url,source_version,key_inquiry_questions,suggested_experiences)
select t.source_ref,s.id,
 'https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-6-Mathematics-Revised.pdf', 'KICD revised 2024',
 array(select jsonb_array_elements_text(t.unit->'inquiry')),
 array(select jsonb_array_elements_text(t.unit->'experiences'))
from _vs_g6_catalog t
join public.subjects sub on sub.name='Mathematics' and sub.school_id is null and sub.global_subject_id is null
join public.cbc_strands s on s.subject_id=sub.id and s.grade='Grade 6'
 and s.name=t.unit->>'strand' and s.sub_strand=t.unit->>'title'
on conflict(source_ref) do nothing;
insert into public.curriculum_unit_guidance
 (sub_strand_id,suggested_lessons,learning_resources,assessment_methods,competencies,safety_notes,content_status)
select b.sub_strand_id,(t.unit->>'lessons')::int,
 t.unit->>'resources',
 t.unit->>'assessment',
 t.unit->>'competencies',
 'Use appropriate age-safe practical materials and supervised ICT access','active'
from _vs_g6_catalog t join public.grade6_mathematics_reader_bindings b on b.source_ref=t.source_ref
on conflict(sub_strand_id) do nothing;
insert into public.curriculum_learning_outcomes
 (sub_strand_id,outcome_text,outcome_code,source_type,source_ref,status)
select b.sub_strand_id,o.text,
 'VS-G6-MA-'||(t.unit->>'id')||'-'||o.ordinality,
 'creator_claimed',t.source_ref||'/'||o.ordinality,'active'
from _vs_g6_catalog t
join public.grade6_mathematics_reader_bindings b on b.source_ref=t.source_ref
cross join lateral jsonb_array_elements_text(t.unit->'outcomes')
 with ordinality as o(text,ordinality)
where not exists(select 1 from public.curriculum_learning_outcomes x
 where x.source_ref=t.source_ref||'/'||o.ordinality);
drop policy if exists grade6_math_original_outcomes_read on public.curriculum_learning_outcomes;
create policy grade6_math_original_outcomes_read on public.curriculum_learning_outcomes
 for select to authenticated using (
  status='active' and source_type='creator_claimed' and created_by is null
  and source_ref like 'VS-CUR-G06-MA-2026#%'
 );
drop policy if exists grade6_math_guidance_read on public.curriculum_unit_guidance;
create policy grade6_math_guidance_read on public.curriculum_unit_guidance
 for select to authenticated using (
  content_status='active' and exists(select 1 from public.grade6_mathematics_reader_bindings b
   where b.sub_strand_id=curriculum_unit_guidance.sub_strand_id and b.status='active')
 );
do $verify$
begin
 if (select count(*) from public.grade6_mathematics_reader_bindings where status='active'
       and source_ref like 'VS-CUR-G06-MA-2026#%')<>16
   or (select coalesce(sum(g.suggested_lessons),0) from public.grade6_mathematics_reader_bindings b
       join public.curriculum_unit_guidance g on g.sub_strand_id=b.sub_strand_id and g.content_status='active'
       where b.source_ref like 'VS-CUR-G06-MA-2026#%')<>150
   or (select count(*) from public.curriculum_learning_outcomes o
       where o.source_ref like 'VS-CUR-G06-MA-2026#%' and o.status='active')<>97
 then raise exception 'GRADE6_MATH_PERSISTENCE_INCOMPLETE'; end if;
end;$verify$;
-- Grade 1 trusted teacher workflow stays intact; extend only for bound Grade 8 English.
-- Retain already deployed Grade 8 Mathematics and Grade 1 mapping safety.
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
      or (s.grade='Grade 8' and exists
        (select 1 from public.grade8_english_reader_bindings b
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
