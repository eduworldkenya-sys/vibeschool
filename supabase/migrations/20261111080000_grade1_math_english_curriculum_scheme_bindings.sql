-- Grade 1 Mathematics and English: persist 24 VibeSchool-authored reader units.
-- Reader outcomes are CREATOR_CLAIMED, not official KICD transcriptions.
-- Preserve ALL existing Grade 1 legacy cbc_strands rows and source_ref values;
-- exact lexical matches are linked through an explicit reversible binding table.
-- Never create term/week/pacing records or teacher Scheme rows in this migration.
begin;

create table if not exists public.grade1_curriculum_reader_bindings (
  source_ref text primary key check(source_ref ~ '^VS-CUR-G01-(MA|EN)-2026#[1-4]\\.[1-9][0-9]*$'),
  sub_strand_id uuid not null unique references public.cbc_strands(id) on delete restrict,
  key_inquiry_questions text[] not null,
  suggested_experiences text[] not null,
  status text not null default 'active' check(status in ('active','archived')),
  created_at timestamptz not null default now()
);
alter table public.grade1_curriculum_reader_bindings enable row level security;
revoke all on public.grade1_curriculum_reader_bindings from public,anon,authenticated;
grant select on public.grade1_curriculum_reader_bindings to authenticated;
drop policy if exists grade1_reader_bindings_authenticated_read on public.grade1_curriculum_reader_bindings;
create policy grade1_reader_bindings_authenticated_read on public.grade1_curriculum_reader_bindings
  for select to authenticated using (status='active');

