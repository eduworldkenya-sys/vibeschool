-- Grade 6 English: source-linked 2024 KICD structure and separately authored teaching guidance.
-- KICD PDF is copyrighted: this migration stores short catalog facts, a publisher link,
-- and original VibeSchool outcome guidance. It does NOT reproduce or verify official outcomes.
-- Existing legacy cbc_strands, teacher schemes, term weeks and timetable rows are preserved.
-- authorization-test: public.grade6_english_reader_bindings
begin;
create table if not exists public.grade6_english_reader_bindings (
  source_ref text primary key,
  sub_strand_id uuid not null unique references public.cbc_strands(id) on delete restrict,
  source_url text not null,
  source_version text not null,
  key_inquiry_questions text[] not null default '{}',
  suggested_experiences text[] not null default '{}',
  status text not null default 'active' check(status in ('active','archived')),
  created_at timestamptz not null default now()
);
alter table public.grade6_english_reader_bindings enable row level security;
revoke all on public.grade6_english_reader_bindings from public,anon,authenticated;
grant select on public.grade6_english_reader_bindings to authenticated;
drop policy if exists grade6_english_bindings_read on public.grade6_english_reader_bindings;
create policy grade6_english_bindings_read on public.grade6_english_reader_bindings
 for select to authenticated using (status='active');
