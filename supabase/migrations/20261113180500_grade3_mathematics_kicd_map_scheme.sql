-- Grade 3 Mathematics: structural KICD 2024 reconciliation, VibeSchool-original instructional guides.
-- No official text transcription, automatic teacher Scheme or replacement of historical UUIDs.
-- Legacy non-KICD rows remain intact and outside the Grade 3 bound-reader view.
begin;
create table if not exists public.grade3_mathematics_reader_bindings (
  source_ref text primary key,
  sub_strand_id uuid not null unique references public.cbc_strands(id) on delete restrict,
  source_url text not null,
  source_version text not null,
  key_inquiry_questions text[] not null default '{}',
  suggested_experiences text[] not null default '{}',
  status text not null default 'active' check(status in ('active','archived')),
  created_at timestamptz not null default now()
);
alter table public.grade3_mathematics_reader_bindings enable row level security;
revoke all on public.grade3_mathematics_reader_bindings from public,anon,authenticated;
grant select on public.grade3_mathematics_reader_bindings to authenticated;
drop policy if exists grade3_math_bindings_read on public.grade3_mathematics_reader_bindings;
create policy grade3_math_bindings_read on public.grade3_mathematics_reader_bindings
  for select to authenticated using(status='active');

create temporary table _vs_g3_catalog (source_ref text primary key, unit jsonb not null) on commit drop;
insert into _vs_g3_catalog(source_ref,unit)
select 'VS-CUR-G03-MA-2026#'||unit->>'id',unit
from jsonb_array_elements($catalog$[{"id":"1.1","strand":"Numbers","title":"Number Concept","lessons":8,"outcomes":["Order objects and explain their positions using ordinal numbers up to twentieth.","Name and write ordinal positions in words and symbols.","Apply position words fairly in games and everyday situations."],"inquiry":["How can we describe who comes first, fifth or twentieth?"],"experiences":["Arrange objects by size and mark children's finishing positions in a class game."],"resources":"Objects, ordinal number cards, floor number line","assessment":"Observation, ordering demonstrations and short written responses"},{"id":"1.2","strand":"Numbers","title":"Whole Numbers","lessons":20,"outcomes":["Count forwards and backwards in sensible steps within 1,000.","Show the hundreds, tens and ones values in a three-digit number.","Read, write and complete patterns of whole numbers within 1,000."],"inquiry":["How does a digit's place change its value?"],"experiences":["Build three-digit numbers with bundled sticks and solve missing-number patterns."],"resources":"Place-value chart, bundles, number cards","assessment":"Counting challenge, place-value explanation and pattern completion"},{"id":"1.3","strand":"Numbers","title":"Addition","lessons":25,"outcomes":["Add a three-digit number and a smaller number using a clear place-value method.","Explain how a single regrouping step works in addition.","Use addition to solve a familiar practical problem and check the total."],"inquiry":["What happens to a place-value column when it exceeds nine?"],"experiences":["Use bundles of ten and ones to explain adding quantities, then record steps vertically."],"resources":"Bundles, place-value chart, counters","assessment":"Worked addition calculations and problem-solving checks"},{"id":"1.4","strand":"Numbers","title":"Subtraction","lessons":20,"outcomes":["Subtract whole numbers using place-value models and written methods.","Explain an exchange or regrouping step in a subtraction calculation.","Solve a practical difference problem and check the answer by addition."],"inquiry":["How does exchanging one ten for ten ones help subtraction?"],"experiences":["Model giving change with place-value cards and solve subtraction number stories."],"resources":"Place-value cards, counters, play money","assessment":"Demonstrations, written subtraction and inverse checks"},{"id":"1.5","strand":"Numbers","title":"Multiplication","lessons":10,"outcomes":["Represent multiplication as equal groups and repeated addition.","Multiply single-digit numbers using known facts, arrays and patterns.","Apply multiplication to count equal collections in daily life."],"inquiry":["How can equal groups help us count faster?"],"experiences":["Build small arrays with bottle tops and connect repeated addition to multiplication."],"resources":"Counters, multiplication chart, bottle tops","assessment":"Array models, multiplication facts and contextual questions"},{"id":"1.6","strand":"Numbers","title":"Division","lessons":8,"outcomes":["Represent division by sharing objects into equal groups.","Relate a simple division fact to repeated subtraction or multiplication.","Solve familiar equal-sharing problems using objects or drawings."],"inquiry":["How do we know that a group has been shared equally?"],"experiences":["Share counters among learners and explain each stage of the grouping."],"resources":"Counters, paper circles, number cards","assessment":"Practical sharing, drawings and simple division sentences"},{"id":"1.7","strand":"Numbers","title":"Fractions","lessons":10,"outcomes":["Identify equal parts of a whole or collection.","Represent familiar simple fractions using shapes and objects.","Compare practical fractional shares by explaining the size of equal parts."],"inquiry":["Why must the parts of a fraction be equal?"],"experiences":["Fold paper and share objects into equal parts, then label the fractions."],"resources":"Paper strips, fraction pictures, counters","assessment":"Models, fraction matching and short explanations"},{"id":"2.1","strand":"Measurement","title":"Length","lessons":6,"outcomes":["Estimate and measure everyday lengths using appropriate units and tools.","Record and compare lengths using centimetres and metres where suitable.","Solve a familiar practical question involving measured lengths."],"inquiry":["Why do we choose different units to measure length?"],"experiences":["Measure desks, exercise books and classroom distances, comparing estimates."],"resources":"Ruler, metre rule, string","assessment":"Practical measuring and recorded comparisons"},{"id":"2.2","strand":"Measurement","title":"Mass","lessons":6,"outcomes":["Compare the masses of familiar objects by reasonable estimates.","Measure mass using an appropriate balance and common units.","Interpret measurements of everyday items in practical contexts."],"inquiry":["How can we find out which object has greater mass?"],"experiences":["Estimate and weigh classroom items, then discuss the measured results."],"resources":"Balance, standard masses, packets","assessment":"Weighing demonstration and comparison record"},{"id":"2.3","strand":"Measurement","title":"Capacity","lessons":8,"outcomes":["Compare the amount that common containers can hold.","Measure and record capacity using suitable containers and units.","Solve practical questions about filling and sharing liquid volumes."],"inquiry":["How can we check which container holds more liquid?"],"experiences":["Fill and pour water between labelled containers safely to compare amounts."],"resources":"Litre measure, water, safe bottles","assessment":"Practical measurement and capacity reasoning"},{"id":"2.4","strand":"Measurement","title":"Time","lessons":10,"outcomes":["Read times from appropriate analogue and digital clock displays.","Order common daily events by time and duration.","Solve simple questions about schedules and passing time."],"inquiry":["How can a clock help us plan what to do next?"],"experiences":["Model classroom routines on a toy clock and compare start and finish times."],"resources":"Model clock, timetable cards","assessment":"Time-reading, event ordering and short problems"},{"id":"2.5","strand":"Measurement","title":"Money","lessons":10,"outcomes":["Recognise and combine Kenyan coins and notes in everyday amounts.","Calculate simple totals and change using addition and subtraction.","Choose sensible combinations of money for a classroom buying task."],"inquiry":["How can we check that we receive the correct change?"],"experiences":["Run a supervised pretend shop with price tags and Kenyan shilling money cards."],"resources":"Play Kenyan currency, price tags, coins","assessment":"Role-play purchases, totals and change"},{"id":"3.1","strand":"Geometry","title":"Position and Direction","lessons":5,"outcomes":["Describe where an object is in relation to another object.","Follow and give short directions using positional language.","Use position and direction to explain a simple route."],"inquiry":["Which words help another person find an object?"],"experiences":["Give partner directions along a safe marked path on a class floor plan."],"resources":"Floor plan, arrow cards, objects","assessment":"Direction following and route descriptions"},{"id":"3.2","strand":"Geometry","title":"Shapes","lessons":4,"outcomes":["Recognise and name familiar two-dimensional shapes.","Describe shapes using features such as sides and corners.","Sort and make shapes using simple classroom materials."],"inquiry":["What features can help us identify a shape?"],"experiences":["Sort cut-outs, trace outlines and build shapes with sticks."],"resources":"Shape cut-outs, sticks, paper","assessment":"Shape sorting, feature descriptions and construction"}]$catalog$::jsonb) unit;

