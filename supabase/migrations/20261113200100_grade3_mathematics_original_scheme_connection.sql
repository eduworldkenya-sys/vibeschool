-- Grade 3 Mathematics original guidance -> existing teacher-authorized canonical Scheme.
-- authorization-test: public.grade3_mathematics_reader_bindings
-- The private verbatim KICD reference is NOT stored in public SQL or GitHub.
-- Safe repeatability: preserve existing cbc_strands IDs, teacher Schemes and student records.
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

create temporary table _vs_grade3_math (source_ref text primary key,unit jsonb not null) on commit drop;
insert into _vs_grade3_math(source_ref,unit)
select 'VS-CUR-G03-MA-2026#'||(unit->>'id'),unit
from jsonb_array_elements('[{"id":"1.1","strand":"Numbers","title":"Number Concept","lessons":8,"outcomes":["Compare the positions of objects and people using order words.","Express positions from first to twentieth using numbers and words."],"experiences":["Arrange a set of numbered objects then explain their positions.","Practise ordinal number cards with a partner."],"inquiry":["How do we describe where an object stands in a group?"],"resources":"Ordinal cards, number cards and safe classroom objects.","assessment":"Observe accurate ordering, naming and symbol use.","competencies":"Communication, collaboration, critical thinking and responsible participation."},{"id":"1.2","strand":"Numbers","title":"Whole Numbers","lessons":20,"outcomes":["Read and form whole numbers within one thousand.","Explain the place value of digits and complete number patterns."],"experiences":["Build and read three-digit numbers on a place-value chart.","Complete number lines and explain the missing values."],"inquiry":["How does the place of a digit affect its value?"],"resources":"Place-value charts, counters and number lines.","assessment":"Check counting, place value and pattern reasoning.","competencies":"Communication, collaboration, critical thinking and responsible participation."},{"id":"1.3","strand":"Numbers","title":"Addition","lessons":25,"outcomes":["Add appropriate whole numbers using objects and written steps.","Solve everyday problems by choosing and checking addition."],"experiences":["Join groups of counters before writing a matching addition.","Explain regrouping on a place-value chart."],"inquiry":["How can we check that an addition answer is reasonable?"],"resources":"Counters, place-value blocks and quantity cards.","assessment":"Check calculation steps and problem interpretation.","competencies":"Communication, collaboration, critical thinking and responsible participation."},{"id":"1.4","strand":"Numbers","title":"Subtraction","lessons":20,"outcomes":["Subtract whole numbers using place-value methods.","Solve real-world remaining-amount and difference problems."],"experiences":["Subtract objects and model the result in symbols.","Explain regrouping with tens and ones."],"inquiry":["How is finding a difference related to taking away?"],"resources":"Counters, number cards and place-value charts.","assessment":"Check subtraction accuracy and explanation.","competencies":"Communication, collaboration, critical thinking and responsible participation."},{"id":"1.5","strand":"Numbers","title":"Multiplication","lessons":10,"outcomes":["Represent equal groups with multiplication statements.","Use basic multiplication facts in everyday grouping problems."],"experiences":["Build equal groups with counters and draw matching arrays.","Relate skip counting to multiplication."],"inquiry":["How can equal groups help us multiply?"],"resources":"Counters, multiplication arrays and squared paper.","assessment":"Check equal groups and multiplication statements.","competencies":"Communication, collaboration, critical thinking and responsible participation."},{"id":"1.6","strand":"Numbers","title":"Division","lessons":8,"outcomes":["Share collections into equal groups and record division.","Check simple division calculations by multiplication."],"experiences":["Share counters fairly into different sets.","Check grouping using related multiplication facts."],"inquiry":["What makes sharing equal?"],"resources":"Counters, bowls and grouping mats.","assessment":"Observe sharing, grouping and related facts.","competencies":"Communication, collaboration, critical thinking and responsible participation."},{"id":"1.7","strand":"Numbers","title":"Fractions","lessons":10,"outcomes":["Identify equal fractional parts in shapes and collections.","Describe and compare common unit fractions using models."],"experiences":["Fold paper into equal pieces to show fractions.","Compare fraction strips of equal-sized wholes."],"inquiry":["Why must parts of one whole be equal?"],"resources":"Paper strips, fraction shapes and counters.","assessment":"Check equal partitioning, fraction names and comparisons.","competencies":"Communication, collaboration, critical thinking and responsible participation."},{"id":"2.1","strand":"Measurement","title":"Length","lessons":6,"outcomes":["Measure familiar lengths with suitable standard units.","Compare lengths and explain the choice of measuring tool."],"experiences":["Measure classroom objects using rulers or tapes.","Compare estimates with actual measurements."],"inquiry":["How do we measure length fairly?"],"resources":"Rulers, measuring tapes and safe objects.","assessment":"Observe measuring techniques and appropriate units.","competencies":"Communication, collaboration, critical thinking and responsible participation."},{"id":"2.2","strand":"Measurement","title":"Mass","lessons":6,"outcomes":["Compare and measure the mass of everyday objects.","Interpret simple mass measures and their units."],"experiences":["Compare masses with a safe balance.","Read and sort labelled package weights."],"inquiry":["Which unit is useful for this mass?"],"resources":"Balances, sample labelled weights and common objects.","assessment":"Check mass comparisons, measurements and units.","competencies":"Communication, collaboration, critical thinking and responsible participation."},{"id":"2.3","strand":"Measurement","title":"Capacity","lessons":8,"outcomes":["Compare the amounts held by different containers.","Measure capacity in appropriate units and record the results."],"experiences":["Measure water with clean marked containers.","Test predictions about which jug holds more."],"inquiry":["How can we compare how much containers hold?"],"resources":"Clean water, graduated containers and trays.","assessment":"Check marked readings and capacity comparisons.","competencies":"Communication, collaboration, critical thinking and responsible participation."},{"id":"2.4","strand":"Measurement","title":"Time","lessons":10,"outcomes":["Read familiar times on clock faces.","Use times and sequences to discuss daily routines."],"experiences":["Show different times on an analogue clock model.","Order routine cards and compare durations."],"inquiry":["How do clocks help us plan activities?"],"resources":"Clock models, calendars and routine pictures.","assessment":"Check clock readings and ordered daily activities.","competencies":"Communication, collaboration, critical thinking and responsible participation."},{"id":"2.5","strand":"Measurement","title":"Money","lessons":10,"outcomes":["Recognise Kenyan currency denominations and prices.","Combine money amounts in simple buying and selling situations."],"experiences":["Run a pretend shop with price tags and currency images.","Work out totals for everyday shopping examples."],"inquiry":["How can we tell whether money is enough to pay?"],"resources":"Current Kenyan currency images, replicas and price cards.","assessment":"Check recognition, money totals and simple transactions.","competencies":"Communication, collaboration, critical thinking and responsible participation."},{"id":"3.1","strand":"Geometry","title":"Position and Direction","lessons":5,"outcomes":["Use location and directional language to describe a route.","Follow and explain short movement instructions."],"experiences":["Draw a simple route and direct a partner safely.","Place objects according to a given directional instruction."],"inquiry":["What words give clear directions?"],"resources":"Floor markers and route drawings.","assessment":"Observe accurate directions and route descriptions.","competencies":"Communication, collaboration, critical thinking and responsible participation."},{"id":"3.2","strand":"Geometry","title":"Shapes","lessons":4,"outcomes":["Recognise common two-dimensional and three-dimensional shapes.","Classify shapes by their visible properties."],"experiences":["Sort shape cards by common features.","Build a simple model from familiar solids."],"inquiry":["Which features help us recognise a shape?"],"resources":"Shape cards, blocks and cartons.","assessment":"Check naming, sorting and explanation of shapes.","competencies":"Communication, collaboration, critical thinking and responsible participation."}]'::jsonb) unit;