create temporary table _vs_g8_catalog (source_ref text primary key,unit jsonb not null) on commit drop;
insert into _vs_g8_catalog(source_ref,unit)
select 'VS-CUR-G06-EN-2026#'||(unit->>'id'),unit
from jsonb_array_elements('[{"id":"1.1","strand":"Listening and Speaking","title":"Pronunciation and Vocabulary","lessons":39,"outcomes":["Distinguish selected English sounds in spoken words and pronounce them intelligibly in context.","Identify the main idea and important details in a spoken narrative, conversation or information text.","Use theme-specific vocabulary and suitable figures of speech appropriately in speech.","Ask for clarification, respond accurately and take turns respectfully in a conversation.","Retell or present an oral message using clear pace, emphasis and meaningful expression."],"inquiry":["How can careful listening help us understand the speaker’s message?","How do pronunciation and word choice influence what listeners understand?"],"experiences":["Listen to a teacher-produced dialogue about a selected theme; identify the main point and supporting detail.","Practise unfamiliar sounds using contrastive word pairs; exchange spoken messages and give respectful feedback.","Prepare and present a short oral explanation containing relevant vocabulary and one suitable figure of speech."],"resources":"Teacher-recorded dialogues, short original oral narratives, vocabulary cards, learner notebook and optional audio.","assessment":"Listening checklist, comprehension responses, clarity of pronunciation, appropriate vocabulary and oral presentation.","competencies":"Communication and collaboration, self-efficacy, critical thinking, digital literacy."},{"id":"2.1","strand":"Reading","title":"Extensive Reading","lessons":11,"outcomes":["Choose age-appropriate print or digital reading material for a clear purpose.","Read sustained passages independently for enjoyment and information.","Use a reference source to explain unfamiliar vocabulary and locate relevant details.","Share a brief personal reading response supported by an example from the text."],"inquiry":["What helps us choose useful and enjoyable material?"],"experiences":["Select a suitable book or article connected to one of the Grade 6 themes and keep a short reading record.","Identify unfamiliar words and consult a learner dictionary or glossary.","Discuss with a partner which facts or passages made the reading worthwhile."],"resources":"School library, approved readers, learner dictionaries and safe digital reading resources.","assessment":"Reading log, appropriate source selection, word investigation and evidence-based response.","competencies":"Learning to learn, digital literacy, communication and collaboration."},{"id":"2.2","strand":"Reading","title":"Intensive Reading","lessons":22,"outcomes":["Find stated information and infer an unstated idea from a short text.","Identify the central message and explain how selected details support it.","Interpret vocabulary and figures of speech from surrounding context.","Recognise how the order of events, causes and consequences shape a passage.","Support a response to a narrative or information text with evidence."],"inquiry":["Which clues in a text help us understand what the writer means?"],"experiences":["Read a short original passage; annotate the main idea, details and unfamiliar expressions.","Discuss literal and inferential questions and cite a sentence or event as evidence.","Summarise the passage orally or in writing without copying it word for word."],"resources":"Original local-context passages, class readers, dictionaries and question cards.","assessment":"Comprehension questions, inference explanations, accurate summaries and text evidence.","competencies":"Critical thinking, learning to learn, collaboration."},{"id":"2.3","strand":"Reading","title":"Fluency","lessons":3,"outcomes":["Read a familiar grade-appropriate passage aloud accurately and at an intelligible pace.","Use punctuation, pauses and intonation to help a listener follow meaning.","Improve reading expression through guided rehearsal and feedback."],"inquiry":["How does expressive reading improve understanding?"],"experiences":["Listen to a clear model of a paragraph and mark places to pause.","Rehearse aloud in pairs and reread while applying feedback."],"resources":"Short original passages and an optional voice recorder.","assessment":"Observed reading accuracy, expression, pausing and improvement between attempts.","competencies":"Communication, self-efficacy and learning to learn."},{"id":"3.1","strand":"Language Use","title":"Word Classes","lessons":33,"outcomes":["Recognise the grammatical role of a word from how it is used in a sentence.","Select suitable nouns, pronouns, verbs, adjectives and adverbs for a clear message.","Use quantifiers, connectives, prepositions and other taught forms appropriately in context.","Construct sentences using the targeted structures and explain why the choices are correct.","Identify and correct common errors without changing the intended meaning."],"inquiry":["How do different word classes help us build a precise sentence?"],"experiences":["Sort words from an original theme-based paragraph by their function.","Build sentences from picture prompts and compare changes when words are replaced.","Edit a short learner-created passage for word choice and grammatical agreement."],"resources":"Sentence strips, word cards, original extracts, notebooks and grammar reference cards.","assessment":"Sentence construction, grammatical identification, contextual use and error correction.","competencies":"Critical thinking, communication, creativity."},{"id":"3.2","strand":"Language Use","title":"Tenses","lessons":6,"outcomes":["Recognise how verb forms signal the time and progression of actions.","Choose an appropriate taught tense for an account, instruction or report.","Maintain a consistent time reference while narrating events.","Revise a short passage to correct tense inconsistencies."],"inquiry":["How can the form of a verb show when something happened?"],"experiences":["Arrange event cards into a timeline and describe them using suitable verb forms.","Compare different accounts of the same event and edit mismatched tenses."],"resources":"Event timelines, original short accounts, sentence cards and learners’ notebooks.","assessment":"Timeline sentences, controlled writing and accurate revision.","competencies":"Critical thinking, learning to learn and communication."},{"id":"4.1","strand":"Writing","title":"Creative Writing","lessons":14,"outcomes":["Generate relevant ideas for a narrative or descriptive piece on a chosen theme.","Organise a piece with a clear beginning, development and ending.","Use vivid but appropriate vocabulary and varied sentence structures.","Revise a draft to improve coherence, detail and expression."],"inquiry":["How can writers make a story easy to follow and interesting to read?"],"experiences":["Plan an original story or description using an idea map and a sequence of events.","Draft a short piece about a theme, exchange feedback and make a second version."],"resources":"Writing frames, story maps, learner notebooks and original stimulus pictures.","assessment":"Planning, sequence, description, original expression and quality of revision.","competencies":"Creativity, communication, self-efficacy."},{"id":"4.2","strand":"Writing","title":"Functional Writing","lessons":6,"outcomes":["Identify the audience and purpose of a practical written message.","Recognise the essential fields or structure of a suitable form, note or message.","Compose a clear and courteous functional text containing accurate relevant information.","Review a functional text for legibility, completeness, tone and correct format."],"inquiry":["What information does a reader need to act on a written message?"],"experiences":["Compare two original practical messages and identify which communicates more clearly.","Draft a form, notice or short message appropriate to the teaching theme; peer-check completeness."],"resources":"Original sample forms, notices, message templates, notebooks and pens.","assessment":"Audience awareness, appropriate format, completeness and clear expression.","competencies":"Communication, digital literacy, responsibility."},{"id":"4.3","strand":"Writing","title":"Mechanics of Writing","lessons":13,"outcomes":["Apply appropriate punctuation and capitalisation to meaningful sentences.","Spell familiar and newly taught words accurately with suitable reference support.","Use readable handwriting, spacing and paragraphing in a finished text.","Edit a passage to remove mechanical errors and improve clarity."],"inquiry":["Why do spelling, punctuation and layout matter to readers?"],"experiences":["Compare a poorly punctuated paragraph with a corrected version and discuss the difference.","Apply an editing checklist to an original short composition and produce a legible final copy."],"resources":"Editing checklists, model paragraphs, learner dictionaries and writing materials.","assessment":"Punctuation, spelling, paragraphing, legibility and effective proofreading.","competencies":"Learning to learn, attention to detail, communication."},{"id":"4.4","strand":"Writing","title":"Guided Compositions","lessons":3,"outcomes":["Interpret a guided writing prompt and identify the required audience, topic and details.","Arrange supplied ideas into a logically connected composition.","Write a coherent response using appropriate language and conventions.","Review a completed composition against the task and correct weaknesses."],"inquiry":["How can a writing plan help us keep to the task?"],"experiences":["Use a short writing prompt and outline to develop an original composition.","Review the response against a simple writing rubric and improve the final draft."],"resources":"Original prompts, outlines, story sequences and learner writing checklists.","assessment":"Task relevance, coherent sequencing, language accuracy and thoughtful editing.","competencies":"Creativity, critical thinking and communication."}]'::jsonb) unit;
do $preflight$
begin
 if (select count(*) from _vs_g8_catalog)<>10
    or (select sum((unit->>'lessons')::int) from _vs_g8_catalog)<>150
    or (select count(distinct unit->>'strand') from _vs_g8_catalog)<>4
 then raise exception 'GRADE6_ENGLISH_CATALOG_MISMATCH'; end if;
 if (select count(*) from public.subjects where name='English' and school_id is null and global_subject_id is null)<>1
 then raise exception 'GRADE6_ENGLISH_GLOBAL_SUBJECT_MISSING'; end if;
 if exists (
   select 1 from _vs_g8_catalog t
   join public.subjects sub on sub.name='English' and sub.school_id is null and sub.global_subject_id is null
   join public.cbc_strands s on s.subject_id=sub.id and s.grade='Grade 6'
     and s.name=t.unit->>'strand' and s.sub_strand=t.unit->>'title'
   where s.source_ref is not null and s.source_ref<>t.source_ref
 ) then raise exception 'GRADE6_ENGLISH_CONFLICTING_EXISTING_SOURCE'; end if;