do $preflight$
begin
 if (select count(*) from _vs_g3_catalog)<>14 or
    (select sum((unit->>'lessons')::int) from _vs_g3_catalog)<>150 then
    raise exception 'GRADE3_MATH_SOURCE_STRUCTURE_INCOMPLETE';
 end if;
 if (select count(*) from public.subjects
     where id='f430f8b3-9d8d-4845-8904-a3e597191ab6' and name='Mathematics' and school_id is null)<>1
 then raise exception 'GRADE3_MATH_GLOBAL_SUBJECT_MISMATCH'; end if;
 if exists (select 1 from _vs_g3_catalog c join public.cbc_strands s
     on s.subject_id='f430f8b3-9d8d-4845-8904-a3e597191ab6'
      and s.grade='Grade 3' and s.name=c.unit->>'strand' and s.sub_strand=c.unit->>'title'
      where s.source_ref is not null and s.source_ref<>c.source_ref)
 then raise exception 'GRADE3_MATH_SOURCE_IDENTITY_CONFLICT'; end if;
end;$preflight$;

insert into public.cbc_strands(subject_id,grade,name,sub_strand,strand_order,sub_strand_order,source_ref)
select 'f430f8b3-9d8d-4845-8904-a3e597191ab6','Grade 3',
 c.unit->>'strand',c.unit->>'title',split_part(c.unit->>'id','.',1)::int,split_part(c.unit->>'id','.',2)::int,c.source_ref
