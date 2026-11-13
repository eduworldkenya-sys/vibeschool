import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
  projectGrade3KiswahiliRows,
  isGrade3KiswahiliSchemeEligible,
  GRADE3_KISWAHILI_WEEKLY_PERIODS,
  GRADE3_KISWAHILI_SOURCE_CATALOGUE,
  GRADE3_KISWAHILI_SOURCE_DOCUMENT,
} from '../../lib/curriculum/grade3KiswahiliMap.mjs';

const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const route=read('app/teacher/scheme/AuthoritySchemePage.jsx');
const reader=read('components/teacher/curriculum/Grade3KiswahiliMap.jsx');
const migration=read('supabase/migrations/20261113150000_grade3_kiswahili_canonical_scheme_activation.sql');
const ref='VS-CUR-G03-SW-2026#1.1';
const legacyRows=[
  {id:'id-a',subject_id:'global-kiswahili',grade:'Grade 3',name:'Kusoma',sub_strand:'Ufahamu wa Kusoma',source_ref:null},
  {id:'id-b',subject_id:'global-kiswahili',grade:'Grade 3',name:'Kuandika',sub_strand:'Insha',source_ref:null},
];
const auditedRow={...legacyRows[0],source_ref:ref,key_inquiry_questions:['Je, tunaelewaje?'],suggested_experiences:['Zungumza na soma']};
const eligibleOutcome={id:'right',sub_strand_id:'id-a',outcome_text:'VibeSchool original',source_type:'creator_claimed',status:'active',source_ref:ref+'/O1',outcome_code:'O1'};
const guide={sub_strand_id:'id-a',content_status:'active',learning_resources:'Kitabu na kadi',assessment_methods:'Maswali ya ufahamu'};

test('Legacy Grade 3 Kiswahili curriculum headings cannot become invented Scheme lessons',()=>{
  assert.equal(GRADE3_KISWAHILI_WEEKLY_PERIODS,4);
  assert.equal(GRADE3_KISWAHILI_SOURCE_CATALOGUE,'https://kicd.ac.ke/cbc-materials/lower-primary/');
  assert.match(GRADE3_KISWAHILI_SOURCE_DOCUMENT,/Grade-1-3-Kiswahili-Revised\.pdf$/);
  const result=projectGrade3KiswahiliRows(legacyRows,[eligibleOutcome],'global-kiswahili',[guide]);
  assert.equal(result.length,2);
  assert.deepEqual(new Set(result.map(unit=>unit.id)),new Set(['id-a','id-b']));
  assert.ok(result.every(unit=>unit.outcomes.length===0 && !unit.schemeReady && !unit.sourceLinked));
});

test('Exact active source-linked VibeSchool outcomes and complete guidance permit a teacher Scheme draft',()=>{
  const [ready]=projectGrade3KiswahiliRows([auditedRow],[eligibleOutcome],'global-kiswahili',[guide]);
  assert.equal(ready.outcomes[0].id,'right');
  assert.equal(ready.sourceRef,ref);
  assert.equal(ready.schemeReady,true);
  assert.equal(isGrade3KiswahiliSchemeEligible(ready),true);
  assert.equal(projectGrade3KiswahiliRows([auditedRow],[eligibleOutcome],'wrong-id').length,0);
});