do $g3_preflight$
begin
  if (select count(*) from _vs_grade3_math)<>14
     or (select sum((unit->>'lessons')::integer) from _vs_grade3_math)<>150
     or (select sum(jsonb_array_length(unit->'outcomes')) from _vs_grade3_math)<>28
  then raise exception 'GRADE3_MATH_CATALOG_MISMATCH'; end if;
  if (select count(*) from public.subjects where name='Mathematics' and school_id is null and global_subject_id is null)<>1
  then raise exception 'GRADE3_MATH_GLOBAL_SUBJECT_MISSING'; end if;
  if exists(
    select 1 from _vs_grade3_math t
    join public.cbc_strands s
      on s.subject_id=(select id from public.subjects where name='Mathematics' and school_id is null and global_subject_id is null)
     and s.grade='Grade 3'
     and s.name=t.unit->>'strand' and s.sub_strand=t.unit->>'title'
    where s.source_ref is not null
      and s.source_ref<>t.source_ref
  ) then raise exception 'GRADE3_MATH_CONFLICTING_EXISTING_SOURCE'; end if;
end;
$g3_preflight$;

insert into public.cbc_strands(subject_id,grade,name,sub_strand,strand_order,sub_strand_order)
select (select id from public.subjects where name='Mathematics' and school_id is null and global_subject_id is null), 'Grade 3',
  t.unit->>'strand',t.unit->>'title',
  split_part(t.unit->>'id','.',1)::integer,
  split_part(t.unit->>'id','.',2)::integer