-- New material is staged transaction-locally; the JSON is independently authored
-- reader material, not an official copyright-restricted KICD transcription.
create temporary table _vs_grade1_catalog (source_ref text primary key, unit jsonb not null) on commit drop;
insert into _vs_grade1_catalog(source_ref,unit)
select item->>'source_ref',item from jsonb_array_elements(
$vs_grade1_catalog$[{"source_ref":"VS-CUR-G01-MA-2026#1.1","subject":"Mathematics","strand":1,"unit_id":"1.1","id":"1.1","title":"Pre-Number Activities","lessons":20,"outcomes":["Sort familiar safe objects into sets using a shared feature such as colour, size, shape, texture or purpose.","Pair objects that share a clearly identifiable feature.","Arrange objects in a chosen order, for example from smallest to largest.","Build and explain repeating patterns using objects of different shapes or sizes.","Use sorting and grouping when organising everyday materials."],"experiences":["Gather clean classroom objects; explain the reason for each group rather than merely making piles.","Match picture cards or objects with similar features; compare partners' choices.","Arrange objects by size and design a repeating pattern using lids, blocks or drawings."],"inquiry":["What rule did you use to group these objects?","How can another learner continue your pattern?"],"resources":"Clean bottle tops, safe blocks, picture cards, coloured paper and reusable sorting trays.","assessment":"Observe sorting, matching, ordering and pattern-extension tasks; ask learners to state their rule.","competencies":"Creativity and imagination; self-efficacy. Values: unity and responsibility. PCIs: safe use of materials and social cohesion.","safety":"Use large, clean, non-sharp counters; offer tactile objects and high-contrast cards."},{"source_ref":"VS-CUR-G01-MA-2026#1.2","subject":"Mathematics","strand":1,"unit_id":"1.2","id":"1.2","title":"Whole Numbers","lessons":25,"outcomes":["Count forwards accurately through the numbers from 1 to 50.","Count backwards starting at 30.","Show quantities from 1 to 30 with physical counters or grouped objects.","Recognise, read and write number symbols from 1 to 50.","Read and write the number names one to ten.","Fill gaps in simple number sequences within 20.","Invent and extend number patterns within 20 during learning games."],"experiences":["Count classroom objects in turns, first slowly and then with number cards for checking.","Build quantities using counters and match them with numeral cards; practise numeral formation.","Complete missing-number strips and make original patterns for a partner to extend."],"inquiry":["How can we check that every object was counted once?","What is the rule for the missing number?"],"resources":"Counters, numeral cards 1–50, a large number line, pencils and an optional accessible counting game.","assessment":"Ask learners to count forwards and backwards, represent a quantity, write symbols and number names, and continue a pattern.","competencies":"Digital literacy where available; creativity; turn-taking and respect. PCIs: environmental safety and cooperation."},{"source_ref":"VS-CUR-G01-MA-2026#1.3","subject":"Mathematics","strand":1,"unit_id":"1.3","id":"1.3","title":"Addition","lessons":25,"outcomes":["Demonstrate addition by combining two groups of objects and counting the new total.","Record addition using the plus and equals symbols correctly.","Find totals when two single-digit quantities are combined.","Find totals when three single-digit quantities are combined.","Add a one-digit quantity to a two-digit quantity without regrouping, keeping the total within 50.","Work out missing terms in additive number patterns within 50.","Use games or suitable digital activities to practise addition strategies."],"experiences":["Use two piles of counters to show that joining groups creates a larger combined set.","Translate picture stories into addition statements and practise with dice.","Work with tens-and-ones cards to add without regrouping, then describe the method used."],"inquiry":["What changes when two groups are combined?","How can we add a small number to a two-digit number?"],"resources":"Counters, dice, number cards, a place-value chart, an abacus where available and simple story cards.","assessment":"Check concrete modelling, correct use of signs, the 2- and 3-addend calculations and two-digit plus one-digit calculations without regrouping.","competencies":"Problem solving; creativity and collaboration. Values: inclusion and fairness. PCIs: safety and creative thinking."},{"source_ref":"VS-CUR-G01-MA-2026#1.4","subject":"Mathematics","strand":1,"unit_id":"1.4","id":"1.4","title":"Subtraction","lessons":20,"outcomes":["Show subtraction by physically removing part of a collection.","Write subtraction number sentences with the minus and equals symbols.","Subtract one single-digit number from another.","Subtract a one-digit number from a two-digit number without regrouping.","Continue or complete subtraction-based number patterns involving numbers to 50.","Use age-appropriate games or digital activities to practise subtraction."],"experiences":["Start with a set of counters, take some away and describe the remainder.","Show subtraction as movement backwards on a number path and write corresponding statements.","Use a number chart to practise subtraction within 50 without crossing a ten in the written two-digit examples."],"inquiry":["How does taking away change the quantity?","How can counting backwards help us subtract?"],"resources":"Counters, number lines, numeral cards, a place-value board and picture word problems.","assessment":"Use demonstrations and short questions to verify the subtraction process, signs and answers without regrouping.","competencies":"Learning to learn; creativity; shared responsibility and unity. PCIs: collaboration and reasoning."},{"source_ref":"VS-CUR-G01-MA-2026#2.1","subject":"Mathematics","strand":2,"unit_id":"2.1","id":"2.1","title":"Length","lessons":10,"outcomes":["Select safe everyday items that differ in length.","Compare two objects using longer, shorter and equal-length descriptions.","Measure the length of an object with a consistent informal unit.","Explain why comparing and measuring lengths is helpful in ordinary situations."],"experiences":["Compare pencils, leaves and ribbons by placing them beside each other with one end aligned.","Use hand spans, footsteps or paper strips to measure objects and discuss why answers may vary.","Make a classroom display of objects ordered by length."],"inquiry":["Which item is longer and how can we tell?","What can we use to measure a table when we have no ruler?"],"resources":"Ribbons, pencils, string, paper strips, blocks and a clear floor area.","assessment":"Observe correct comparisons and consistent counting of non-standard measuring units.","competencies":"Self-efficacy; communication and collaboration. Values: responsibility. PCIs: social cohesion and environmental care."},{"source_ref":"VS-CUR-G01-MA-2026#2.2","subject":"Mathematics","strand":2,"unit_id":"2.2","id":"2.2","title":"Mass","lessons":10,"outcomes":["Find safe classroom items with noticeably different masses.","Describe relative mass using heavier, lighter or the same.","Compare and measure mass through a suitable informal balancing or reference method.","Recognise everyday situations where comparing mass is useful."],"experiences":["Predict which of two safe objects is heavier and test using a simple balance.","Compare classroom objects and describe the results to a partner.","Use identical small units to balance an object and record the count."],"inquiry":["Can a large object be lighter than a smaller one?","How can a balance help us compare two objects?"],"resources":"A simple balance, identical small reference objects, sealed dry goods and safe everyday items.","assessment":"Check comparisons and repeatable informal measurements; ask learners to explain evidence rather than guessing from size.","competencies":"Communication and collaboration; digital literacy when appropriate. Values: respect and unity. PCIs: safety and effective communication.","safety":"Do not handle heavy, sharp or fragile items; use sealed containers and supervise balancing."},{"source_ref":"VS-CUR-G01-MA-2026#2.3","subject":"Mathematics","strand":2,"unit_id":"2.3","id":"2.3","title":"Capacity","lessons":12,"outcomes":["Select safe containers that hold different amounts.","Compare containers as holding more, less or an equal amount.","Measure capacity using repeated fills from the same informal unit.","Find practical uses for clean empty containers instead of discarding them."],"experiences":["Estimate which of two containers will hold more and test with water in a controlled area.","Use the same cup to count how many fills a larger container takes.","Discuss clean, safe ways of reusing containers for storage."],"inquiry":["How can we find which container holds more?","Why must we use the same cup when comparing capacity?"],"resources":"Clean plastic containers, one measuring cup per comparison, a shallow basin, water and towels.","assessment":"Observe comparison vocabulary, repeated fills and recording; check responsible container reuse.","competencies":"Problem solving and learning to learn. Values: responsibility and unity. PCIs: safe water handling and sustainable use.","safety":"Supervise water, clean spills immediately and avoid glass, chemical or previously hazardous containers."},{"source_ref":"VS-CUR-G01-MA-2026#2.4","subject":"Mathematics","strand":2,"unit_id":"2.4","id":"2.4","title":"Time","lessons":8,"outcomes":["Name the seven days of the week in their usual order.","Associate common activities with particular days of the week.","Name the twelve months of the year.","Describe everyday routines that take place on different days."],"experiences":["Arrange day cards into a correct weekly sequence and relate them to familiar routines.","Use a song or rhyme to rehearse month names in sequence.","Make a simple personal week chart with school, family and leisure activities."],"inquiry":["Which day comes before or after a chosen day?","How do we organise activities over a week?"],"resources":"Day and month cards, a simple calendar, routine illustrations and paper.","assessment":"Listen for correct sequence and identification of days and months; review a learner's weekly routine chart.","competencies":"Self-efficacy; communication and collaboration. Values: peaceful participation and respect for varied family routines. PCIs: citizenship and inclusion."},{"source_ref":"VS-CUR-G01-MA-2026#2.5","subject":"Mathematics","strand":2,"unit_id":"2.5","id":"2.5","title":"Money","lessons":8,"outcomes":["Recognise Kenyan currency coins by appearance and denomination.","Identify the Kenyan fifty-shilling banknote.","Count selected currency coins one at a time and state their values.","Use the exact amount in a simulated purchase involving no more than two items, without change.","Describe situations where money is used to pay for goods."],"experiences":["Compare real or imitation Kenyan money images and talk about their values.","Set up a pretend shop with simple price labels and practise paying the exact price.","Count the value of selected single coins, avoiding transactions that require calculating change."],"inquiry":["How can we tell the value of money we are using?","What do we need to buy two items with exactly the right amount?"],"resources":"Up-to-date Kenyan currency images or safe imitations, picture price tags, shopping baskets and paper item cards.","assessment":"Check denomination recognition, counting and correct exact-payment role-play up to two items.","competencies":"Citizenship and confidence. Values: integrity and responsibility. PCIs: basic financial literacy.","safety":"Use replicas or images rather than requiring learners to bring money; verify denominations still in circulation when choosing examples."},{"source_ref":"VS-CUR-G01-MA-2026#3.1","subject":"Mathematics","strand":3,"unit_id":"3.1","id":"3.1","title":"Lines","lessons":6,"outcomes":["Spot straight lines in classroom objects and familiar surroundings.","Make straight line marks on suitable surfaces.","Recognise curved lines in objects and drawings.","Draw curved lines using appropriate classroom materials.","Distinguish examples of straight and curved edges in real-life objects."],"experiences":["Look for lines on desks, books, wheels or paths and classify them.","Connect two marked points with a straight line on paper, then draw several curved paths.","Create a picture that combines both kinds of lines and explain the choices."],"inquiry":["How is a curved line different from a straight one?","Where can we see examples of each in our classroom?"],"resources":"Paper, pencils, chalk, large shape cards and familiar classroom objects.","assessment":"Review recognition, drawing and naming of straight and curved lines.","competencies":"Learning to learn; self-efficacy. Values: respect and responsibility. PCIs: cooperation and awareness of the environment."},{"source_ref":"VS-CUR-G01-MA-2026#3.2","subject":"Mathematics","strand":3,"unit_id":"3.2","id":"3.2","title":"Shapes","lessons":6,"outcomes":["Identify circles, triangles and rectangles in familiar objects and pictures.","Create and repeat visual patterns using circles, triangles, rectangles and ovals.","Notice and describe decorative shape patterns in ordinary materials."],"experiences":["Find simple shapes in classroom pictures and safe real objects.","Arrange paper shape cut-outs in a repeated sequence, explaining the order.","Colour a shape pattern and compare it with patterns seen on fabric or household items."],"inquiry":["Which shapes can we recognise around us?","How can repeated shapes make a pattern?"],"resources":"Large shape cut-outs, coloured paper, safe classroom objects, crayons and pattern cards.","assessment":"Check naming of shapes and ability to construct and explain a repeating pattern.","competencies":"Creativity and imagination; learning to learn. Values: peaceful cooperation and responsibility. PCIs: classroom safety and creative thinking.","safety":"Use pre-cut shapes and supervise scissors if used."},{"source_ref":"VS-CUR-G01-EN-2026#1.1","subject":"English","strand":1,"unit_id":"1.1","id":"1.1","title":"Pronunciation and Vocabulary","lessons":60,"outcomes":["Listen closely and identify a target sound in familiar spoken words.","Match taught letter shapes to the corresponding sounds in age-appropriate words.","Say target sounds and short words clearly after listening to a reliable model.","Use new words from familiar themes in short meaningful conversations.","Follow and respond to simple oral instructions and questions.","Use polite greetings and suitable non-verbal signals while interacting with others.","Speak in short age-appropriate sentences with growing confidence."],"experiences":["Use a picture and a short oral text to hear, identify and repeat a selected sound.","Take turns matching letter cards with words or pictures, then practise speaking the words.","Role-play a short exchange about a chosen everyday theme, including listening and responding to a partner."],"inquiry":["How does listening help us say a new word accurately?","How can we use new words to share our ideas with someone?"],"resources":"Picture and letter cards, locally familiar objects, teacher read-alouds, simple songs, optional clear audio recordings.","assessment":"Listen for sound recognition, accurate attempts at pronunciation, appropriate word choice, response to questions and respectful turn-taking.","competencies":"Communication and collaboration, self-efficacy and learning to learn. Values: respect and unity. PCIs: social skills and safe communication.","safety":"Use encouraging feedback; allow extra response time and visual cues for speech or hearing differences."},{"source_ref":"VS-CUR-G01-EN-2026#2.1","subject":"English","strand":2,"unit_id":"2.1","id":"2.1","title":"Pre-reading","lessons":6,"outcomes":["Choose a comfortable posture for reading and hold a book safely.","Identify where a page begins and track print from left to right.","Match selected printed letters with sounds already practised orally.","Recognise basic features of a book, including its cover and pages."],"experiences":["Model safe book handling, page turning and careful placement of reading material.","Trace a line of print while a teacher reads and then try with short familiar words.","Match large letter cards to oral sounds and picture prompts."],"inquiry":["What helps us prepare to read a book?","How do our eyes follow the words on a page?"],"resources":"Large-print readers, simple picture books, letter cards and optional tactile or adapted texts.","assessment":"Observe book handling, reading position, direction of print tracking and letter-sound matching.","competencies":"Self-efficacy and learning to learn. Values: responsibility for shared books. PCIs: eye care and inclusion."},{"source_ref":"VS-CUR-G01-EN-2026#2.2","subject":"English","strand":2,"unit_id":"2.2","id":"2.2","title":"Word Reading","lessons":4,"outcomes":["Blend previously learnt sounds to read short familiar words.","Recognise and read selected common words in signs, cards and very short texts.","Use pictures and surrounding words to support recognition of an unfamiliar word.","Read familiar theme words aloud without relying only on memorised pictures."],"experiences":["Build two- or three-sound words from movable letters and say each sound before blending.","Match short word cards to pictures, then read the words after removing the pictures.","Read words in a brief thematic sentence and check that the spoken word fits its meaning."],"inquiry":["What happens when we blend sounds together?","How can a picture help us check the word we have read?"],"resources":"Letter tiles, phonics cards, familiar signs, picture cards and short age-appropriate texts.","assessment":"Check independent sound blending and word recognition in new combinations, not only recitation of memorised lists.","competencies":"Learning to learn, communication and problem solving. Values: patience and respect. PCIs: literacy for daily life."},{"source_ref":"VS-CUR-G01-EN-2026#2.3","subject":"English","strand":2,"unit_id":"2.3","id":"2.3","title":"Fluency","lessons":12,"outcomes":["Read a short, familiar passage aloud with improving accuracy.","Group words naturally while reading a simple sentence.","Use pauses at suitable points in a short text.","Read short phrases with suitable voice expression.","Build confidence through rereading and supported practice."],"experiences":["Listen to a teacher model reading of a short passage, then practise echo reading.","Reread two or three simple sentences with a partner and notice where meaning changes with pauses.","Perform a short dialogue aloud using a friendly tone and natural expression."],"inquiry":["Why is it helpful to pause while reading?","How does practising a short passage make reading easier?"],"resources":"Short theme-based passages, simple dialogues, enlarged sentence strips and optional audio support.","assessment":"Use brief observation of accuracy, expression, sensible phrasing and improvement through supported repeated reading.","competencies":"Communication, collaboration and self-efficacy. Values: cooperation and care. PCIs: positive peer support."},{"source_ref":"VS-CUR-G01-EN-2026#2.4","subject":"English","strand":2,"unit_id":"2.4","id":"2.4","title":"Comprehension","lessons":8,"outcomes":["Identify people, objects or places mentioned in a very short story.","Tell what happened first and next in a simple passage.","Answer straightforward oral or written questions about a short text.","Relate the meaning of a story to everyday experiences.","Use pictures and a few key words to retell a short narrative."],"experiences":["Read or listen to an illustrated short text and point to pictures that match its meaning.","Answer who, what, where and simple why questions using words or complete short sentences.","Reorder three picture cards and retell the story with a partner."],"inquiry":["What clues help us know what a story is about?","How can we tell someone what happened in a text?"],"resources":"Illustrated picture stories, sequence cards and short levelled reading passages.","assessment":"Ask meaning-based questions, observe picture sequencing and check whether retelling preserves the main idea.","competencies":"Critical thinking, creativity and communication. Values: respect and responsibility. PCIs: empathy and safe decision-making."},{"source_ref":"VS-CUR-G01-EN-2026#3.1","subject":"English","strand":3,"unit_id":"3.1","id":"3.1","title":"Word Classes","lessons":22,"outcomes":["Use familiar naming words naturally when talking about people, objects and places.","Choose simple describing words that make a spoken sentence clearer.","Use short expressions to refer to a person or object without unnecessary repetition.","Use suitable action words when talking about everyday activities.","Communicate simple ideas using naturally formed short sentences."],"experiences":["Describe familiar classroom pictures and objects through short spoken sentences without naming grammar categories.","Play a guessing game that adds one describing word to help a partner find an object.","Practise short dialogues in which learners speak about what people or animals do."],"inquiry":["How can we make a short description clear?","What words help another person understand our message?"],"resources":"Picture cards, everyday objects, action illustrations and short oral dialogues.","assessment":"Listen for natural, meaningful use of everyday words in short spoken sentences; do not test technical grammar labels.","competencies":"Communication and collaboration, self-efficacy. Values: respect and responsibility. PCIs: effective daily communication."},{"source_ref":"VS-CUR-G01-EN-2026#3.2","subject":"English","strand":3,"unit_id":"3.2","id":"3.2","title":"Tense","lessons":6,"outcomes":["Talk simply about things happening now.","Describe familiar activities that happened earlier.","Make short statements about something planned for later.","Choose understandable everyday time words in a conversation."],"experiences":["Use today, yesterday and tomorrow picture cards to talk about routines in complete short sentences.","Listen to a short exchange about an earlier activity and answer questions.","Take turns describing what a family or school activity is like on different days."],"inquiry":["How do we tell a friend when an activity happened?","What can we say about something we plan to do?"],"resources":"Routine pictures, time cards, short conversations and oral story prompts.","assessment":"Observe whether learners communicate present, past and future meaning understandably without requiring grammar terminology.","competencies":"Communication, learning to learn and confidence. Values: respect and cooperation. PCIs: planning and time awareness."},{"source_ref":"VS-CUR-G01-EN-2026#3.3","subject":"English","strand":3,"unit_id":"3.3","id":"3.3","title":"Sentences","lessons":2,"outcomes":["Respond to questions with meaningful short oral sentences.","Join familiar words into a clear message about an everyday theme.","Use courteous short statements while speaking to classmates and adults."],"experiences":["Look at one picture and produce a short sentence that tells what is happening.","Extend a one-word answer into a clear statement with teacher support.","Practise brief polite exchanges with classmates using familiar context words."],"inquiry":["What helps a listener understand a short message?"],"resources":"Simple picture prompts, conversation cards and age-appropriate role-play objects.","assessment":"Listen for understandable short statements and appropriate responses; avoid explicit grammar terminology.","competencies":"Communication, self-efficacy and collaboration. Values: respect and unity. PCIs: confidence in social interaction."},{"source_ref":"VS-CUR-G01-EN-2026#4.1","subject":"English","strand":4,"unit_id":"4.1","id":"4.1","title":"Pre-writing","lessons":4,"outcomes":["Sit or position the body comfortably before writing.","Hold a pencil or adapted writing tool with improving control.","Trace and produce simple lines, loops and shapes needed for letter formation.","Coordinate eye and hand movement when following a writing path."],"experiences":["Demonstrate good writing posture and allow learners to adjust seating or supports.","Practise large movements in the air or on reusable surfaces before tracing lines on paper.","Follow simple paths and letter-like shapes using crayons, fingers or adapted tools."],"inquiry":["What helps our hands make clear marks?","Why should we sit or position ourselves comfortably when writing?"],"resources":"Pencils, crayons, writing boards, paper, large templates and adapted grips.","assessment":"Observe posture, grip or adapted tool control, direction of strokes and progress towards steady marks.","competencies":"Self-efficacy, creativity and learning to learn. Values: care for materials. PCIs: posture and inclusion."},{"source_ref":"VS-CUR-G01-EN-2026#4.2","subject":"English","strand":4,"unit_id":"4.2","id":"4.2","title":"Handwriting","lessons":6,"outcomes":["Form taught lower-case letters in a recognisable way.","Form selected capital letters in a recognisable way.","Copy familiar words with improving letter size and spacing.","Write short words neatly enough for another reader to recognise."],"experiences":["Watch a model letter formation and practise with large strokes before writing on a line.","Copy a few theme words while observing letter orientation and spacing.","Compare a learner's earlier and later handwriting gently, focusing on progress."],"inquiry":["How does clear handwriting help someone read our work?","What makes letters easier to recognise?"],"resources":"Letter formation charts, exercise books, pencils and lined or large-grid paper.","assessment":"Review letter shapes, direction, spacing, legibility and steady improvement rather than speed.","competencies":"Learning to learn, self-efficacy and responsibility. Values: patience and care. PCIs: fine-motor development."},{"source_ref":"VS-CUR-G01-EN-2026#4.3","subject":"English","strand":4,"unit_id":"4.3","id":"4.3","title":"Spelling","lessons":6,"outcomes":["Write familiar short words after sounding them out.","Select suitable letters for sounds in taught words.","Spell selected theme words with support from a picture or word bank.","Check and correct an attempt at spelling using a reliable classroom model."],"experiences":["Say a simple word, listen for its sounds and choose matching letter tiles.","Complete a familiar picture-word matching and spelling game.","Write a short word from a teacher prompt and compare it respectfully with a printed model."],"inquiry":["How do sounds help us spell words?","What can we do when we are not sure of a letter?"],"resources":"Sound and letter cards, picture prompts, word walls and writing surfaces.","assessment":"Check how learners use sound-letter knowledge in newly presented words and correct spelling attempts thoughtfully.","competencies":"Learning to learn, creativity and self-efficacy. Values: persistence and respect. PCIs: functional literacy."},{"source_ref":"VS-CUR-G01-EN-2026#4.4","subject":"English","strand":4,"unit_id":"4.4","id":"4.4","title":"Punctuation","lessons":4,"outcomes":["Recognise that a written sentence begins with a capital letter.","Notice a full stop at the end of a simple statement.","Use basic ending marks in a short copied or guided sentence.","Read short writing with pauses that reflect familiar punctuation."],"experiences":["Compare two large sentence cards, one with and one without a beginning capital and full stop.","Write a simple message about a picture and place a full stop at its end.","Practise reading short sentences with natural pauses and supportive guidance."],"inquiry":["How does a reader know where a written message begins and ends?"],"resources":"Sentence strips, board markers, picture cards and writing books.","assessment":"Inspect capital letters, simple end punctuation and understanding during reading and writing.","competencies":"Communication and self-efficacy. Values: responsibility. PCIs: clear communication."},{"source_ref":"VS-CUR-G01-EN-2026#4.5","subject":"English","strand":4,"unit_id":"4.5","id":"4.5","title":"Guided Writing","lessons":10,"outcomes":["Compose a short spoken message before attempting to write it.","Write a brief sentence based on a familiar picture or real experience.","Arrange simple words in an order that communicates meaning.","Write two or more connected simple ideas with teacher support where appropriate.","Review a short written message for clarity, letter formation and basic punctuation."],"experiences":["Talk about a familiar theme picture, rehearse one sentence orally and write it with a model or word bank.","Use three picture prompts to plan a very short personal account with an adult's support.","Read a completed sentence to a partner and revise a word or punctuation mark where needed."],"inquiry":["What do we want another person to know from our writing?","How can pictures help us plan what to write?"],"resources":"Illustrated story prompts, simple word banks, classroom word walls and writing books.","assessment":"Review whether writing shares a coherent simple message and whether support is used productively; value meaning as well as neatness.","competencies":"Creativity and imagination, communication and learning to learn. Values: care, respect and responsibility. PCIs: expression and inclusion."}]$vs_grade1_catalog$::jsonb) item;

