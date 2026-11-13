-- Grade 3 English: source-indexed, VibeSchool-original content → canonical Scheme.
-- 2024 KICD Grade 3 summary: 4 strands / 10 sub-strands / 150 suggested lessons.
-- Outcomes and guidance are VibeSchool-original (creator_claimed), NOT a verbatim KICD copy.
-- No school terms/weeks, teacher schemes, or existing legacy rows are altered.
begin;
create table if not exists public.grade3_english_reader_bindings (
  source_ref text primary key check(source_ref like 'VS-CUR-G03-EN-2026#%'),
  sub_strand_id uuid not null unique references public.cbc_strands(id) on delete restrict,
  key_inquiry_questions text[] not null,
  suggested_experiences text[] not null,
  status text not null default 'active' check(status in ('active','archived')),
  created_at timestamptz not null default now()
);
alter table public.grade3_english_reader_bindings enable row level security;
revoke all on public.grade3_english_reader_bindings from public,anon,authenticated;
grant select on public.grade3_english_reader_bindings to authenticated;
drop policy if exists grade3_english_reader_bindings_read on public.grade3_english_reader_bindings;
create policy grade3_english_reader_bindings_read on public.grade3_english_reader_bindings
  for select to authenticated using(status='active');

create temporary table _grade3_en (source_ref text primary key,unit jsonb not null) on commit drop;
insert into _grade3_en(source_ref,unit)
select x->>'source_ref',x from jsonb_array_elements($grade3_original$[{"source_ref":"VS-CUR-G03-EN-2026#1.1","id":"1.1","strand":"Listening and Speaking","title":"Pronunciation and vocabulary","canonical_title":"Pronunciation and Vocabulary","lessons":30,"outcomes":["Speak clearly when naming familiar places, activities and objects in a short conversation.","Choose appropriate topic words to describe an everyday experience.","Listen to a spoken story and respond to questions about its key points."],"inquiry":["How do clear sounds help a listener understand us?","When is a new word useful?"],"experiences":["Practise an original dialogue in pairs using picture prompts.","Listen to a short read-aloud, then retell the main events.","Describe familiar school activities in a circle conversation."],"resources":"Original scripts, picture-word cards, short read-aloud audio.","assessment":"Clear speech, appropriate vocabulary and attentive listening.","competencies":"Communication, collaboration, critical thinking and self-efficacy, as appropriate.","safety":"Differentiate tasks; teach grammar implicitly and avoid testing formal grammatical labels."},{"source_ref":"VS-CUR-G03-EN-2026#2.1","id":"2.1","strand":"Reading","title":"Fluency","canonical_title":"Fluency","lessons":30,"outcomes":["Read a short grade-appropriate passage accurately and meaningfully.","Pause naturally at sentence boundaries when reading aloud.","Improve reading accuracy and expression through supported rereading."],"inquiry":["What helps a reader sound clear?","How does a second reading improve the first?"],"experiences":["Listen to a model reading and mark helpful pauses.","Read an original short passage twice with partner feedback.","Practise familiar and new words before reading the whole paragraph."],"resources":"Original short texts, word cards, large-print strips and optional audio.","assessment":"Reading accuracy, intelligible pace, expression and improvement.","competencies":"Communication, collaboration, critical thinking and self-efficacy, as appropriate.","safety":"Differentiate tasks; teach grammar implicitly and avoid testing formal grammatical labels."},{"source_ref":"VS-CUR-G03-EN-2026#2.2","id":"2.2","strand":"Reading","title":"Comprehension","canonical_title":"Comprehension","lessons":30,"outcomes":["Locate important characters, places and events in a short written passage.","Explain a simple idea using relevant details from a story.","Give a reasoned prediction about what might happen next."],"inquiry":["Which clues help us understand a passage?","How do we support an answer with a detail?"],"experiences":["Sequence pictures from a short original story.","Answer questions and point to relevant sentences.","Predict the ending of a short paragraph and explain the clues."],"resources":"Original short stories, informational passages and picture cards.","assessment":"Accurate details, inference and supported explanations.","competencies":"Communication, collaboration, critical thinking and self-efficacy, as appropriate.","safety":"Differentiate tasks; teach grammar implicitly and avoid testing formal grammatical labels."},{"source_ref":"VS-CUR-G03-EN-2026#3.1","id":"3.1","strand":"Language Use","title":"Word classes","canonical_title":"Word classes","lessons":18,"outcomes":["Choose words naming familiar people, objects and actions naturally in meaningful sentences.","Add suitable describing words to make a spoken message clearer.","Create short understandable sentences from picture prompts."],"inquiry":["What words make a description clear?","How can replacing one word change a message?"],"experiences":["Describe an everyday scene using age-appropriate words.","Use sentence strips to make contextual messages.","Act out and orally vary short descriptions."],"resources":"Picture scenes, word and sentence cards, original dialogues.","assessment":"Clear contextual language choices without formal word-class labels.","competencies":"Communication, collaboration, critical thinking and self-efficacy, as appropriate.","safety":"Differentiate tasks; teach grammar implicitly and avoid testing formal grammatical labels."},{"source_ref":"VS-CUR-G03-EN-2026#3.2","id":"3.2","strand":"Language Use","title":"Tense","canonical_title":"Tense","lessons":8,"outcomes":["Describe familiar events occurring now, earlier and later using suitable short sentences.","Sequence events in an understandable spoken account.","Revise an unclear time reference in a short message."],"inquiry":["How do listeners know when an event happened?","How can we arrange events clearly?"],"experiences":["Tell a three-picture story using before, now and later.","Compare two accounts of the same event.","Describe yesterday's and tomorrow's activities orally."],"resources":"Picture sequences, event cards and original short dialogues.","assessment":"Clear time meaning in age-appropriate communication.","competencies":"Communication, collaboration, critical thinking and self-efficacy, as appropriate.","safety":"Differentiate tasks; teach grammar implicitly and avoid testing formal grammatical labels."},{"source_ref":"VS-CUR-G03-EN-2026#3.3","id":"3.3","strand":"Language Use","title":"Word structures","canonical_title":"Word structures","lessons":4,"outcomes":["Use everyday related-word forms appropriately in meaningful short sentences.","Notice how a word changes meaning when its familiar form changes.","Compare two related words using an example from everyday life."],"inquiry":["How can a small word change affect meaning?","Where do we use related words?"],"experiences":["Sort familiar related-word cards by meaning.","Choose word forms in short original sentences.","Discuss how a changed word affects a simple dialogue."],"resources":"Word-family cards, pictures and original short sentences.","assessment":"Meaningful language use without formal grammatical labels.","competencies":"Communication, collaboration, critical thinking and self-efficacy, as appropriate.","safety":"Differentiate tasks; teach grammar implicitly and avoid testing formal grammatical labels."},{"source_ref":"VS-CUR-G03-EN-2026#4.1","id":"4.1","strand":"Writing","title":"Handwriting","canonical_title":"Handwriting","lessons":10,"outcomes":["Form readable letters and words with suitable spacing.","Write a neat, legible short message in complete sentences.","Improve an unclear word or line after feedback."],"inquiry":["What makes a message easy to read?","How do we check word spacing?"],"experiences":["Copy a clear sentence and explain its spacing.","Write a short original class notice independently.","Revise one unclear line using a partner's feedback."],"resources":"Lined paper, legible letter models and accessible writing grips.","assessment":"Legibility, word spacing and improvement.","competencies":"Communication, collaboration, critical thinking and self-efficacy, as appropriate.","safety":"Differentiate tasks; teach grammar implicitly and avoid testing formal grammatical labels."},{"source_ref":"VS-CUR-G03-EN-2026#4.2","id":"4.2","strand":"Writing","title":"Spelling","canonical_title":"Spelling","lessons":6,"outcomes":["Spell familiar topic words with growing accuracy.","Use known sound patterns when attempting a new word.","Check and correct selected words in a short written message."],"inquiry":["How can we check the spelling of a word?","What clues help us spell a new word?"],"experiences":["Build useful topic words with letter tiles.","Write and review an original short message.","Use a word bank to correct spelling in context."],"resources":"Letter cards, word banks, picture prompts and simple dictionaries.","assessment":"Contextual spelling accuracy and correction.","competencies":"Communication, collaboration, critical thinking and self-efficacy, as appropriate.","safety":"Differentiate tasks; teach grammar implicitly and avoid testing formal grammatical labels."},{"source_ref":"VS-CUR-G03-EN-2026#4.3","id":"4.3","strand":"Writing","title":"Punctuation","canonical_title":"Punctuation","lessons":4,"outcomes":["Use capitals and full stops to mark meaningful statements.","Use a question mark in an everyday written question.","Edit short writing to make sentence boundaries clear."],"inquiry":["Where does a sentence begin and end?","How does a written question look?"],"experiences":["Compare readable and unpunctuated original messages.","Build short sentences with punctuation cards.","Revise a short invitation or notice."],"resources":"Punctuation cards, sentence strips and original short messages.","assessment":"Appropriate capitals, full stops and questions.","competencies":"Communication, collaboration, critical thinking and self-efficacy, as appropriate.","safety":"Differentiate tasks; teach grammar implicitly and avoid testing formal grammatical labels."},{"source_ref":"VS-CUR-G03-EN-2026#4.4","id":"4.4","strand":"Writing","title":"Guided Writing","canonical_title":"Guided Writing","lessons":10,"outcomes":["Plan a short story or description from familiar picture prompts.","Write connected sentences in a logical order.","Improve a draft by revising detail, spelling or punctuation."],"inquiry":["What helps a reader follow our writing?","How can a plan improve a first draft?"],"experiences":["Sequence pictures before drafting an original story.","Use sentence starters to write a short description.","Share supportive feedback and improve the final draft."],"resources":"Original picture prompts, planners, checklists and learner notebooks.","assessment":"Clarity, organisation, meaningful detail and revision.","competencies":"Communication, collaboration, critical thinking and self-efficacy, as appropriate.","safety":"Differentiate tasks; teach grammar implicitly and avoid testing formal grammatical labels."}]$grade3_original$::jsonb) x;