from _vs_grade3_math t
on conflict(subject_id,grade,name,sub_strand) do nothing;

insert into public.grade3_mathematics_reader_bindings(
  source_ref,sub_strand_id,source_url,source_version,key_inquiry_questions,suggested_experiences
)
select t.source_ref,s.id,'https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.3.MATHEMATICS.ACTIVITIES.pdf','2024',
  array(select jsonb_array_elements_text(t.unit->'inquiry')),
  array(select jsonb_array_elements_text(t.unit->'experiences'))
from _vs_grade3_math t
join public.cbc_strands s
  on s.grade='Grade 3'
 and s.subject_id=(select id from public.subjects where name='Mathematics' and school_id is null and global_subject_id is null)
 and s.name=t.unit->>'strand' and s.sub_strand=t.unit->>'title'
on conflict(source_ref) do nothing;

insert into public.curriculum_unit_guidance(
 sub_strand_id,suggested_lessons,learning_resources,assessment_methods,
 competencies,content_status
)
select b.sub_strand_id,(t.unit->>'lessons')::integer,t.unit->>'resources',
  t.unit->>'assessment',t.unit->>'competencies','active'
from _vs_grade3_math t
join public.grade3_mathematics_reader_bindings b on b.source_ref=t.source_ref
on conflict(sub_strand_id) do nothing;

insert into public.curriculum_learning_outcomes(
 sub_strand_id,outcome_code,outcome_text,source_type,source_ref,status
)
select b.sub_strand_id,
  t.source_ref||'/O'||lpad(x.ordinality::text,2,'0'),
  x.value,'creator_claimed',
  t.source_ref||'/O'||lpad(x.ordinality::text,2,'0'),
  'active'
from _vs_grade3_math t
join public.grade3_mathematics_reader_bindings b on b.source_ref=t.source_ref
cross join lateral jsonb_array_elements_text(t.unit->'outcomes') with ordinality as x(value,ordinality)
where not exists (
 select 1 from public.curriculum_learning_outcomes o
 where o.source_ref=t.source_ref||'/O'||lpad(x.ordinality::text,2,'0')
);

drop policy if exists grade3_math_original_outcomes_read on public.curriculum_learning_outcomes;
create policy grade3_math_original_outcomes_read
 on public.curriculum_learning_outcomes for select to authenticated
 using(status='active' and source_type='creator_claimed'
   and source_ref like 'VS-CUR-G03-MA-2026#%');
drop policy if exists grade3_math_original_guidance_read on public.curriculum_unit_guidance;
create policy grade3_math_original_guidance_read
 on public.curriculum_unit_guidance for select to authenticated
 using(content_status='active' and exists(
  select 1 from public.grade3_mathematics_reader_bindings b
  where b.sub_strand_id=curriculum_unit_guidance.sub_strand_id
    and b.status='active'));

do $g3_verify$
begin
 if (select count(*) from public.grade3_mathematics_reader_bindings where source_ref like 'VS-CUR-G03-MA-2026#%' and status='active')<>14
    or (select coalesce(sum(g.suggested_lessons),0)
       from public.grade3_mathematics_reader_bindings b
       join public.curriculum_unit_guidance g on g.sub_strand_id=b.sub_strand_id and g.content_status='active'
       where b.source_ref like 'VS-CUR-G03-MA-2026#%')<>150
    or (select count(*) from public.curriculum_learning_outcomes o
       where o.source_ref like 'VS-CUR-G03-MA-2026#%' and o.status='active' and o.source_type='creator_claimed')<>28
 then raise exception 'GRADE3_MATH_PERSISTENCE_INCOMPLETE'; end if;