do $preflight$
begin
  if (select count(*) from _vs_grade1_catalog) <> 24
     or (select count(*) from _vs_grade1_catalog where unit->>'subject'='Mathematics') <> 11
     or (select count(*) from _vs_grade1_catalog where unit->>'subject'='English') <> 13
     or (select sum((unit->>'lessons')::integer) from _vs_grade1_catalog) <> 300
     or (select sum(jsonb_array_length(unit->'outcomes')) from _vs_grade1_catalog) <> 112
  then raise exception 'GRADE1_READER_SOURCE_COUNT_MISMATCH'; end if;
  if (select count(*) from public.subjects where school_id is null
    and global_subject_id is null and name in ('Mathematics','English')) <> 2
  then raise exception 'GRADE1_READER_GLOBAL_SUBJECT_IDENTITY_MISSING'; end if;
  if exists (
    select 1 from _vs_grade1_catalog t
    join public.subjects sub on sub.name=t.unit->>'subject'
      and sub.school_id is null and sub.global_subject_id is null
    join public.cbc_strands s on s.subject_id=sub.id and s.grade='Grade 1'
      and s.name=t.unit->>'strand' and s.sub_strand=t.unit->>'title'
    where s.source_ref is not null and s.source_ref<>t.source_ref
  ) then raise exception 'GRADE1_READER_EXISTING_SOURCE_CONFLICT'; end if;
