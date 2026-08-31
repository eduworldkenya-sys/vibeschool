begin;

-- Grade 6 Social Studies Term 3 production seed.
-- Authority: KICD revised 2024 Grade 6 Social Studies design, strands 4.0 and 5.0.
-- Seven sub-strands, 28 KICD lessons, canonical five-layer VibeSchool learning loop.


do $$
begin
  if not exists (
    select 1 from public.subjects
    where school_id is null and lower(btrim(name))='social studies'
  ) then
    raise exception 'GRADE6_SOCIAL_STUDIES_GLOBAL_SUBJECT_REQUIRED';
  end if;
  if not exists (
    select 1 from public.vibe_publications
    where author_id is not null
  ) then
    raise exception 'VIBE_PUBLICATION_AUTHOR_REQUIRED';
  end if;
end $$;


insert into public.curriculum
(id,curriculum,grade,subject,term,week,strand,sub_strand,topic,periods,reference,global_subject_id)
select '66064100-0000-4000-8000-000000000003'::uuid,
       'CBC Primary Social Studies Revised 2024',
       'Grade 6','Social Studies',3,0,
       '4.0 Political Systems','4.1 Traditional Forms of Government',
       'Describe traditional forms of government of the Buganda and Nyamwezi in Eastern Africa. | Compare traditional forms of government of the Buganda and Nyamwezi. | Value aspects of good governance in traditional societies.',5,
       'KICD Primary School Education Curriculum Design, Social Studies Grade 6, Revised 2024, pp. 51-66; https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-6-Social-studies-Revised-Oct-1.pdf',
       s.id
from public.subjects s
where s.school_id is null and lower(btrim(s.name))='social studies'
on conflict (id) do update set
  curriculum=excluded.curriculum,grade=excluded.grade,subject=excluded.subject,term=excluded.term,
  strand=excluded.strand,sub_strand=excluded.sub_strand,topic=excluded.topic,periods=excluded.periods,
  reference=excluded.reference,global_subject_id=excluded.global_subject_id;


insert into public.curriculum
(id,curriculum,grade,subject,term,week,strand,sub_strand,topic,periods,reference,global_subject_id)
select '66064200-0000-4000-8000-000000000003'::uuid,
       'CBC Primary Social Studies Revised 2024',
       'Grade 6','Social Studies',3,0,
       '4.0 Political Systems','4.2 Regional Co-operations',
       'Explain the objectives of the East African Community. | Describe benefits of the East African Community to member states. | Identify challenges facing the East African Community. | Formulate possible solutions to challenges facing the East African Community. | Value the unity of Eastern African countries.',4,
       'KICD Primary School Education Curriculum Design, Social Studies Grade 6, Revised 2024, pp. 51-66; https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-6-Social-studies-Revised-Oct-1.pdf',
       s.id
from public.subjects s
where s.school_id is null and lower(btrim(s.name))='social studies'
on conflict (id) do update set
  curriculum=excluded.curriculum,grade=excluded.grade,subject=excluded.subject,term=excluded.term,
  strand=excluded.strand,sub_strand=excluded.sub_strand,topic=excluded.topic,periods=excluded.periods,
  reference=excluded.reference,global_subject_id=excluded.global_subject_id;


insert into public.curriculum
(id,curriculum,grade,subject,term,week,strand,sub_strand,topic,periods,reference,global_subject_id)
select '66064300-0000-4000-8000-000000000003'::uuid,
       'CBC Primary Social Studies Revised 2024',
       'Grade 6','Social Studies',3,0,
       '4.0 Political Systems','4.3 Citizenship',
       'Describe the rights and responsibilities of a Kenyan citizen. | State qualities of a good Kenyan citizen. | Demonstrate values of a good Kenyan citizen. | Appreciate patriotism as a Kenyan citizen.',4,
       'KICD Primary School Education Curriculum Design, Social Studies Grade 6, Revised 2024, pp. 51-66; https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-6-Social-studies-Revised-Oct-1.pdf',
       s.id
from public.subjects s
where s.school_id is null and lower(btrim(s.name))='social studies'
on conflict (id) do update set
  curriculum=excluded.curriculum,grade=excluded.grade,subject=excluded.subject,term=excluded.term,
  strand=excluded.strand,sub_strand=excluded.sub_strand,topic=excluded.topic,periods=excluded.periods,
  reference=excluded.reference,global_subject_id=excluded.global_subject_id;


insert into public.curriculum
(id,curriculum,grade,subject,term,week,strand,sub_strand,topic,periods,reference,global_subject_id)
select '66064400-0000-4000-8000-000000000003'::uuid,
       'CBC Primary Social Studies Revised 2024',
       'Grade 6','Social Studies',3,0,
       '4.0 Political Systems','4.4 Human Rights',
       'Explain classification of human rights in society. | Describe ways in which human rights are upheld in society. | Demonstrate ways in which human rights are upheld in society. | Value respect for human rights in Kenya.',4,
       'KICD Primary School Education Curriculum Design, Social Studies Grade 6, Revised 2024, pp. 51-66; https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-6-Social-studies-Revised-Oct-1.pdf',
       s.id
from public.subjects s
where s.school_id is null and lower(btrim(s.name))='social studies'
on conflict (id) do update set
  curriculum=excluded.curriculum,grade=excluded.grade,subject=excluded.subject,term=excluded.term,
  strand=excluded.strand,sub_strand=excluded.sub_strand,topic=excluded.topic,periods=excluded.periods,
  reference=excluded.reference,global_subject_id=excluded.global_subject_id;


insert into public.curriculum
(id,curriculum,grade,subject,term,week,strand,sub_strand,topic,periods,reference,global_subject_id)
select '66065100-0000-4000-8000-000000000003'::uuid,
       'CBC Primary Social Studies Revised 2024',
       'Grade 6','Social Studies',3,0,
       '5.0 Governance','5.1 Peace and Conflict Resolution',
       'Explain causes of conflicts in society today. | Describe peaceful methods of resolving conflicts in society. | Illustrate ways of promoting peace in society. | Value peaceful ways of resolving conflicts in society.',4,
       'KICD Primary School Education Curriculum Design, Social Studies Grade 6, Revised 2024, pp. 51-66; https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-6-Social-studies-Revised-Oct-1.pdf',
       s.id
