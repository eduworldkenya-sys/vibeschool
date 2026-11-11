-- Grade 4 Mathematics: 2024 KICD reference, 19 units, 150 VibeSchool-paced lessons.
-- Source headings are facts; the detailed outcomes and experiences are original VibeSchool guides.
-- The official design does not clearly print a 1.1 Whole Numbers lesson count:
-- 20 lessons for that unit is explicitly VibeSchool's planning figure, NOT a KICD claim.
-- Existing 35 Grade 4 hierarchy rows and all teacher scheme/timetable data are preserved.
-- security invoker: existing mapped-scheme RPC is patched in place without bypassing RLS.
-- authorization-test: public.grade4_mathematics_reader_bindings
begin;
create table if not exists public.grade4_mathematics_reader_bindings (
 source_ref text primary key,
 sub_strand_id uuid not null unique references public.cbc_strands(id) on delete restrict,
 source_url text not null,
 source_version text not null,
 key_inquiry_questions text[] not null default '{}',
 suggested_experiences text[] not null default '{}',
 status text not null default 'active' check(status in ('active','archived')),
 created_at timestamptz not null default now()
);
alter table public.grade4_mathematics_reader_bindings enable row level security;
revoke all on public.grade4_mathematics_reader_bindings from public,anon,authenticated;
grant select on public.grade4_mathematics_reader_bindings to authenticated;
drop policy if exists grade4_math_bindings_read on public.grade4_mathematics_reader_bindings;
create policy grade4_math_bindings_read on public.grade4_mathematics_reader_bindings
 for select to authenticated using (status='active');