end;
$preflight$;

-- Insert only genuinely missing hierarchy nodes, leaving exact-match legacy
-- nodes unchanged. Source lineage for all 24 nodes is in the binding table.
insert into public.cbc_strands
  (subject_id,grade,name,sub_strand,strand_order,sub_strand_order,
   key_inquiry_questions,suggested_experiences,source_ref)
select sub.id,'Grade 1',t.unit->>'strand',t.unit->>'title',
  split_part(t.unit->>'unit_id','.',1)::integer,
  split_part(t.unit->>'unit_id','.',2)::integer,
  array(select jsonb_array_elements_text(t.unit->'inquiry')),
  array(select jsonb_array_elements_text(t.unit->'experiences')),
  t.source_ref
from _vs_grade1_catalog t
join public.subjects sub on sub.name=t.unit->>'subject'
  and sub.school_id is null and sub.global_subject_id is null
on conflict (subject_id,grade,name,sub_strand) do nothing;

-- Clear, subject-scoped canonical record binding, including exact-match
-- legacy nodes, without changing the old rows' source metadata.
insert into public.grade1_curriculum_reader_bindings
  (source_ref,sub_strand_id,key_inquiry_questions,suggested_experiences)
select t.source_ref,s.id,
  array(select jsonb_array_elements_text(t.unit->'inquiry')),
  array(select jsonb_array_elements_text(t.unit->'experiences'))