from _vs_g3_catalog c
on conflict(subject_id,grade,name,sub_strand) do nothing;

update public.cbc_strands s set
 strand_order=split_part(c.unit->>'id','.',1)::int,
 sub_strand_order=split_part(c.unit->>'id','.',2)::int,
 source_ref=coalesce(s.source_ref,c.source_ref)
from _vs_g3_catalog c
where s.subject_id='f430f8b3-9d8d-4845-8904-a3e597191ab6'
 and s.grade='Grade 3' and s.name=c.unit->>'strand' and s.sub_strand=c.unit->>'title';

insert into public.grade3_mathematics_reader_bindings
 (source_ref,sub_strand_id,source_url,source_version,key_inquiry_questions,suggested_experiences)
select c.source_ref,s.id,'https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.3.MATHEMATICS.ACTIVITIES.pdf','KICD revised 2024',
 array(select jsonb_array_elements_text(c.unit->'inquiry')),
 array(select jsonb_array_elements_text(c.unit->'experiences'))
from _vs_g3_catalog c join public.cbc_strands s
 on s.subject_id='f430f8b3-9d8d-4845-8904-a3e597191ab6' and s.grade='Grade 3'
 and s.name=c.unit->>'strand' and s.sub_strand=c.unit->>'title'
on conflict(source_ref) do nothing;

insert into public.curriculum_unit_guidance
 (sub_strand_id,suggested_lessons,learning_resources,assessment_methods,competencies,content_status)
select s.id,(c.unit->>'lessons')::int,c.unit->>'resources',c.unit->>'assessment',
 'VibeSchool original: collaboration, problem solving and numeracy.','active'
from _vs_g3_catalog c join public.cbc_strands s
 on s.subject_id='f430f8b3-9d8d-4845-8904-a3e597191ab6' and s.grade='Grade 3'
 and s.name=c.unit->>'strand' and s.sub_strand=c.unit->>'title'
on conflict(sub_strand_id) do nothing;

insert into public.curriculum_learning_outcomes
 (sub_strand_id,outcome_text,outcome_code,source_type,source_ref,status)
select s.id,o.value,
 'VS-CUR-G03-MA-2026#'||c.unit->>'id'||'-O'||lpad(o.ordinality::text,2,'0'),
 'creator_claimed',c.source_ref||'/OL'||lpad(o.ordinality::text,2,'0'),'active'
from _vs_g3_catalog c join public.cbc_strands s
 on s.subject_id='f430f8b3-9d8d-4845-8904-a3e597191ab6' and s.grade='Grade 3'
 and s.name=c.unit->>'strand' and s.sub_strand=c.unit->>'title'