do $preflight$
declare v_global uuid;
begin
  if (select count(*) from _grade3_en)<>10
     or (select sum((unit->>'lessons')::int) from _grade3_en)<>150
     or (select sum(jsonb_array_length(unit->'outcomes')) from _grade3_en)<>30
     or exists(select 1 from _grade3_en
       where jsonb_array_length(unit->'inquiry')<1 or jsonb_array_length(unit->'experiences')<1
         or btrim(unit->>'resources')='' or btrim(unit->>'assessment')='')
  then raise exception 'GRADE3_ENGLISH_ORIGINAL_CATALOG_INCOMPLETE'; end if;
  select id into strict v_global from public.subjects
    where name='English' and school_id is null and global_subject_id is null;
  if exists(select 1 from _grade3_en t
    join public.cbc_strands s on s.subject_id=v_global and s.grade='Grade 3'
      and s.name=t.unit->>'strand' and s.sub_strand=t.unit->>'canonical_title'
    where s.source_ref is not null and s.source_ref<>t.source_ref)
  then raise exception 'GRADE3_ENGLISH_EXISTING_SOURCE_CONFLICT'; end if;
end;
$preflight$;

-- Reuse exact named legacy Handwriting and the explicit case-only
-- Pronunciation and Vocabulary alias without changing their metadata.
insert into public.cbc_strands
(subject_id,grade,name,sub_strand,strand_order,sub_strand_order,
 key_inquiry_questions,suggested_experiences,source_ref)