create temporary table _vs_g4_catalog (source_ref text primary key,unit jsonb not null) on commit drop;
insert into _vs_g4_catalog(source_ref,unit)
select 'VS-CUR-G04-MA-2026#'||(unit->>'id'),unit
from jsonb_array_elements($catalog$[{"id":"1.1","strand":"Numbers","title":"Whole Numbers","lessons":20,"outcomes":["Explain the place value and total value of digits through ten-thousands","Read and write numbers through 10,000 in figures and through 1,000 in words","Arrange numbers up to 1,000 in ascending and descending order","Round numbers within 1,000 to the nearest ten","Find factors of numbers up to 50","Identify multiples of numbers up to 100","Distinguish even and odd numbers within 100","Create and explain patterns using even and odd numbers","Match Hindu-Arabic numerals 1 to 10 with Roman numerals I to X","Use whole-number knowledge to solve a familiar practical problem"],"inquiry":["What changes when a digit moves from one place to another?"],"experiences":["Use a place-value chart, number cards and market quantities to order, round and represent numbers."],"resources":"Place-value chart, number cards, local shop price lists","assessment":"Place-value demonstrations, number-card sorting and a practical rounding task"},{"id":"1.2","strand":"Numbers","title":"Addition","lessons":8,"outcomes":["Add two four-digit whole numbers using one regrouping step, keeping the sum within 10,000","Add two four-digit numbers with two regrouping steps and explain carrying","Estimate a sum by rounding each number to the nearest ten","Extend a number pattern based on addition","Solve a real-life problem involving the total of two quantities"],"inquiry":["How can an estimate tell us whether an addition answer is sensible?"],"experiences":["Represent regrouping with counters, add amounts on a classroom shop list and test an estimate."],"resources":"Place-value blocks, counters, abacus, exercise books","assessment":"Worked sums, mental estimates and a two-step shopping total"},{"id":"1.3","strand":"Numbers","title":"Subtraction","lessons":8,"outcomes":["Subtract numbers up to four digits without exchanging","Subtract four-digit numbers when regrouping is needed","Estimate a difference by rounding to the nearest ten","Continue a subtraction number pattern and explain its rule","Find a missing amount or change in a familiar buying problem"],"inquiry":["How can counting back or regrouping help us subtract accurately?"],"experiences":["Model exchange with place-value bundles and calculate change from a Kenyan shilling purchase."],"resources":"Place-value chart, number cards, play money","assessment":"Written subtraction, estimation and a check using addition"},{"id":"1.4","strand":"Numbers","title":"Multiplication","lessons":8,"outcomes":["Multiply a number of at most two digits by a multiple of ten","Multiply a two-digit number by another two-digit number without regrouping","Multiply suitable two-digit numbers when regrouping is necessary","Estimate a product by rounding to tens, keeping the example within 1,000","Continue and describe multiplication patterns with products up to 100"],"inquiry":["What repeated groups make a multiplication problem easier to understand?"],"experiences":["Build arrays of counters, complete multiplication grids and compare an answer with a rounded estimate."],"resources":"Counters, grid paper, multiplication chart","assessment":"Array explanation, correct products and a real-life multiplication problem"},{"id":"1.5","strand":"Numbers","title":"Division","lessons":8,"outcomes":["Divide a two-digit number by a single-digit number without a remainder","Divide a two-digit number by a single-digit number when a remainder occurs","Check a division calculation using multiplication","Interpret the remainder when sharing real objects","Explain how equal groups model a division sentence"],"inquiry":["How do we know whether a remainder should be included in an answer?"],"experiences":["Share counters among small groups, then verify the quotient by multiplying back."],"resources":"Counters, number cards, division chart","assessment":"Practical grouping, quotient and remainder calculations"},{"id":"1.6","strand":"Numbers","title":"Fractions","lessons":6,"outcomes":["Identify the numerator and denominator of a fraction","Represent fractions with denominators up to twelve as parts of a whole or collection","Distinguish proper fractions, improper fractions and mixed numbers","Convert a simple improper fraction into a mixed number","Convert a mixed number into an improper fraction","Use a fraction model to explain a fair share"],"inquiry":["What does the denominator tell us about the size of each equal part?"],"experiences":["Fold paper strips, use counters for shares and convert between a mixed number and an improper fraction."],"resources":"Paper strips, fraction circles, counters","assessment":"Fraction models, conversions and a shared-item problem"},{"id":"1.7","strand":"Numbers","title":"Decimals","lessons":10,"outcomes":["Recognise one tenth and one hundredth in familiar measurements","Write tenths and hundredths using decimal notation","Match fractional tenths and hundredths to decimal representations","Identify the place value of digits to hundredths","Compare and order decimal numbers up to hundredths","Explain an everyday quantity recorded as a decimal"],"inquiry":["Where do we encounter tenths and hundredths when measuring?"],"experiences":["Shade a hundred-square, arrange decimal cards and compare measurements using place-value charts."],"resources":"Hundred-grid, decimal cards, place-value chart","assessment":"Decimal notation, ordering and place-value explanation"},{"id":"1.8","strand":"Numbers","title":"Use of Letters","lessons":6,"outcomes":["Use a letter to stand for a quantity in a practical situation","Translate a simple verbal rule into an expression containing a letter","Combine like terms in an introductory expression","Interpret a letter expression using a concrete example","Explain why a letter can stand for different numbers"],"inquiry":["When does using a letter make a pattern easier to describe?"],"experiences":["Use counters and price labels to create and simplify simple expressions with letters."],"resources":"Counters, cards with letters, simple shopping examples","assessment":"Expression translation, simplification and oral explanation"},{"id":"2.1","strand":"Measurement","title":"Length","lessons":10,"outcomes":["Measure everyday objects in centimetres using a suitable ruler","Estimate and compare lengths before measuring","Explain the relationship between one metre and one hundred centimetres","Convert simple measures between metres and centimetres","Determine the perimeter of a plane figure by adding its sides","Solve addition and subtraction problems involving measured lengths","Use repeated lengths to solve an introductory multiplication problem"],"inquiry":["How can we check that a measurement is accurate?"],"experiences":["Measure desks and exercise books, compare estimates and calculate perimeter from recorded sides."],"resources":"Metre rule, tape measure, string","assessment":"Practical measurements, conversion and perimeter calculation"},{"id":"2.2","strand":"Measurement","title":"Area","lessons":8,"outcomes":["Compare two surfaces by covering or overlapping them","Cover a simple surface using equal square units","Determine the area of a rectangle by counting square units","Find area from the number of equal rows and columns","Calculate the area of a square using its side length","Explain why square units are used for area"],"inquiry":["How can rows and columns help count the area of a surface?"],"experiences":["Cover shapes with paper squares, record rows and columns and connect counting to multiplication."],"resources":"Paper square tiles, squared paper, ruler","assessment":"Practical tiling, row-column calculation and explanation"},{"id":"2.3","strand":"Measurement","title":"Volume","lessons":6,"outcomes":["Arrange equal cubes into a larger cube or cuboid","Count unit cubes in a rectangular arrangement","Calculate the number of cubes in a complete cube or cuboid stack","Explain what the number of unit cubes represents","Compare the volumes of two block constructions"],"inquiry":["Why does counting layers help us find the volume of a stack?"],"experiences":["Build cuboids from unit blocks, count a layer and check the full stack by direct counting."],"resources":"Unit cubes, blocks, safe stacking area","assessment":"Hands-on block model and correct unit-cube count"},{"id":"2.4","strand":"Measurement","title":"Capacity","lessons":6,"outcomes":["Measure the capacity of a container using a one-litre measure","Make and recognise half-litre and quarter-litre quantities","Compare capacities of familiar containers","Add capacities expressed in litres or simple fractions of a litre","Subtract measured capacities to find what remains"],"inquiry":["How can several smaller containers fill one large container?"],"experiences":["Safely pour measured water between one-litre, half-litre and quarter-litre containers."],"resources":"Clean labelled containers, water, tray","assessment":"Practical capacity demonstration and addition or subtraction task"},{"id":"2.5","strand":"Measurement","title":"Mass","lessons":6,"outcomes":["Use a kilogram mass and balance to compare objects","Identify and use half-kilogram and quarter-kilogram measures","Record masses of familiar objects in kilograms","Add quantities measured in kilograms","Subtract masses to calculate a difference","Interpret a simple food-market mass problem"],"inquiry":["Why must we balance the scale before comparing two objects?"],"experiences":["Weigh classroom materials and role-play buying measured food items."],"resources":"Beam balance, one-kilogram and fractional kilogram masses","assessment":"Correct balance use, measurements and mass problems"},{"id":"2.6","strand":"Measurement","title":"Time","lessons":10,"outcomes":["Read times shown on analogue and digital clocks in a.m. and p.m.","Estimate suitable times of familiar school activities","Convert hours to minutes and minutes to hours","Convert days to hours and weeks to days","Record the duration of an activity in hours and minutes","Determine elapsed time between two given times","Use addition or subtraction to solve time-duration problems"],"inquiry":["How can we work out the time between two events?"],"experiences":["Read a timetable, time a classroom activity and compare clock readings."],"resources":"Analogue clock, digital clock, sample timetable","assessment":"Clock reading, time conversions and elapsed-time problem"},{"id":"2.7","strand":"Measurement","title":"Money","lessons":8,"outcomes":["Convert an amount of Kenya shillings to cents and back","Record prices using correct shilling and cent notation","Prepare a shopping list of three items","Calculate the total cost of three items up to KSh 10,000","Determine change from a payment for a small purchase","Explain why checking a shopping total matters"],"inquiry":["How can a shopping list help us plan spending?"],"experiences":["Set up a classroom shop with clearly labelled prices and practise totals and change."],"resources":"Play money, price labels, shopping list","assessment":"Three-item purchase, written total and change"},{"id":"3.1","strand":"Geometry","title":"Position and Direction","lessons":4,"outcomes":["Identify clockwise and anticlockwise turns","Perform a clockwise or anticlockwise turn safely","Demonstrate quarter turns, half turns and full turns","Describe the new direction after a given turn"],"inquiry":["How does the direction of a turn change where we face?"],"experiences":["Follow spoken turning instructions and draw turning arrows in a safe marked space."],"resources":"Clock face, direction arrows, open floor space","assessment":"Observed turns and explanation of direction"},{"id":"3.2","strand":"Geometry","title":"Angles","lessons":4,"outcomes":["Identify an angle formed where two lines meet","Find angles in objects around the classroom","Relate a quarter turn to a right angle","Relate half and full turns to familiar angles","Explain an everyday example of a turn forming an angle"],"inquiry":["Where can we see angles in the objects around us?"],"experiences":["Identify corners and model angle size with paper strips and controlled turns."],"resources":"Paper strips, rulers, classroom objects","assessment":"Angle recognition and practical turning demonstration"},{"id":"3.3","strand":"Geometry","title":"Plane Figures","lessons":6,"outcomes":["Recognise rectangles, squares, triangles, circles and ovals","Draw common plane figures using simple tools","Investigate lines of symmetry by folding shapes","Make repeating patterns from squares, rectangles and triangles","Describe distinguishing properties of triangles, rectangles and squares","Explain which shapes appear in familiar designs"],"inquiry":["How can folding help us discover symmetry?"],"experiences":["Cut and fold paper figures, compare sides and form decorative shape patterns."],"resources":"Shape cut-outs, ruler, paper, safe scissors","assessment":"Shape identification, symmetry fold and pattern creation"},{"id":"4.1","strand":"Data Handling","title":"Data","lessons":8,"outcomes":["Choose practical tools for gathering and recording simple data","Collect up to ten observations in the classroom","Organise observations in a clearly labelled table","Count and record each observed category accurately","Read values from a simple data table","Explain a conclusion supported by recorded observations"],"inquiry":["How can a table help us understand collected information?"],"experiences":["Survey a small set of classroom objects, make tally records and explain the table."],"resources":"Exercise books, pencils, observation cards","assessment":"A completed data table and a spoken interpretation"}]$catalog$::jsonb) unit;