end;$preflight$;
insert into public.cbc_strands
 (subject_id,grade,name,sub_strand,strand_order,sub_strand_order,
  key_inquiry_questions,suggested_experiences,source_ref)
select sub.id,'Grade 6',t.unit->>'strand',t.unit->>'title',
 split_part(t.unit->>'id','.',1)::int,split_part(t.unit->>'id','.',2)::int,
 array(select jsonb_array_elements_text(t.unit->'inquiry')),
 array(select jsonb_array_elements_text(t.unit->'experiences')),t.source_ref
from _vs_g8_catalog t
join public.subjects sub on sub.name='English' and sub.school_id is null and sub.global_subject_id is null
on conflict(subject_id,grade,name,sub_strand) do nothing;
insert into public.grade6_english_reader_bindings
 (source_ref,sub_strand_id,source_url,source_version,key_inquiry_questions,suggested_experiences)
select t.source_ref,s.id,
 'https://kicd.ac.ke/wp-content/uploads/2024/10/ENGLISH-GRADE-6-UPDATED-Revised-Sept.pdf', 'KICD revised 2024',
 array(select jsonb_array_elements_text(t.unit->'inquiry')),
 array(select jsonb_array_elements_text(t.unit->'experiences'))
from _vs_g8_catalog t
join public.subjects sub on sub.name='English' and sub.school_id is null and sub.global_subject_id is null
join public.cbc_strands s on s.subject_id=sub.id and s.grade='Grade 6'
 and s.name=t.unit->>'strand' and s.sub_strand=t.unit->>'title'
on conflict(source_ref) do nothing;
insert into public.curriculum_unit_guidance
 (sub_strand_id,suggested_lessons,learning_resources,assessment_methods,competencies,safety_notes,content_status)
select b.sub_strand_id,(t.unit->>'lessons')::int,
 'Original passages, dialogue samples, exercise books and the original KICD Grade 6 reference link',
 'Oral questioning, listening observations, reading checks and written learner responses',
 'Communication, critical reading, language use, composition and collaboration',
 'Use inclusive age-appropriate materials and supervised ICT access','active'
from _vs_g8_catalog t join public.grade6_english_reader_bindings b on b.source_ref=t.source_ref
on conflict(sub_strand_id) do nothing;
insert into public.curriculum_learning_outcomes
 (sub_strand_id,outcome_text,outcome_code,source_type,source_ref,status)
select b.sub_strand_id,o.text,
 'VS-G6-EN-'||(t.unit->>'id')||'-'||o.ordinality,
 'creator_claimed',t.source_ref||'/'||o.ordinality,'active'
from _vs_g8_catalog t
join public.grade6_english_reader_bindings b on b.source_ref=t.source_ref
cross join lateral jsonb_array_elements_text(t.unit->'outcomes')
 with ordinality as o(text,ordinality)
where not exists(select 1 from public.curriculum_learning_outcomes x
 where x.source_ref=t.source_ref||'/'||o.ordinality);
drop policy if exists grade6_english_original_outcomes_read on public.curriculum_learning_outcomes;
create policy grade6_english_original_outcomes_read on public.curriculum_learning_outcomes
 for select to authenticated using (
  status='active' and source_type='creator_claimed' and created_by is null
  and source_ref like 'VS-CUR-G06-EN-2026#%'
 );
drop policy if exists grade6_english_guidance_read on public.curriculum_unit_guidance;
create policy grade6_english_guidance_read on public.curriculum_unit_guidance
 for select to authenticated using (
  content_status='active' and exists(select 1 from public.grade6_english_reader_bindings b
   where b.sub_strand_id=curriculum_unit_guidance.sub_strand_id and b.status='active')
 );
do $verify$
begin
 if (select count(*) from public.grade6_english_reader_bindings where status='active'
       and source_ref like 'VS-CUR-G06-EN-2026#%')<>10
   or (select coalesce(sum(g.suggested_lessons),0) from public.grade6_english_reader_bindings b
       join public.curriculum_unit_guidance g on g.sub_strand_id=b.sub_strand_id and g.content_status='active'
       where b.source_ref like 'VS-CUR-G06-EN-2026#%')<>150
   or (select count(*) from public.curriculum_learning_outcomes o
       where o.source_ref like 'VS-CUR-G06-EN-2026#%' and o.status='active')<>42
 then raise exception 'GRADE6_ENGLISH_PERSISTENCE_INCOMPLETE'; end if;
end;$verify$;

-- Preserve all existing invoker safety checks and established Grade 1 / Grade 8 references.
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