select s.id,'Grade 3',t.unit->>'strand',t.unit->>'canonical_title',
 split_part(t.unit->>'id','.',1)::integer,split_part(t.unit->>'id','.',2)::integer,
 array(select jsonb_array_elements_text(t.unit->'inquiry')),
 array(select jsonb_array_elements_text(t.unit->'experiences')),t.source_ref
from _grade3_en t
join public.subjects s on s.name='English' and s.school_id is null and s.global_subject_id is null
on conflict (subject_id,grade,name,sub_strand) do nothing;

insert into public.grade3_english_reader_bindings
(source_ref,sub_strand_id,key_inquiry_questions,suggested_experiences)
select t.source_ref,x.id,
 array(select jsonb_array_elements_text(t.unit->'inquiry')),
 array(select jsonb_array_elements_text(t.unit->'experiences'))
from _grade3_en t
join public.subjects s on s.name='English' and s.school_id is null and s.global_subject_id is null
join public.cbc_strands x on x.subject_id=s.id and x.grade='Grade 3'
 and x.name=t.unit->>'strand' and x.sub_strand=t.unit->>'canonical_title'
on conflict (source_ref) do nothing;

insert into public.curriculum_unit_guidance
(sub_strand_id,suggested_lessons,learning_resources,assessment_methods,
 competencies,safety_notes,content_status)