cross join lateral jsonb_array_elements_text(c.unit->'outcomes') with ordinality as o(value,ordinality)
where not exists (select 1 from public.curriculum_learning_outcomes existing
                  where existing.sub_strand_id=s.id and existing.source_ref=c.source_ref||'/OL'||lpad(o.ordinality::text,2,'0'));

do $verify$
begin
 if (select count(*) from public.grade3_mathematics_reader_bindings b where b.status='active' and b.source_ref like 'VS-CUR-G03-MA-2026#%')<>14
 then raise exception 'GRADE3_MATH_BINDING_COUNT_MISMATCH'; end if;
 if (select coalesce(sum(g.suggested_lessons),0) from public.grade3_mathematics_reader_bindings b join public.curriculum_unit_guidance g on g.sub_strand_id=b.sub_strand_id where b.status='active' and b.source_ref like 'VS-CUR-G03-MA-2026#%')<>150
 then raise exception 'GRADE3_MATH_LESSONS_MISMATCH'; end if;
 if (select count(*) from public.grade3_mathematics_reader_bindings b join public.curriculum_learning_outcomes o on o.sub_strand_id=b.sub_strand_id
   where b.status='active' and b.source_ref like 'VS-CUR-G03-MA-2026#%' and o.source_ref like b.source_ref||'/%'
   and o.status='active' and o.source_type='creator_claimed')<>42
 then raise exception 'GRADE3_MATH_OUTCOMES_MISMATCH'; end if;
end;$verify$;

-- Patch the existing INVOKER Scheme function in place; all existing school assignment,
-- selected week, grade/subject, auth and outcome-selection checks remain unchanged.
do $patch$
declare f text; old_guard text; old_fallback text;
begin
 select pg_get_functiondef(p.oid) into f from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='commit_mapped_scheme_lesson'
   and pg_get_function_identity_arguments(p.oid) like 'p_class_id uuid,%';
 if f is null then raise exception 'GRADE3_MATH_SCHEME_RPC_NOT_FOUND'; end if;
 if position('SCHEME_GRADE3_MATH_CANONICAL_BINDING' in f)=0 then
   old_guard := '  if not found then raise exception ''SCHEME_CURRICULUM_SUBSTRAND_NOT_FOUND''; end if;';
   if position(old_guard in f)=0 then raise exception 'GRADE3_MATH_SCHEME_RPC_GUARD_CHANGED'; end if;
   f:=replace(f,old_guard,
   '  -- SCHEME_GRADE3_MATH_CANONICAL_BINDING'||chr(10)||
   '  if not found then'||chr(10)||
   '    select * into v_unit from public.cbc_strands s'||chr(10)||
   '    where s.id=p_sub_strand_id and s.grade=''Grade 3'''||chr(10)||
   '      and exists (select 1 from public.grade3_mathematics_reader_bindings b'||chr(10)||
   '        where b.sub_strand_id=s.id and b.status=''active'''||chr(10)||
   '          and b.source_ref like ''VS-CUR-G03-MA-2026#%'')'||chr(10)||
   '      and exists (select 1 from public.subjects global_subject'||chr(10)||
   '        where global_subject.id=s.subject_id and global_subject.school_id is null'||chr(10)||
   '          and global_subject.name=''Mathematics'');'||chr(10)||
   '  end if;'||chr(10)||old_guard);
   old_fallback:='  if v_reader_ref is null then'||chr(10)||'    v_reader_ref:=v_unit.source_ref;';
   if position(old_fallback in f)=0 then raise exception 'GRADE3_MATH_SCHEME_READER_FALLBACK_CHANGED'; end if;
   f:=replace(f,old_fallback,
   '  if v_reader_ref is null then'||chr(10)||
   '    select b.source_ref,b.key_inquiry_questions,b.suggested_experiences'||chr(10)||
   '      into v_reader_ref,v_reader_inquiry,v_reader_experiences'||chr(10)||
   '    from public.grade3_mathematics_reader_bindings b'||chr(10)||
   '    where b.sub_strand_id=v_unit.id and b.status=''active'';'||chr(10)||
   '  end if;'||chr(10)||old_fallback);
   execute f;
 end if;
end;$patch$;
commit;