from public.subjects s
where s.school_id is null and lower(btrim(s.name))='social studies'
on conflict (id) do update set
  curriculum=excluded.curriculum,grade=excluded.grade,subject=excluded.subject,term=excluded.term,
  strand=excluded.strand,sub_strand=excluded.sub_strand,topic=excluded.topic,periods=excluded.periods,
  reference=excluded.reference,global_subject_id=excluded.global_subject_id;


insert into public.curriculum
(id,curriculum,grade,subject,term,week,strand,sub_strand,topic,periods,reference,global_subject_id)
select '66065200-0000-4000-8000-000000000003'::uuid,
       'CBC Primary Social Studies Revised 2024',
       'Grade 6','Social Studies',3,0,
       '5.0 Governance','5.2 Government Revenue and Expenditure',
       'Identify sources of revenue for the National Government in Kenya. | Explain ways in which national and county governments in Kenya spend their revenue. | Acknowledge the importance of paying taxes.',4,
       'KICD Primary School Education Curriculum Design, Social Studies Grade 6, Revised 2024, pp. 51-66; https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-6-Social-studies-Revised-Oct-1.pdf',
       s.id
from public.subjects s
where s.school_id is null and lower(btrim(s.name))='social studies'
on conflict (id) do update set
  curriculum=excluded.curriculum,grade=excluded.grade,subject=excluded.subject,term=excluded.term,
  strand=excluded.strand,sub_strand=excluded.sub_strand,topic=excluded.topic,periods=excluded.periods,
  reference=excluded.reference,global_subject_id=excluded.global_subject_id;


insert into public.curriculum
(id,curriculum,grade,subject,term,week,strand,sub_strand,topic,periods,reference,global_subject_id)
select '66065300-0000-4000-8000-000000000003'::uuid,
       'CBC Primary Social Studies Revised 2024',
       'Grade 6','Social Studies',3,0,
       '5.0 Governance','5.3 The Preamble of the Constitution of Kenya',
       'Identify key words in the preamble of the Constitution of Kenya. | Explain the meaning of key words in the preamble. | Uphold the Constitution of Kenya in society.',3,
       'KICD Primary School Education Curriculum Design, Social Studies Grade 6, Revised 2024, pp. 51-66; https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-6-Social-studies-Revised-Oct-1.pdf',
       s.id
from public.subjects s
where s.school_id is null and lower(btrim(s.name))='social studies'
on conflict (id) do update set
  curriculum=excluded.curriculum,grade=excluded.grade,subject=excluded.subject,term=excluded.term,
  strand=excluded.strand,sub_strand=excluded.sub_strand,topic=excluded.topic,periods=excluded.periods,
  reference=excluded.reference,global_subject_id=excluded.global_subject_id;


insert into public.vibe_publications
(id,author_id,format,title,subtitle,description,genre,tags,language,status,pricing,chapter_count,
 cbc_subject,cbc_grade,cbc_aligned,series_name,series_number,publication_name,published_at,curriculum_framework)
select '66060000-0000-4000-8000-000000000003'::uuid,
       (select author_id from public.vibe_publications where author_id is not null order by
         (case when format='vibetextbook' then 0 else 1 end), created_at asc limit 1),
       'vibetextbook',
       'Vibe Social Studies Grade 6 — Term 3',
       'Political Systems and Governance',
       'A KICD-aligned Grade 6 Social Studies learning system for Term 3: 28 lesson sequence, explanation, inquiry, activities, checkpoints, Kenyan context, misconceptions, teacher bridges and mastery practice.',
       'Education',
       array['Grade 6','Social Studies','CBC','KICD','Term 3','Kenya'],
       'English','published',
       '{"type":"free"}'::jsonb,7,
       'social_studies','grade6',true,
       'Vibe Social Studies Grade 6',3,'Term 3',now(),'CBC Revised 2024'
on conflict (id) do update set
 title=excluded.title,subtitle=excluded.subtitle,description=excluded.description,tags=excluded.tags,
 status='published',chapter_count=7,cbc_subject=excluded.cbc_subject,cbc_grade=excluded.cbc_grade,
 cbc_aligned=true,published_at=coalesce(public.vibe_publications.published_at,now()),
 curriculum_framework=excluded.curriculum_framework,updated_at=now();

-- Content payloads are intentionally original VibeSchool pedagogy, not copied textbook prose.

insert into public.vibe_chapters
(id,publication_id,title,number,blocks,status,word_count,reading_time_min,learning_outcomes,cbc_strand,
 published_at,curriculum_id,content_pack_version,alignment_status,verification_notes)