select b.sub_strand_id,(t.unit->>'lessons')::integer,t.unit->>'resources',
 t.unit->>'assessment',t.unit->>'competencies',t.unit->>'safety','active'
from _grade3_en t
join public.grade3_english_reader_bindings b on b.source_ref=t.source_ref
on conflict (sub_strand_id) do nothing;

insert into public.curriculum_learning_outcomes
(sub_strand_id,outcome_text,outcome_code,source_type,source_ref,status)
select b.sub_strand_id,o.text,
 'VS-G3-EN-'||(t.unit->>'id')||'-'||lpad(o.ordinality::text,2,'0'),
 'creator_claimed',t.source_ref||'/'||o.ordinality::text,'active'
from _grade3_en t
join public.grade3_english_reader_bindings b on b.source_ref=t.source_ref
cross join lateral jsonb_array_elements_text(t.unit->'outcomes')
  with ordinality as o(text,ordinality)
where not exists(select 1 from public.curriculum_learning_outcomes existing
 where existing.source_ref=t.source_ref||'/'||o.ordinality::text);

drop policy if exists grade3_english_original_outcomes_read on public.curriculum_learning_outcomes;
create policy grade3_english_original_outcomes_read on public.curriculum_learning_outcomes
 for select to authenticated using(
   status='active' and source_type='creator_claimed' and created_by is null
   and source_ref like 'VS-CUR-G03-EN-2026#%'
 );
drop policy if exists grade3_english_guidance_read on public.curriculum_unit_guidance;
create policy grade3_english_guidance_read on public.curriculum_unit_guidance
 for select to authenticated using (
   content_status='active' and exists(
     select 1 from public.grade3_english_reader_bindings b
     where b.sub_strand_id=curriculum_unit_guidance.sub_strand_id and b.status='active'
   )
 );

do $verify_catalog$
declare v_global uuid;
begin
 select id into strict v_global from public.subjects
 where name='English' and school_id is null and global_subject_id is null;
 if (select count(*) from public.grade3_english_reader_bindings
     where source_ref like 'VS-CUR-G03-EN-2026#%' and status='active')<>10
    or (select count(*) from public.curriculum_learning_outcomes
      where source_ref like 'VS-CUR-G03-EN-2026#%' and status='active' and source_type='creator_claimed')<>30
    or (select sum(g.suggested_lessons) from public.curriculum_unit_guidance g
      join public.grade3_english_reader_bindings b on b.sub_strand_id=g.sub_strand_id
      where b.source_ref like 'VS-CUR-G03-EN-2026#%' and g.content_status='active')<>150
    or exists(select 1 from _grade3_en t
      left join public.grade3_english_reader_bindings b on b.source_ref=t.source_ref and b.status='active'
      left join public.cbc_strands s on s.id=b.sub_strand_id
      left join public.curriculum_unit_guidance g on g.sub_strand_id=s.id
      where b.sub_strand_id is null or s.subject_id<>v_global or s.grade<>'Grade 3'
        or s.name<>t.unit->>'strand' or s.sub_strand<>t.unit->>'canonical_title'
        or g.sub_strand_id is null or g.content_status<>'active' or g.suggested_lessons<>(t.unit->>'lessons')::integer
        or btrim(coalesce(g.learning_resources,''))='' or btrim(coalesce(g.assessment_methods,''))=''
        or (select count(*) from public.curriculum_learning_outcomes o
            where o.sub_strand_id=b.sub_strand_id
              and o.source_ref like t.source_ref||'/%'
              and o.status='active' and o.source_type='creator_claimed')<>3
    )
 then raise exception 'GRADE3_ENGLISH_PERSISTED_BINDINGS_INCOMPLETE'; end if;