do $preflight$
begin
 if (select count(*) from _vs_g4_catalog)<>19
    or (select sum((unit->>'lessons')::int) from _vs_g4_catalog)<>150
    or (select count(distinct unit->>'strand') from _vs_g4_catalog)<>4
    or (select sum(jsonb_array_length(unit->'outcomes')) from _vs_g4_catalog)<>110
 then raise exception 'GRADE4_MATH_CATALOG_MISMATCH'; end if;
 if (select count(*) from public.subjects where name='Mathematics' and school_id is null and global_subject_id is null)<>1
 then raise exception 'GRADE4_MATH_GLOBAL_SUBJECT_MISSING'; end if;
 if exists (
   select 1 from _vs_g4_catalog t
   join public.subjects sub on sub.name='Mathematics' and sub.school_id is null and sub.global_subject_id is null
   join public.cbc_strands s on s.subject_id=sub.id and s.grade='Grade 4'
      and s.name=t.unit->>'strand' and s.sub_strand=t.unit->>'title'
   where s.source_ref is not null and s.source_ref<>t.source_ref
 ) then raise exception 'GRADE4_MATH_CONFLICTING_EXISTING_SOURCE'; end if;
end;$preflight$;

insert into public.cbc_strands
 (subject_id,grade,name,sub_strand,strand_order,sub_strand_order,
  key_inquiry_questions,suggested_experiences,source_ref)