values (
  '6606c001-0000-4000-8000-000000000003'::uuid,'66060000-0000-4000-8000-000000000003'::uuid,'Traditional Forms of Government: Buganda and Nyamwezi',1,
  '[{"id":"g6ss-t3-1-01","type":"heading1","content":"How were communities governed before modern states?","meta":{"learning_layer":"orient"}},{"id":"g6ss-t3-1-02","type":"paragraph","content":"Before constitutions, county assemblies and national parliaments, communities in Eastern Africa already had organised ways of choosing leaders, making decisions, settling disputes, defending territory and collecting resources. In this chapter you will investigate two examples: Buganda, in the area of present-day Uganda, and the Nyamwezi of present-day Tanzania. The goal is not to memorise titles. It is to understand how authority was organised, how leaders depended on other officials, and what these systems can teach us about responsible leadership.","meta":{"learning_layer":"orient"}},{"id":"g6ss-t3-1-03","type":"callout","content":"Inquiry question: How were communities governed in the past, and which practices helped leaders serve their people well?","meta":{"learning_layer":"orient"}},{"id":"g6ss-t3-1-lesson-1-h","type":"heading2","content":"Lesson 1 — Locating Buganda and Nyamwezi","meta":{"learning_layer":"comprehend","kind":"lesson","lesson_number":1}},{"id":"g6ss-t3-1-lesson-1-p","type":"paragraph","content":"Use an Eastern Africa map to locate the historical areas associated with Buganda around the north-western shores of Lake Victoria and Nyamwezi communities in central Tanzania. Introduce the idea of a political system as the organised way a society makes decisions, exercises authority and maintains order. Learners should distinguish a community from its government: many people can share language and culture while authority may be organised through one kingdom, several chiefdoms or other institutions. Ask learners to predict which system might allow decisions to travel faster across a large territory and what problems could arise if too much power is concentrated in one person.","meta":{"learning_layer":"comprehend","kind":"lesson","lesson_number":1}},{"id":"g6ss-t3-1-lesson-2-h","type":"heading2","content":"Lesson 2 — Government in Buganda","meta":{"learning_layer":"comprehend","kind":"lesson","lesson_number":2}},{"id":"g6ss-t3-1-lesson-2-p","type":"paragraph","content":"Study a simple governance chart with the Kabaka at the centre, the Lukiiko as an important council and chiefs carrying administration into counties and local areas. Explain that titles and responsibilities changed over time, so learners should focus on the structure rather than memorising every office. Trace a fictional decision—repairing a major route—from discussion to direction and local implementation. Then reverse the flow: how might a local problem reach higher authorities? This develops understanding that government needs both decision-making and communication.","meta":{"learning_layer":"comprehend","kind":"lesson","lesson_number":2}},{"id":"g6ss-t3-1-lesson-3-h","type":"heading2","content":"Lesson 3 — Government among the Nyamwezi","meta":{"learning_layer":"comprehend","kind":"lesson","lesson_number":3}},{"id":"g6ss-t3-1-lesson-3-p","type":"paragraph","content":"Examine the organisation of several Nyamwezi chiefdoms led by chiefs with support from elders and other leaders. Explain why a network of separate chiefdoms differs from a single centralised kingdom. Use a trade-caravan scenario to show why leadership, security, dispute settlement and relations with neighbours mattered. Learners create a diagram that places the chief at the local centre and shows advisers, community groups and neighbouring chiefdoms. Emphasise that decentralised does not mean disorganised.","meta":{"learning_layer":"comprehend","kind":"lesson","lesson_number":3}},{"id":"g6ss-t3-1-lesson-4-h","type":"heading2","content":"Lesson 4 — Comparison and good governance","meta":{"learning_layer":"comprehend","kind":"lesson","lesson_number":4}},{"id":"g6ss-t3-1-lesson-4-p","type":"paragraph","content":"Use a Venn diagram to compare leadership, advisers, administration and degree of centralisation. Move from ''what was different?'' to ''why might the difference matter?'' Learners then evaluate a fictional ruler using criteria such as consultation, fairness, responsibility and peaceful dispute resolution. They must support each judgement with evidence. This lesson builds the KICD value outcome by connecting historical structures to principles of good governance without pretending that past systems were identical to Kenya''s present constitutional order.","meta":{"learning_layer":"comprehend","kind":"lesson","lesson_number":4}},{"id":"g6ss-t3-1-lesson-5-h","type":"heading2","content":"Lesson 5 — Performance task and mastery","meta":{"learning_layer":"comprehend","kind":"lesson","lesson_number":5}},{"id":"g6ss-t3-1-lesson-5-p","type":"paragraph","content":"Learners independently draw two labelled governance structures, write one paragraph comparing them and complete a role-play showing a governance problem being handled responsibly. Use a four-level rubric: accurate description, meaningful comparison, evidence of good-governance values and clear communication. Remediate learners who only list titles by asking them to explain what each office actually did and how decisions moved through the system.","meta":{"learning_layer":"comprehend","kind":"lesson","lesson_number":5}},{"id":"g6ss-t3-1-04","type":"heading2","content":"Buganda: a highly centralised kingdom","meta":{"learning_layer":"comprehend"}},{"id":"g6ss-t3-1-05","type":"paragraph","content":"Buganda developed a strongly centralised political system around the Kabaka, the king. The Kabaka was the highest political authority, but he did not govern every village personally. He worked through appointed chiefs and a council known as the Lukiiko. Chiefs helped administer counties, collect tribute, organise labour and communicate royal decisions. The Lukiiko brought important chiefs and other leaders together to advise on public matters. This structure allowed decisions from the centre to reach local communities while information from local areas could also move upward. The Kabaka''s authority was therefore powerful, but governing depended on an organised network of officials.","meta":{"learning_layer":"comprehend"}},{"id":"g6ss-t3-1-06","type":"heading2","content":"Nyamwezi: chiefs, communities and trade networks","meta":{"learning_layer":"comprehend"}},{"id":"g6ss-t3-1-07","type":"paragraph","content":"The Nyamwezi lived in a wide area of central Tanzania and were organised in several chiefdoms rather than one single kingdom controlling all Nyamwezi communities. A chief, often called an ntemi in historical accounts, led a chiefdom with the support of elders and other community leaders. Leadership involved settling disputes, protecting the community, organising collective activities and maintaining relations with neighbouring groups. Long-distance trade also increased the importance of some chiefs because safe routes, markets and alliances required organisation. The system was therefore less centralised than Buganda: authority was spread among a number of chiefdoms instead of being concentrated under one king.","meta":{"learning_layer":"comprehend"}},{"id":"g6ss-t3-1-08","type":"heading2","content":"Compare the two systems","meta":{"learning_layer":"apply"}},{"id":"g6ss-t3-1-09","type":"activity","content":"Create a two-column comparison chart. Under Buganda, record: central king, appointed chiefs and the Lukiiko. Under Nyamwezi, record: several chiefdoms, local chiefs and elders. Then add at least two similarities, such as the use of recognised leaders and the need to maintain order, and two differences, especially the degree of centralisation.","meta":{"learning_layer":"apply","evidence_required":true}},{"id":"g6ss-t3-1-10","type":"callout","content":"Misconception check: ''Traditional government'' does not mean there were no rules or institutions. Both societies had organised authority. The important difference is how power was arranged and shared.","meta":{"learning_layer":"apply"}},{"id":"g6ss-t3-1-11","type":"heading2","content":"Good governance then and now","meta":{"learning_layer":"connect"}},{"id":"g6ss-t3-1-12","type":"paragraph","content":"A leadership system can be judged by more than the title of its ruler. Good governance includes listening to people, acting fairly, using authority responsibly, resolving disputes peacefully and ensuring that leaders are accountable for their decisions. Some traditional institutions encouraged consultation through councils or elders; others could also concentrate power strongly in a ruler. When we study the past, we should recognise both organisation and limitations. Today Kenya''s constitutional system is different, but learners can still ask the same civic questions: Are leaders serving the public? Are decisions fair? Can people raise concerns?","meta":{"learning_layer":"connect"}},{"id":"g6ss-t3-1-13","type":"question","content":"Checkpoint: Why would it be inaccurate to say Buganda and the Nyamwezi had exactly the same political organisation? Give one similarity and one difference.","meta":{"learning_layer":"apply","diagnostic":true}},{"id":"g6ss-t3-1-14","type":"activity","content":"Role-play a council meeting. One group represents a Buganda-style council advising the Kabaka; another represents elders advising a Nyamwezi chief. The issue is how to share water during a dry season. Afterwards identify the actions that showed fairness, consultation and responsibility.","meta":{"learning_layer":"extend","evidence_required":true}},{"id":"g6ss-t3-1-15","type":"callout","content":"Teacher bridge: Ask learners to draw and label both governance structures, then use the diagrams as evidence in an oral comparison. Assess accuracy, comparison language and ability to identify one good-governance principle.","meta":{"learning_layer":"extend"}}]'::jsonb,'published',1022,6,array['Describe traditional forms of government of the Buganda and Nyamwezi in Eastern Africa.','Compare traditional forms of government of the Buganda and Nyamwezi.','Value aspects of good governance in traditional societies.']::text[],'4.0 Political Systems',
  now(),'66064100-0000-4000-8000-000000000003'::uuid,1,'creator_claimed','Curriculum mapping authored against the official KICD Grade 6 Social Studies revised 2024 design; no human verifier fabricated.'
)
on conflict (id) do update set title=excluded.title,number=excluded.number,blocks=excluded.blocks,status='published',word_count=excluded.word_count,reading_time_min=excluded.reading_time_min,learning_outcomes=excluded.learning_outcomes,cbc_strand=excluded.cbc_strand,published_at=coalesce(public.vibe_chapters.published_at,now()),curriculum_id=excluded.curriculum_id,content_pack_version=excluded.content_pack_version,alignment_status='creator_claimed',verified_by=null,verified_at=null,verification_notes=excluded.verification_notes,updated_at=now();