test('Grade, subject, duplicates, wrong sources, unapproved outcomes and incomplete guidance fail closed',()=>{
  const rows=[
    auditedRow,
    {...auditedRow,id:'wrong-grade',grade:'Grade 4'},
    {...auditedRow,id:'wrong-subject',subject_id:'another-subject'},
    {...auditedRow,id:'id-a',sub_strand:'Duplicated'}
  ];
  const badOutcomes=[
    {id:'source',sub_strand_id:'id-a',outcome_text:'Protected source text',source_type:'official',status:'active',source_ref:ref+'/O1'},
    {id:'draft',sub_strand_id:'id-a',outcome_text:'Draft outcome',source_type:'creator_claimed',status:'draft',source_ref:ref+'/O1'},
    {id:'other',sub_strand_id:'id-a',outcome_text:'Wrong reference',source_type:'creator_claimed',status:'active',source_ref:'VS-CUR-G03-SW-2026#1.2/O1'},
    {id:'prefix',sub_strand_id:'id-a',outcome_text:'Wrong prefix',source_type:'creator_claimed',status:'active',source_ref:ref+'-duplicate/O1'},
    eligibleOutcome,
    eligibleOutcome
  ];
  const [unit]=projectGrade3KiswahiliRows(rows,badOutcomes,'global-kiswahili',[guide]);
  assert.deepEqual(unit.outcomes.map(x=>x.text),['VibeSchool original']);
  const noGuidance=projectGrade3KiswahiliRows([auditedRow],[eligibleOutcome],'global-kiswahili')[0];
  assert.equal(noGuidance.schemeReady,false);
  const noInquiry=projectGrade3KiswahiliRows([{...auditedRow,key_inquiry_questions:[]}],[eligibleOutcome],'global-kiswahili',[guide])[0];
  assert.equal(noInquiry.schemeReady,false);
  const wrongGuide=projectGrade3KiswahiliRows([auditedRow],[eligibleOutcome],'global-kiswahili',[{...guide,content_status:'draft'}])[0];
  assert.equal(wrongGuide.schemeReady,false);
  const missingAssessment=projectGrade3KiswahiliRows([auditedRow],[eligibleOutcome],'global-kiswahili',[{...guide,assessment_methods:' '}])[0];
  assert.equal(missingAssessment.schemeReady,false);
  const unsafeRef=projectGrade3KiswahiliRows([{...auditedRow,source_ref:'VS-CUR-G03-SW-2026#bad/path'}],[eligibleOutcome],'global-kiswahili',[guide])[0];
  assert.equal(unsafeRef.schemeReady,false);
});

test('Grade 3 teacher Curriculum Map → Scheme → Curriculum Map shares identity and saves only on action',()=>{
  assert.ok(route.includes("isGrade3Kiswahili = /^grade\\s*3$/i"));
  assert.ok(route.includes("resolveGlobalSubjectId(selectedSubject)"));
  assert.ok(route.includes(".eq('subject_id',globalId).eq('grade','Grade 3')"));
  assert.ok(route.includes('projectGrade3KiswahiliRows(rows.data||[],outcomes.data||[],globalId,guidance.data||[])'));
  assert.ok(route.includes('grade3KiswahiliDraftUnit?.schemeReady'));
  assert.ok(route.includes('activeMappedDraftRecord = mappedDraftRecord || grade3KiswahiliDraftRecord'));
  assert.ok(route.includes('p_sub_strand_id:activeMappedDraftRecord.id,p_outcome_ids:selected'));
  assert.ok(route.includes("supabase.rpc('commit_mapped_scheme_lesson'"));
  assert.ok(route.includes('grade3KiswahiliCatalog.some(unit=>unit.id===item.sub_strand_id)'));
  assert.ok(route.includes("router.push('/teacher/curriculum?'+p.toString())"));
  assert.ok(route.includes("router.push('/teacher/scheme?'+p.toString())"));
  assert.ok(route.includes('!weeks.some(w=>w.week_number===selectedWeek)'));
  assert.ok(!reader.includes('commit_mapped_scheme_lesson'));
  assert.ok(!reader.includes('supabase.from('));
  assert.ok(!reader.includes('insert('));
  assert.ok(reader.includes('Kufungua Scheme hakuundi somo'));
});

test('Canonical database RPC keeps authentication, existing subjects and fails closed',()=>{
  assert.match(migration,/SCHEME_GRADE3_KISWAHILI_ORIGINAL_ACTIVE/);
  assert.match(migration,/s\.grade='Grade 3'/);
  assert.match(migration,/global_subject\.name='Kiswahili'/);
  assert.match(migration,/global_subject\.school_id is null/);
  assert.match(migration,/v_unit\.source_ref ~ /);
  assert.match(migration,/SCHEME_CANONICAL_CONTENT_INCOMPLETE/);
  assert.match(migration,/SCHEME_INVOKER_AUTHORITY_REQUIRED/);
  assert.match(migration,/SCHEME_GRADE9_ENGLISH_READER_ACTIVE/);
  assert.match(migration,/GRADE3_KISWAHILI_SCHEME_AUTHORITY_DRIFT/);
  assert.match(migration,/from public,anon;/);
  assert.match(migration,/to authenticated;/);
  assert.ok(!/create table|insert into public\.(?:scheme_of_work|cbc_strands|curriculum_learning_outcomes)|update public\.scheme_of_work/i.test(migration));
});