end;
$verify_catalog$;

-- Dynamic patch must match the live invoker function exactly and fail closed on drift.
-- No new Scheme engine and no privileged writes are introduced.
do $patch_grade3_scheme$
declare
 v_definition text;
 v_gate_old text:=$old_gate$  if not found then raise exception 'SCHEME_CURRICULUM_SUBSTRAND_NOT_FOUND'; end if;$old_gate$;
 v_gate_new text:=$new_gate$  -- SCHEME_GRADE3_ENGLISH_CANONICAL_BINDING
  if not found then
    select * into v_unit from public.cbc_strands s
    where s.id=p_sub_strand_id and s.grade='Grade 3'
      and exists (select 1 from public.grade3_english_reader_bindings b
        where b.sub_strand_id=s.id and b.status='active'
          and b.source_ref like 'VS-CUR-G03-EN-2026#%')
      and exists (select 1 from public.subjects global_subject
        where global_subject.id=s.subject_id
          and global_subject.school_id is null and global_subject.name='English');
  end if;
  if not found then raise exception 'SCHEME_CURRICULUM_SUBSTRAND_NOT_FOUND'; end if;$new_gate$;
 v_reader_old text:=$old_reader$  if v_reader_ref is null then
    v_reader_ref:=v_unit.source_ref;$old_reader$;
 v_reader_new text:=$new_reader$  if v_reader_ref is null then
    select b.source_ref,b.key_inquiry_questions,b.suggested_experiences
      into v_reader_ref,v_reader_inquiry,v_reader_experiences
    from public.grade3_english_reader_bindings b
    where b.sub_strand_id=v_unit.id and b.status='active';
  end if;
  if v_reader_ref is null then
    v_reader_ref:=v_unit.source_ref;$new_reader$;
 v_guide_old text:=$old_guide$if v_unit.grade='Grade 9' and ($old_guide$;
 v_guide_new text:=$new_guide$if v_unit.grade in ('Grade 9','Grade 3') and ($new_guide$;
begin
 select pg_get_functiondef('public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])'::regprocedure)
 into v_definition;
 if v_definition is null then raise exception 'GRADE3_ENGLISH_SCHEME_RPC_MISSING'; end if;
 if (select prosecdef from pg_proc
     where oid='public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])'::regprocedure)
 then raise exception 'SCHEME_INVOKER_AUTHORITY_REQUIRED'; end if;
 if position('SCHEME_GRADE3_ENGLISH_CANONICAL_BINDING' in v_definition)=0 then
   if position(v_gate_old in v_definition)=0 or position(v_reader_old in v_definition)=0
      or position(v_guide_old in v_definition)=0
   then raise exception 'GRADE3_ENGLISH_SCHEME_RPC_AUTHORITY_DRIFT'; end if;
   v_definition:=replace(v_definition,v_gate_old,v_gate_new);
   v_definition:=replace(v_definition,v_reader_old,v_reader_new);
   v_definition:=replace(v_definition,v_guide_old,v_guide_new);
   execute v_definition;
 else
   if position('public.grade3_english_reader_bindings' in v_definition)=0
      or position('SCHEME_CANONICAL_CONTENT_INCOMPLETE' in v_definition)=0
   then raise exception 'GRADE3_ENGLISH_SCHEME_RPC_PARTIAL_PATCH'; end if;
 end if;
end;
$patch_grade3_scheme$;
revoke all on function public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[]) from public,anon;
grant execute on function public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[]) to authenticated;
do $verify_rpc$
begin
 if (select prosecdef from pg_proc
       where oid='public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])'::regprocedure)
    or has_function_privilege('anon','public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])','EXECUTE')
    or not has_function_privilege('authenticated','public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])','EXECUTE')
    or position('SCHEME_GRADE3_ENGLISH_CANONICAL_BINDING' in
       pg_get_functiondef('public.commit_mapped_scheme_lesson(uuid,uuid,uuid,integer,uuid,uuid[])'::regprocedure))=0
 then raise exception 'GRADE3_ENGLISH_SCHEME_RPC_PRIVILEGE_OR_MAPPING_DRIFT'; end if;
end;
$verify_rpc$;
commit;
