import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
  projectGrade3KiswahiliRows,
  GRADE3_KISWAHILI_WEEKLY_PERIODS,
  GRADE3_KISWAHILI_SOURCE_CATALOGUE,
} from '../../lib/curriculum/grade3KiswahiliMap.mjs';

const read = relative => readFileSync(new URL('../../' + relative, import.meta.url), 'utf8');
const route = read('app/teacher/scheme/AuthoritySchemePage.jsx');
const reader = read('components/teacher/curriculum/Grade3KiswahiliMap.jsx');

const rows = [
  {id:'id-a', subject_id:'global-kiswahili', grade:'Grade 3', name:'Kusoma',sub_strand:'Ufahamu wa Kusoma',source_ref:null},
  {id:'id-b', subject_id:'global-kiswahili', grade:'Grade 3', name:'Kuandika',sub_strand:'Insha',source_ref:null},
];

test('Grade 3 Kiswahili projects canonical identifiers without inventing official wording',()=>{
  assert.equal(GRADE3_KISWAHILI_WEEKLY_PERIODS,4);
  assert.equal(GRADE3_KISWAHILI_SOURCE_CATALOGUE,'https://kicd.ac.ke/cbc-materials/lower-primary/');
  const result = projectGrade3KiswahiliRows(rows, [], 'global-kiswahili');
  assert.equal(result.length,2);
  assert.deepEqual(new Set(result.map(item => item.id)),new Set(['id-a','id-b']));
  assert.ok(result.every(item => item.outcomes.length===0 && !item.sourceLinked));
});

test('Grade, subject, duplicate rows and unapproved source wording fail closed',()=>{
  const badRows=[
    ...rows,
    {...rows[0],id:'wrong-grade',grade:'Grade 4'},
    {...rows[0],id:'wrong-subject',subject_id:'another-subject'},
    {...rows[0],id:'id-a',sub_strand:'Duplicated'}
  ];
  const badOutcomes=[
    {id:'source',sub_strand_id:'id-a',outcome_text:'Protected source text',source_type:'official',status:'active',source_ref:'KICD#1'},
    {id:'draft',sub_strand_id:'id-a',outcome_text:'Draft outcome',source_type:'creator_claimed',status:'draft',source_ref:'VS-CUR-G03-SW-2026#1'},
    {id:'wrong-ref',sub_strand_id:'id-a',outcome_text:'Wrong reference',source_type:'creator_claimed',status:'active',source_ref:'OTHER#1'},
    {id:'right',sub_strand_id:'id-a',outcome_text:'VibeSchool original',source_type:'creator_claimed',status:'active',source_ref:'VS-CUR-G03-SW-2026#1'}
  ];
  const result=projectGrade3KiswahiliRows(badRows,badOutcomes,'global-kiswahili');
  assert.equal(result.length,2);
  assert.deepEqual(result.find(unit=>unit.id==='id-a').outcomes.map(x=>x.text),['VibeSchool original']);
  assert.deepEqual(projectGrade3KiswahiliRows(rows,badOutcomes,'wrong-id'),[]);
});

test('Grade 3 Kiswahili reader follows existing teacher Map → Scheme route without auto writes',()=>{
  assert.match(route, /isGrade3Kiswahili = \/\^grade\\s\*3\$\/i/);
  assert.ok(route.includes("resolveGlobalSubjectId(selectedSubject)"));
  assert.ok(route.includes(".eq('subject_id',globalId).eq('grade','Grade 3')"));
  assert.ok(route.includes("projectGrade3KiswahiliRows(rows.data||[],outcomes.data||[],globalId)"));
  assert.ok(route.includes("<Grade3KiswahiliMap"));
  assert.ok(route.includes("grade3KiswahiliDraftUnit"));
  assert.ok(route.includes("router.push('/teacher/scheme?'+p.toString())"));
  assert.ok(route.includes("supabase.rpc('commit_mapped_scheme_lesson'"));
  assert.ok(!reader.includes('commit_mapped_scheme_lesson'));
  assert.ok(!reader.includes('supabase.from('));
  assert.ok(!reader.includes('insert('));
  assert.ok(reader.includes('Kufungua Scheme hakuundi somo'));
});