end;$g3_verify$;

-- Extend the SAME canonical invoker-RPC without overwriting other grade branches.
-- Anchors deliberately fail closed if concurrent migrations changed the contract.
do $g3_scheme_patch$
declare
  v text;
  gate_old text := $gate_old$
  -- SCHEME_GRADE9_ENGLISH_READER_ACTIVE: only existing exact-heading source identities.
$gate_old$;
  gate_new text := $gate_new$
  -- SCHEME_GRADE3_MATH_READER_ACTIVE
  if not found then
    select * into v_unit from public.cbc_strands s
    where s.id=p_sub_strand_id and s.grade='Grade 3'
      and exists(select 1 from public.grade3_mathematics_reader_bindings b
                 where b.sub_strand_id=s.id and b.status='active');
  end if;
  -- SCHEME_GRADE9_ENGLISH_READER_ACTIVE: only existing exact-heading source identities.
$gate_new$;
  reader_old text := $reader_old$
  if v_reader_ref is null then
    v_reader_ref:=v_unit.source_ref;
$reader_old$;
  reader_new text := $reader_new$
  if v_reader_ref is null then
    select b.source_ref,b.key_inquiry_questions,b.suggested_experiences
      into v_reader_ref,v_reader_inquiry,v_reader_experiences
    from public.grade3_mathematics_reader_bindings b
    where b.sub_strand_id=v_unit.id and b.status='active';
  end if;
  if v_reader_ref is null then
    v_reader_ref:=v_unit.source_ref;
$reader_new$;
  completeness_old text := 'if v_unit.grade=''Grade 9'' and (';
  completeness_new text := 'if v_unit.grade in (''Grade 9'',''Grade 3'') and (';
  alias_old text := $alias_old$
  if (v_global_subject is distinct from v_unit.subject_id
$alias_old$;
  alias_new text := $alias_new$
  -- Only Grade 3 Mathematical Activities is an accepted alias of global Mathematics.
  if v_unit.grade='Grade 3'
     and v_global_subject=(select id from public.subjects where name='Mathematical Activities' and school_id is null and global_subject_id is null)
     and v_unit.subject_id=(select id from public.subjects where name='Mathematics' and school_id is null and global_subject_id is null)
  then
    v_global_subject:=v_unit.subject_id;
  end if;
  if (v_global_subject is distinct from v_unit.subject_id
$alias_new$;
begin
  select pg_get_functiondef('public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])'::regprocedure)
    into v;
  if v is null or position('security definer' in lower(v))>0
     then raise exception 'GRADE3_MATH_INVOKER_AUTHORITY_REQUIRED'; end if;
  if position('SCHEME_GRADE3_MATH_READER_ACTIVE' in v)=0 then
    if position(gate_old in v)=0 or position(reader_old in v)=0
       or (position(completeness_old in v)=0 and position(completeness_new in v)=0)
       or position(alias_old in v)=0
    then raise exception 'GRADE3_MATH_SCHEME_RPC_DRIFT gate=% reader=% completeness_old=% completeness_new=% alias=%', position(gate_old in v), position(reader_old in v), position(completeness_old in v), position(completeness_new in v), position(alias_old in v); end if;
    v:=replace(v,gate_old,gate_new);
    v:=replace(v,reader_old,reader_new);
    if position(completeness_old in v)>0 then
      v:=replace(v,completeness_old,completeness_new);
    end if;
    v:=replace(v,alias_old,alias_new);
    execute v;
  end if;
end;$g3_scheme_patch$;
revoke all on function public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[]) from public,anon;
grant execute on function public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[]) to authenticated;

do $g3_scheme_verify$
begin
 if (select p.prosecdef from pg_proc p
     where p.oid='public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])'::regprocedure)
   or has_function_privilege('anon','public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])','EXECUTE')
   or not has_function_privilege('authenticated','public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])','EXECUTE')
   or position('SCHEME_GRADE3_MATH_READER_ACTIVE' in
     pg_get_functiondef('public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])'::regprocedure))=0
 then raise exception 'GRADE3_MATH_SCHEME_RPC_AUTHORITY_DRIFT'; end if;
end;$g3_scheme_verify$;
commit;