from _vs_grade1_catalog t
join public.subjects sub on sub.name=t.unit->>'subject'
  and sub.school_id is null and sub.global_subject_id is null
join public.cbc_strands s on s.subject_id=sub.id and s.grade='Grade 1'
  and s.name=t.unit->>'strand' and s.sub_strand=t.unit->>'title'
on conflict (source_ref) do nothing;

insert into public.curriculum_unit_guidance
  (sub_strand_id,suggested_lessons,learning_resources,assessment_methods,
   competencies,safety_notes,content_status)
select b.sub_strand_id,(t.unit->>'lessons')::integer,
  t.unit->>'resources',t.unit->>'assessment',t.unit->>'competencies',
  t.unit->>'safety','active'
from _vs_grade1_catalog t
join public.grade1_curriculum_reader_bindings b on b.source_ref=t.source_ref
on conflict (sub_strand_id) do nothing;

insert into public.curriculum_learning_outcomes
  (sub_strand_id,outcome_text,outcome_code,source_type,source_ref,status)
select b.sub_strand_id,o.text,
  'VS-G1-'||case when t.unit->>'subject'='Mathematics' then 'MA' else 'EN' end
    ||'-'||(t.unit->>'unit_id')||'-'||chr(96+o.ordinality::integer),
  'creator_claimed',t.source_ref||'/'||chr(96+o.ordinality::integer),'active'