select sub.id,'Grade 4',t.unit->>'strand',t.unit->>'title',
 split_part(t.unit->>'id','.',1)::int,split_part(t.unit->>'id','.',2)::int,
 array(select jsonb_array_elements_text(t.unit->'inquiry')),
 array(select jsonb_array_elements_text(t.unit->'experiences')),t.source_ref
from _vs_g4_catalog t
join public.subjects sub on sub.name='Mathematics' and sub.school_id is null and sub.global_subject_id is null
on conflict(subject_id,grade,name,sub_strand) do nothing;

insert into public.grade4_mathematics_reader_bindings
 (source_ref,sub_strand_id,source_url,source_version,key_inquiry_questions,suggested_experiences)
select t.source_ref,s.id,'https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf','KICD revised 2024',
 array(select jsonb_array_elements_text(t.unit->'inquiry')),
 array(select jsonb_array_elements_text(t.unit->'experiences'))
from _vs_g4_catalog t
join public.subjects sub on sub.name='Mathematics' and sub.school_id is null and sub.global_subject_id is null
join public.cbc_strands s on s.subject_id=sub.id and s.grade='Grade 4'
 and s.name=t.unit->>'strand' and s.sub_strand=t.unit->>'title'
on conflict(source_ref) do nothing;

insert into public.curriculum_unit_guidance
 (sub_strand_id,suggested_lessons,learning_resources,assessment_methods,competencies,safety_notes,content_status)
select b.sub_strand_id,(t.unit->>'lessons')::int,
 t.unit->>'resources',t.unit->>'assessment',
 'Mathematical reasoning, collaboration, communication and problem solving',
 'Use age-safe practical materials, monitor measurement activities, and supervise digital devices','active'
from _vs_g4_catalog t
join public.grade4_mathematics_reader_bindings b on b.source_ref=t.source_ref
on conflict(sub_strand_id) do nothing;