-- Chapters 2-7 are seeded with the same canonical contract using compact JSON construction for readability.

insert into public.vibe_chapters
(id,publication_id,title,number,blocks,status,word_count,reading_time_min,learning_outcomes,cbc_strand,published_at,curriculum_id,content_pack_version,alignment_status,verification_notes)
select v.id,'66060000-0000-4000-8000-000000000003'::uuid,v.title,v.number,v.blocks,'published',v.word_count,greatest(1,ceil(v.word_count/180.0)::int),v.outcomes,v.strand,now(),v.curriculum_id,1,'creator_claimed','Curriculum mapping authored against the official KICD Grade 6 Social Studies revised 2024 design; no human verifier fabricated.'
from (values
('6606c002-0000-4000-8000-000000000003'::uuid,2,'Regional Co-operation: The East African Community','4.0 Political Systems','66064200-0000-4000-8000-000000000003'::uuid,array['Explain the objectives of the East African Community.','Describe benefits of the East African Community to member states.','Identify challenges facing the East African Community.','Formulate possible solutions to challenges facing the East African Community.','Value the unity of Eastern African countries.']::text[],836,jsonb_build_array(
jsonb_build_object('id','g6ss-t3-2-o','type','heading1','content','Why do neighbouring countries cooperate?','meta',jsonb_build_object('learning_layer','orient')),
jsonb_build_object('id','g6ss-t3-2-op','type','paragraph','content','A road can cross a border, a trader can sell goods in another country, a disease can spread across several countries and a lake can be shared by many communities. Problems and opportunities do not stop at political borders. The East African Community, or EAC, is a regional organisation through which member states cooperate in trade, transport, movement of people, health, peace and development. Focus on why cooperation matters rather than memorising a list of offices.','meta',jsonb_build_object('learning_layer','orient')),
jsonb_build_object('id','g6ss-t3-2-l1','type','paragraph','content','Lesson 1 — Why countries cooperate. Use border-crossing examples: Kenyan tea moving to a regional market, a family travelling by road, a disease outbreak, a shared lake and a wildlife corridor. Learners decide which challenges one country can solve alone and which need neighbours. Build the difference between merely being neighbours and deliberately cooperating through institutions, agreements and joint action.','meta',jsonb_build_object('learning_layer','comprehend','lesson_number',1)),
jsonb_build_object('id','g6ss-t3-2-l2','type','paragraph','content','Lesson 2 — Objectives in action. Turn EAC objectives into cases: reducing unnecessary trade barriers, connecting infrastructure, coordinating cross-border health responses, encouraging investment and strengthening peaceful relations. Learners match fictional projects to objectives and explain why the match makes sense. Mastery is explanation of purpose, not memorisation of institutional names.','meta',jsonb_build_object('learning_layer','comprehend','lesson_number',2)),
jsonb_build_object('id','g6ss-t3-2-l3','type','paragraph','content','Lesson 3 — Benefits and challenges. Build a two-sided evidence board. Benefits can include larger markets, easier movement, tourism, infrastructure and coordinated responses. Challenges can include unequal benefits, border delays, different rules, financing gaps and political disagreement. Each challenge must be paired with a plausible solution such as dialogue, harmonised standards, shared infrastructure or fair dispute resolution.','meta',jsonb_build_object('learning_layer','comprehend','lesson_number',3)),
jsonb_build_object('id','g6ss-t3-2-l4','type','paragraph','content','Lesson 4 — Regional problem-solving summit. Groups represent fictional partner states with a shared transport problem. Each state has one national concern, but all need a regional agreement. They negotiate three actions and present a joint statement. Reflection asks why cooperation requires compromise, transparent rules and trust.','meta',jsonb_build_object('learning_layer','comprehend','lesson_number',4)),
jsonb_build_object('id','g6ss-t3-2-c','type','paragraph','content','Regional cooperation can create larger markets for farmers, manufacturers and service providers. Better transport can reduce travel time and costs. Students, workers and businesses may gain opportunities when rules are harmonised. Governments can also cooperate on disease control, environment, security and tourism. Cooperation is harder when economic interests, laws, levels of development and political priorities differ.','meta',jsonb_build_object('learning_layer','comprehend')),
jsonb_build_object('id','g6ss-t3-2-a','type','activity','content','Map task: using a current teacher-vetted source, locate EAC member states. Add two arrows showing examples of cooperation and a map key. Then design a poster with one EAC objective, two benefits, one challenge and one realistic solution.','meta',jsonb_build_object('learning_layer','apply','evidence_required',true)),
jsonb_build_object('id','g6ss-t3-2-m','type','callout','content','Current-information rule: EAC membership can change. Verify the current official membership before teaching a dated list. The enduring objective is understanding regional cooperation.','meta',jsonb_build_object('learning_layer','apply')),
jsonb_build_object('id','g6ss-t3-2-q','type','question','content','Checkpoint: A border post has delays that make fresh produce spoil. Which regional objective is affected, and propose one practical solution.','meta',jsonb_build_object('learning_layer','apply','diagnostic',true)),
jsonb_build_object('id','g6ss-t3-2-k','type','paragraph','content','Regional unity does not require countries to become identical. Partner states retain national institutions and cultures while cooperating on shared goals. Good regionalism respects identity while building trust and peaceful ways to handle disagreement.','meta',jsonb_build_object('learning_layer','connect')),
jsonb_build_object('id','g6ss-t3-2-e','type','callout','content','Teacher bridge: assess explanation, evidence, teamwork and whether a proposed solution actually addresses the stated regional challenge.','meta',jsonb_build_object('learning_layer','extend'))
)),
('6606c003-0000-4000-8000-000000000003'::uuid,3,'Citizenship: Rights, Responsibilities and Patriotism','4.0 Political Systems','66064300-0000-4000-8000-000000000003'::uuid,array['Describe the rights and responsibilities of a Kenyan citizen.','State qualities of a good Kenyan citizen.','Demonstrate values of a good Kenyan citizen.','Appreciate patriotism as a Kenyan citizen.']::text[],764,jsonb_build_array(
jsonb_build_object('id','g6ss-t3-3-o','type','heading1','content','Citizenship is something we practise','meta',jsonb_build_object('learning_layer','orient')),
jsonb_build_object('id','g6ss-t3-3-op','type','paragraph','content','Citizenship is a legal relationship with a country, but for a Grade 6 learner it is also responsible participation in society. Citizens have rights that protect dignity and freedom, and responsibilities that help communities and public institutions work. A good citizen can practise respect, honesty, care for public property and concern for others long before adulthood.','meta',jsonb_build_object('learning_layer','orient')),
jsonb_build_object('id','g6ss-t3-3-l1','type','paragraph','content','Lesson 1 — What makes someone a citizen? Distinguish citizenship, residence and visiting without advanced nationality law. Learners explore why citizens have rights and responsibilities and build linked circles labelled rights protect me and responsibilities help us live together. Correct the misconception that citizenship is merely possessing an identity document.','meta',jsonb_build_object('learning_layer','comprehend','lesson_number',1)),
jsonb_build_object('id','g6ss-t3-3-l2','type','paragraph','content','Lesson 2 — Rights and responsibilities. Pair freedom of expression with respect for others, public facilities with care for public property, and access to services with respect for lawful procedures. Learners explain how irresponsible exercise of a right can harm another person. Keep examples age-appropriate.','meta',jsonb_build_object('learning_layer','comprehend','lesson_number',2)),
jsonb_build_object('id','g6ss-t3-3-l3','type','paragraph','content','Lesson 3 — Values through dilemmas. A learner finds exam answers, sees a public tap left running and hears a harmful rumour. Learners choose an action and name the value behind it: integrity, respect, responsibility, unity or concern for the common good. Discuss why good citizenship sometimes takes courage.','meta',jsonb_build_object('learning_layer','comprehend','lesson_number',3)),
jsonb_build_object('id','g6ss-t3-3-l4','type','paragraph','content','Lesson 4 — Patriotism as constructive action. Compare slogans with practical patriotism: caring for Kenya, protecting shared resources, respecting diversity, following constitutional values and helping improve society. Learners create a short poem plus one practical action.','meta',jsonb_build_object('learning_layer','comprehend','lesson_number',4)),
jsonb_build_object('id','g6ss-t3-3-a','type','activity','content','Scenario sort: classify returning a lost school tablet, damaging a public tap, peacefully reporting a safety problem, spreading an unverified rumour and helping clean a shared space. Explain each decision.','meta',jsonb_build_object('learning_layer','apply','evidence_required',true)),
jsonb_build_object('id','g6ss-t3-3-m','type','callout','content','Misconception check: patriotism does not mean agreeing with every leader or insulting people from other countries. Responsible patriotism includes caring for Kenya and contributing to a fair, peaceful society.','meta',jsonb_build_object('learning_layer','apply')),
jsonb_build_object('id','g6ss-t3-3-q','type','question','content','Checkpoint: give one right and one responsibility that can exist together in the same situation. Explain the connection.','meta',jsonb_build_object('learning_layer','apply','diagnostic',true)),
jsonb_build_object('id','g6ss-t3-3-k','type','paragraph','content','A learner demonstrates citizenship by rejecting bullying, using public resources carefully, listening to different views and solving disagreements peacefully. These actions turn citizenship from a textbook word into habits that strengthen society.','meta',jsonb_build_object('learning_layer','connect')),
jsonb_build_object('id','g6ss-t3-3-e','type','activity','content','Create a six-point Good Citizen Code and a short spoken-word piece titled My Kenya, My Responsibility. Every point must name a concrete action and a value.','meta',jsonb_build_object('learning_layer','extend','evidence_required',true))
)),
('6606c004-0000-4000-8000-000000000003'::uuid,4,'Human Rights: Respecting Dignity in Society','4.0 Political Systems','66064400-0000-4000-8000-000000000003'::uuid,array['Explain classification of human rights in society.','Describe ways in which human rights are upheld in society.','Demonstrate ways in which human rights are upheld in society.','Value respect for human rights in Kenya.']::text[],728,jsonb_build_array(
jsonb_build_object('id','g6ss-t3-4-o','type','heading1','content','What changes when we treat every person as having dignity?','meta',jsonb_build_object('learning_layer','orient')),
jsonb_build_object('id','g6ss-t3-4-op','type','paragraph','content','Human rights are basic protections and freedoms that recognise the dignity of every person. KICD groups rights here into political, social and economic categories. These groups organise ideas, but real-life rights often overlap. Education, for example, can influence later economic opportunity and civic participation.','meta',jsonb_build_object('learning_layer','orient')),
jsonb_build_object('id','g6ss-t3-4-l1','type','paragraph','content','Lesson 1 — Human dignity and categories. Learners classify safe examples as political, social or economic and discuss overlaps. Correct the idea that one category is automatically more important than another.','meta',jsonb_build_object('learning_layer','comprehend','lesson_number',1)),
jsonb_build_object('id','g6ss-t3-4-l2','type','paragraph','content','Lesson 2 — How rights are protected. Map a protection network around a fictional learner: Constitution and laws, family, school rules, courts, public institutions and responsible citizens. Explain that different problems require different safe channels.','meta',jsonb_build_object('learning_layer','comprehend','lesson_number',2)),
jsonb_build_object('id','g6ss-t3-4-l3','type','paragraph','content','Lesson 3 — Respecting rights daily. Use fictional situations involving discrimination, exclusion, privacy, bullying and fair hearing. Learners identify the dignity issue, propose a safe response and explain whose responsibility is involved. Never require personal disclosures.','meta',jsonb_build_object('learning_layer','comprehend','lesson_number',3)),
jsonb_build_object('id','g6ss-t3-4-l4','type','paragraph','content','Lesson 4 — Performance task. Groups role-play a fictional situation first with rights ignored and then with a fair process. Observers check dignity, listening, non-discrimination, safety and lawful help-seeking.','meta',jsonb_build_object('learning_layer','comprehend','lesson_number',4)),
jsonb_build_object('id','g6ss-t3-4-a','type','activity','content','Create a three-part concept map labelled Political, Social and Economic. Add examples, then draw links where one example overlaps categories and explain why.','meta',jsonb_build_object('learning_layer','apply','evidence_required',true)),
jsonb_build_object('id','g6ss-t3-4-s','type','callout','content','Safety rule: do not ask a learner to disclose abuse, family conflict or private experiences. Use fictional scenarios and direct real safety concerns to trusted adults and appropriate protection channels.','meta',jsonb_build_object('learning_layer','apply')),
jsonb_build_object('id','g6ss-t3-4-q','type','question','content','Checkpoint: why is saying I have a right not a good reason to ignore everyone else’s rights? Give an example.','meta',jsonb_build_object('learning_layer','apply','diagnostic',true)),
jsonb_build_object('id','g6ss-t3-4-k','type','paragraph','content','Rights are upheld in daily Kenya when schools prevent bullying, provide fair processes, support inclusion and reject discrimination. Communities strengthen rights when they protect vulnerable people and use peaceful lawful ways to challenge unfairness.','meta',jsonb_build_object('learning_layer','connect')),
jsonb_build_object('id','g6ss-t3-4-e','type','callout','content','Teacher bridge: reward correct classification, explanation of how rights are upheld and respectful application—not memorisation of long legal phrases.','meta',jsonb_build_object('learning_layer','extend'))
)),
('6606c005-0000-4000-8000-000000000003'::uuid,5,'Peace and Conflict Resolution','5.0 Governance','66065100-0000-4000-8000-000000000003'::uuid,array['Explain causes of conflicts in society today.','Describe peaceful methods of resolving conflicts in society.','Illustrate ways of promoting peace in society.','Value peaceful ways of resolving conflicts in society.']::text[],678,jsonb_build_array(
jsonb_build_object('id','g6ss-t3-5-o','type','heading1','content','Conflict is normal; violence is not the only response','meta',jsonb_build_object('learning_layer','orient')),
jsonb_build_object('id','g6ss-t3-5-op','type','paragraph','content','Conflict can arise from different needs, beliefs, interests or information. Causes include competition over resources, unfair treatment, rumours, misunderstanding and poor communication. A disagreement does not have to become violence. Peaceful resolution addresses the problem while protecting dignity, safety and relationships.','meta',jsonb_build_object('learning_layer','orient')),
jsonb_build_object('id','g6ss-t3-5-l1','type','paragraph','content','Lesson 1 — Causes. Build a conflict web and distinguish immediate trigger from deeper cause. Learners analyse fictional cases and ask what facts are still needed before blaming either side.','meta',jsonb_build_object('learning_layer','comprehend','lesson_number',1)),
jsonb_build_object('id','g6ss-t3-5-l2','type','paragraph','content','Lesson 2 — Dialogue and negotiation. Model active listening: one person speaks, the other summarises before responding. Learners identify shared interests and propose solutions. Compromise is useful only when safe and fair.','meta',jsonb_build_object('learning_layer','comprehend','lesson_number',2)),
jsonb_build_object('id','g6ss-t3-5-l3','type','paragraph','content','Lesson 3 — Mediation and lawful support. Compare direct dialogue, negotiation, mediation and formal authority. Use a decision tree beginning with safety: if anyone is at risk, seek adult or appropriate authority support.','meta',jsonb_build_object('learning_layer','comprehend','lesson_number',3)),
jsonb_build_object('id','g6ss-t3-5-l4','type','paragraph','content','Lesson 4 — Building peace before conflict. Fair rules, inclusive activities, respectful language, accurate information and trusted reporting reduce escalation. Learners audit a fictional school and propose improvements.','meta',jsonb_build_object('learning_layer','comprehend','lesson_number',4)),
jsonb_build_object('id','g6ss-t3-5-a','type','activity','content','Conflict ladder: identify where a fictional disagreement escalates, then rewrite the next three actions so it moves toward listening, negotiation or mediation.','meta',jsonb_build_object('learning_layer','apply','evidence_required',true)),
jsonb_build_object('id','g6ss-t3-5-m','type','callout','content','Misconception check: peace does not mean keeping quiet when something is wrong. Peaceful resolution can include firm reporting of injustice and seeking lawful help.','meta',jsonb_build_object('learning_layer','apply')),
jsonb_build_object('id','g6ss-t3-5-q','type','question','content','Checkpoint: two classmates both want to lead one project. Which peaceful method would you try first, and why?','meta',jsonb_build_object('learning_layer','apply','diagnostic',true)),
jsonb_build_object('id','g6ss-t3-5-k','type','paragraph','content','In Kenya’s diverse society, social cohesion grows when people refuse stereotypes, check rumours and solve shared problems across community differences. Peace is a system of daily practices, not only the absence of fighting.','meta',jsonb_build_object('learning_layer','connect')),
jsonb_build_object('id','g6ss-t3-5-e','type','activity','content','Design a five-step Peace Path poster: stop and stay safe; listen; identify the issue; choose a peaceful method; agree and review. Add when an adult or authority must be involved.','meta',jsonb_build_object('learning_layer','extend','evidence_required',true))
)),
('6606c006-0000-4000-8000-000000000003'::uuid,6,'Government Revenue and Expenditure','5.0 Governance','66065200-0000-4000-8000-000000000003'::uuid,array['Identify sources of revenue for the National Government in Kenya.','Explain ways in which national and county governments in Kenya spend their revenue.','Acknowledge the importance of paying taxes.']::text[],719,jsonb_build_array(
jsonb_build_object('id','g6ss-t3-6-o','type','heading1','content','How does government turn money into public services?','meta',jsonb_build_object('learning_layer','orient')),
jsonb_build_object('id','g6ss-t3-6-op','type','paragraph','content','Schools, hospitals, roads, security services, water projects and other public services require resources. Government revenue is money government receives for public responsibilities. Expenditure is money government spends. Public finance connects where resources come from, how they are planned and how they serve public purposes.','meta',jsonb_build_object('learning_layer','orient')),
jsonb_build_object('id','g6ss-t3-6-l1','type','paragraph','content','Lesson 1 — Revenue sources. Identify taxes, fees, charges, grants, public income and borrowing. Explain that borrowing must be repaid and should not be treated as free income. The key idea is that public services are funded from resources raised on behalf of the public.','meta',jsonb_build_object('learning_layer','comprehend','lesson_number',1)),
jsonb_build_object('id','g6ss-t3-6-l2','type','paragraph','content','Lesson 2 — Expenditure. Sort public-service examples by likely national or county responsibility using a teacher-vetted guide. Discuss why budgets must allocate limited resources among competing needs and why public money is not the personal money of officials.','meta',jsonb_build_object('learning_layer','comprehend','lesson_number',2)),
jsonb_build_object('id','g6ss-t3-6-l3','type','paragraph','content','Lesson 3 — Read a simplified budget of KSh 100 units. Learners calculate shares, draw a bar chart and explain trade-offs. Compare the fictional model with a teacher-selected current budget extract without freezing temporary tax rates into the textbook.','meta',jsonb_build_object('learning_layer','comprehend','lesson_number',3)),
jsonb_build_object('id','g6ss-t3-6-l4','type','paragraph','content','Lesson 4 — Tax and accountability. Trace a shilling conceptually from lawful collection into a budget and public service. Add oversight questions citizens can ask. Paying tax and using public money responsibly are linked parts of public finance.','meta',jsonb_build_object('learning_layer','comprehend','lesson_number',4)),
jsonb_build_object('id','g6ss-t3-6-a','type','activity','content','Budget detective: identify one revenue source and three spending areas in a teacher-selected simplified budget. Turn them into a graph and write one accountability question.','meta',jsonb_build_object('learning_layer','apply','evidence_required',true)),
jsonb_build_object('id','g6ss-t3-6-m','type','callout','content','Misconception check: government money is public money managed through laws and budgets. Paying tax does not mean a taxpayer personally chooses the exact project receiving that payment.','meta',jsonb_build_object('learning_layer','apply')),
jsonb_build_object('id','g6ss-t3-6-q','type','question','content','Checkpoint: explain the difference between revenue and expenditure using a public health centre as your example.','meta',jsonb_build_object('learning_layer','apply','diagnostic',true)),
jsonb_build_object('id','g6ss-t3-6-k','type','paragraph','content','Taxes pool resources so public services can be funded collectively. Citizens also have an interest in transparency and accountability so collection and spending follow the law and serve public purposes.','meta',jsonb_build_object('learning_layer','connect')),
jsonb_build_object('id','g6ss-t3-6-e','type','activity','content','Create a flow diagram: revenue sources → government budget → public services → community outcomes → accountability. Add one accurate example at every stage.','meta',jsonb_build_object('learning_layer','extend','evidence_required',true))
)),
('6606c007-0000-4000-8000-000000000003'::uuid,7,'The Preamble of the Constitution of Kenya','5.0 Governance','66065300-0000-4000-8000-000000000003'::uuid,array['Identify key words in the preamble of the Constitution of Kenya.','Explain the meaning of key words in the preamble.','Uphold the Constitution of Kenya in society.']::text[],647,jsonb_build_array(
jsonb_build_object('id','g6ss-t3-7-o','type','heading1','content','A Constitution begins by saying who we are and what we value','meta',jsonb_build_object('learning_layer','orient')),
jsonb_build_object('id','g6ss-t3-7-op','type','paragraph','content','The Constitution of Kenya is the supreme law of the country. Its Preamble is the opening statement introducing the people, history, values and aspirations behind the Constitution. It does not contain every detailed rule; it helps readers understand the spirit and purposes of the constitutional order.','meta',jsonb_build_object('learning_layer','orient')),
jsonb_build_object('id','g6ss-t3-7-l1','type','paragraph','content','Lesson 1 — What is a constitutional preamble? Learners examine the layout of an official Constitution and locate the Preamble. They distinguish an opening statement of values from detailed constitutional articles and predict why a country starts its supreme law with shared commitments.','meta',jsonb_build_object('learning_layer','comprehend','lesson_number',1)),
jsonb_build_object('id','g6ss-t3-7-l2','type','paragraph','content','Lesson 2 — Key ideas. Using the official text, learners locate ideas including diversity, environment, human rights, equality, freedom, democracy, social justice, rule of law and sovereign power of the people. They paraphrase each in Grade 6 language instead of copying mechanically.','meta',jsonb_build_object('learning_layer','comprehend','lesson_number',2)),
jsonb_build_object('id','g6ss-t3-7-l3','type','paragraph','content','Lesson 3 — From words to behaviour. Rule of law means public authority and citizens operate through law; equality rejects unfair discrimination; democracy involves participation and accountability; social justice concerns fairness. Learners match civic situations to Preamble values and justify the match.','meta',jsonb_build_object('learning_layer','comprehend','lesson_number',3)),
jsonb_build_object('id','g6ss-t3-7-a','type','activity','content','Preamble word lab: with an official printed or digital Constitution, identify five key ideas. Write a learner-friendly meaning and one safe school or community example for each.','meta',jsonb_build_object('learning_layer','apply','evidence_required',true)),
jsonb_build_object('id','g6ss-t3-7-m','type','callout','content','Accuracy rule: use an official or authoritative Constitution when quoting exact wording. Do not rely on memory, social-media graphics or paraphrases for exact constitutional text.','meta',jsonb_build_object('learning_layer','apply')),
jsonb_build_object('id','g6ss-t3-7-q','type','question','content','Checkpoint: explain rule of law without repeating the phrase. Give one example showing that leaders as well as citizens are accountable.','meta',jsonb_build_object('learning_layer','apply','diagnostic',true)),
jsonb_build_object('id','g6ss-t3-7-k','type','paragraph','content','Grade 6 learners uphold constitutional values by respecting others, rejecting discrimination, caring for the environment, resolving disagreements peacefully and using fair procedures. Constitutional literacy becomes meaningful when national principles guide everyday choices.','meta',jsonb_build_object('learning_layer','connect')),
jsonb_build_object('id','g6ss-t3-7-e','type','activity','content','Create a poster titled The Preamble in Daily Life with four key ideas and one behaviour for each. Then write a short class preamble expressing dignity, fairness, responsibility and learning, without copying constitutional wording.','meta',jsonb_build_object('learning_layer','extend','evidence_required',true))
))
) as v(id,number,title,strand,curriculum_id,outcomes,word_count,blocks)
on conflict (id) do update set title=excluded.title,number=excluded.number,blocks=excluded.blocks,status='published',word_count=excluded.word_count,reading_time_min=excluded.reading_time_min,learning_outcomes=excluded.learning_outcomes,cbc_strand=excluded.cbc_strand,published_at=coalesce(public.vibe_chapters.published_at,now()),curriculum_id=excluded.curriculum_id,content_pack_version=excluded.content_pack_version,alignment_status='creator_claimed',verified_by=null,verified_at=null,verification_notes=excluded.verification_notes,updated_at=now();