from _vs_grade1_catalog t
join public.grade1_curriculum_reader_bindings b on b.source_ref=t.source_ref
cross join lateral jsonb_array_elements_text(t.unit->'outcomes')
  with ordinality as o(text,ordinality)
on conflict do nothing;

drop policy if exists grade1_math_english_authored_outcomes_read on public.curriculum_learning_outcomes;
create policy grade1_math_english_authored_outcomes_read on public.curriculum_learning_outcomes
  for select to authenticated using (
    status='active' and source_type='creator_claimed' and created_by is null
    and (source_ref like 'VS-CUR-G01-MA-2026#%' or source_ref like 'VS-CUR-G01-EN-2026#%')
  );

drop policy if exists grade1_math_english_guidance_read on public.curriculum_unit_guidance;
create policy grade1_math_english_guidance_read on public.curriculum_unit_guidance
  for select to authenticated using (
    content_status='active' and exists (
      select 1 from public.grade1_curriculum_reader_bindings b
      where b.sub_strand_id=curriculum_unit_guidance.sub_strand_id and b.status='active'
    )
  );

do $verify$
begin
  if (select count(*) from public.grade1_curriculum_reader_bindings b
      where b.source_ref like 'VS-CUR-G01-MA-2026#%')<>11
     or (select count(*) from public.grade1_curriculum_reader_bindings b
      where b.source_ref like 'VS-CUR-G01-EN-2026#%')<>13
     or (select count(*) from public.curriculum_learning_outcomes
      where source_ref like 'VS-CUR-G01-MA-2026#%' and status='active')<>54
     or (select count(*) from public.curriculum_learning_outcomes
      where source_ref like 'VS-CUR-G01-EN-2026#%' and status='active')<>58
     or (select count(*) from public.curriculum_unit_guidance g
       join public.grade1_curriculum_reader_bindings b on b.sub_strand_id=g.sub_strand_id
       where b.source_ref like 'VS-CUR-G01-MA-2026#%' or b.source_ref like 'VS-CUR-G01-EN-2026#%')<>24
     or exists(
       select 1 from public.grade1_curriculum_reader_bindings b
       join _vs_grade1_catalog t on b.source_ref=t.source_ref
       join public.cbc_strands s on s.id=b.sub_strand_id
       join public.subjects sub on sub.id=s.subject_id
       where s.grade<>'Grade 1' or sub.name<>t.unit->>'subject'
          or sub.school_id is not null or s.name<>t.unit->>'strand'
          or s.sub_strand<>t.unit->>'title'
     )
  then raise exception 'GRADE1_READER_PERSISTED_MAPPING_INCOMPLETE'; end if;
end;
$verify$;

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
  select * into v_unit from public.cbc_strands
  where id=p_sub_strand_id and grade='Grade 1'
    and (source_ref like 'VS-CUR-G01-CA-2026#%'
      or exists (select 1 from public.grade1_curriculum_reader_bindings b
                 where b.sub_strand_id=id and b.status='active'));
  if not found then raise exception 'SCHEME_CURRICULUM_SUBSTRAND_NOT_FOUND'; end if;

  select b.source_ref,b.key_inquiry_questions,b.suggested_experiences
    into v_reader_ref,v_reader_inquiry,v_reader_experiences
  from public.grade1_curriculum_reader_bindings b
  where b.sub_strand_id=v_unit.id and b.status='active';
  if not found then
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
      reference=v_reader_ref||' (VibeSchool-authored; KICD reconciliation pending)'
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