insert into public.curriculum_learning_outcomes
 (sub_strand_id,outcome_text,outcome_code,source_type,source_ref,status)
select b.sub_strand_id,o.text,
 'VS-G4-MA-'||(t.unit->>'id')||'-'||lpad(o.ordinality::text,2,'0'),
 'creator_claimed',t.source_ref||'/'||o.ordinality,'active'
from _vs_g4_catalog t
join public.grade4_mathematics_reader_bindings b on b.source_ref=t.source_ref
cross join lateral jsonb_array_elements_text(t.unit->'outcomes')
 with ordinality as o(text,ordinality)
where not exists(select 1 from public.curriculum_learning_outcomes existing
 where existing.source_ref=t.source_ref||'/'||o.ordinality);

drop policy if exists grade4_math_original_outcomes_read on public.curriculum_learning_outcomes;
create policy grade4_math_original_outcomes_read on public.curriculum_learning_outcomes
 for select to authenticated using (
  status='active' and source_type='creator_claimed' and created_by is null
  and source_ref like 'VS-CUR-G04-MA-2026#%'
 );
drop policy if exists grade4_math_guidance_read on public.curriculum_unit_guidance;
create policy grade4_math_guidance_read on public.curriculum_unit_guidance
 for select to authenticated using (
  content_status='active' and exists (
   select 1 from public.grade4_mathematics_reader_bindings b
   where b.sub_strand_id=curriculum_unit_guidance.sub_strand_id and b.status='active')
 );

do $verify$
begin
 if (select count(*) from public.grade4_mathematics_reader_bindings where status='active'
     and source_ref like 'VS-CUR-G04-MA-2026#%')<>19
   or (select coalesce(sum(g.suggested_lessons),0) from public.grade4_mathematics_reader_bindings b
     join public.curriculum_unit_guidance g on g.sub_strand_id=b.sub_strand_id and g.content_status='active'
     where b.source_ref like 'VS-CUR-G04-MA-2026#%')<>150
   or (select count(*) from public.curriculum_learning_outcomes o
     where o.source_ref like 'VS-CUR-G04-MA-2026#%' and o.status='active')<>110
 then raise exception 'GRADE4_MATH_PERSISTENCE_INCOMPLETE'; end if;
end;$verify$;

-- Patch the live invoker function rather than replacing it with a stale copy:
-- other grades may have added their own authorization and reading branches.
do $patch$
declare
 definition text;
 old_gate text := $target$  if not found then raise exception 'SCHEME_CURRICULUM_SUBSTRAND_NOT_FOUND'; end if;$target$;
 new_gate text := $replacement$  if not found then
    select * into v_unit from public.cbc_strands s
    where s.id=p_sub_strand_id and s.grade='Grade 4'
      and exists (select 1 from public.grade4_mathematics_reader_bindings b
                  where b.sub_strand_id=s.id and b.status='active');
  end if;
  if not found then raise exception 'SCHEME_CURRICULUM_SUBSTRAND_NOT_FOUND'; end if;$replacement$;
 old_lookup text := $target$  if v_reader_ref is null then
    v_reader_ref:=v_unit.source_ref;$target$;
 new_lookup text := $replacement$  if v_reader_ref is null then
    select b.source_ref,b.key_inquiry_questions,b.suggested_experiences
      into v_reader_ref,v_reader_inquiry,v_reader_experiences
    from public.grade4_mathematics_reader_bindings b
    where b.sub_strand_id=v_unit.id and b.status='active';
  end if;
  if v_reader_ref is null then
    v_reader_ref:=v_unit.source_ref;$replacement$;
begin
 definition:=pg_get_functiondef('public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])'::regprocedure);
 if definition ilike '%security definer%' then raise exception 'SCHEME_INVOKER_AUTHORITY_REQUIRED'; end if;
 if position(old_gate in definition)=0 or position(old_lookup in definition)=0
 then raise exception 'SCHEME_RPC_VERSION_NOT_COMPATIBLE_WITH_GRADE4_PATCH'; end if;
 definition:=replace(replace(definition,old_gate,new_gate),old_lookup,new_lookup);
 execute definition;
end;$patch$;
revoke all on function public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[]) from public,anon;
grant execute on function public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[]) to authenticated;
commit;