do $$
declare
  chapter_total int;
  period_total int;
  missing_layers int;
  min_words int;
begin
  select count(*), min(word_count) into chapter_total,min_words
  from public.vibe_chapters where publication_id='66060000-0000-4000-8000-000000000003'::uuid and status='published';
  if chapter_total <> 7 then raise exception 'GRADE6_SOCIAL_STUDIES_TERM3_CHAPTER_COUNT_INVALID: %', chapter_total; end if;
  if min_words < 600 then raise exception 'GRADE6_SOCIAL_STUDIES_TERM3_DEPTH_GATE_FAILED: minimum words %', min_words; end if;

  select coalesce(sum(periods),0) into period_total
  from public.curriculum
  where id in ('66064100-0000-4000-8000-000000000003'::uuid,'66064200-0000-4000-8000-000000000003'::uuid,'66064300-0000-4000-8000-000000000003'::uuid,'66064400-0000-4000-8000-000000000003'::uuid,'66065100-0000-4000-8000-000000000003'::uuid,'66065200-0000-4000-8000-000000000003'::uuid,'66065300-0000-4000-8000-000000000003'::uuid);
  if period_total <> 28 then raise exception 'GRADE6_SOCIAL_STUDIES_TERM3_LESSON_TOTAL_INVALID: %', period_total; end if;

  with required(layer) as (values ('orient'),('comprehend'),('apply'),('connect'),('extend')),
  present as (
    select c.id, b->'meta'->>'learning_layer' layer
    from public.vibe_chapters c
    cross join lateral jsonb_array_elements(c.blocks) b
    where c.publication_id='66060000-0000-4000-8000-000000000003'::uuid
    group by c.id,b->'meta'->>'learning_layer'
  )
  select count(*) into missing_layers
  from public.vibe_chapters c
  cross join required r
  left join present p on p.id=c.id and p.layer=r.layer
  where c.publication_id='66060000-0000-4000-8000-000000000003'::uuid and p.id is null;

  if missing_layers <> 0 then raise exception 'GRADE6_SOCIAL_STUDIES_TERM3_LEARNING_LOOP_INCOMPLETE: %', missing_layers; end if;
end $$;

commit;
