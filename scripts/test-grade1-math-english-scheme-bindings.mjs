import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../supabase/migrations/20261111080000_grade1_math_english_curriculum_scheme_bindings.sql', import.meta.url),'utf8')
const math = readFileSync(new URL('../components/teacher/curriculum/Grade1MathematicsMap.tsx', import.meta.url),'utf8')
const english = readFileSync(new URL('../components/teacher/curriculum/Grade1EnglishMap.tsx', import.meta.url),'utf8')
const scheme = readFileSync(new URL('../app/teacher/scheme/AuthoritySchemePage.jsx', import.meta.url),'utf8')
function units(source,tag) {
  const begin = 'export const ' + tag + '_UNITS: readonly CurriculumUnit[] = '
  assert.ok(source.includes(begin))
  return JSON.parse(source.split(begin)[1].split('\n\nconst card: CSSProperties')[0])
}
const source = sql.split('$vs_grade1_catalog$')[1]
assert.ok(source, 'Migration must carry an immutable reader snapshot')
const catalog = JSON.parse(source)
const m = units(math, 'GRADE1_MATHEMATICS')
const e = units(english,'GRADE1_ENGLISH')
assert.equal(catalog.length,24)
assert.equal(new Set(catalog.map(item=>item.source_ref)).size,24)
assert.equal(catalog.reduce((sum,item)=>sum+item.lessons,0),300)
assert.equal(catalog.reduce((sum,item)=>sum+item.outcomes.length,0),112)
const compare=(units,subject,prefix,strands)=>{
  const items=catalog.filter(item=>item.subject===subject)
  assert.equal(items.length,units.length)
  for(const unit of units){
    const item=items.find(row=>row.source_ref===prefix+'#'+unit.id)
    assert.ok(item,'Missing source identity '+prefix+'#'+unit.id)
    assert.equal(item.strand,strands[unit.strand-1])
    assert.deepEqual(item.outcomes,unit.outcomes,'Outcome drift for '+item.source_ref)
    assert.deepEqual(item.experiences,unit.experiences)
    assert.deepEqual(item.inquiry,unit.inquiry)
    assert.equal(item.lessons,unit.lessons)
    assert.equal(item.title,unit.title)
  }
}
compare(m,'Mathematics','VS-CUR-G01-MA-2026',['Numbers','Measurement','Geometry'])
compare(e,'English','VS-CUR-G01-EN-2026',['Listening and Speaking','Reading','Language Use','Writing'])
for(const term of [
  'create table if not exists public.grade1_curriculum_reader_bindings',
  'alter table public.grade1_curriculum_reader_bindings enable row level security',
  'revoke all on public.grade1_curriculum_reader_bindings from public,anon,authenticated',
  'on conflict (subject_id,grade,name,sub_strand) do nothing',
  'on conflict (source_ref) do nothing',
  'join public.grade1_curriculum_reader_bindings b on b.source_ref=t.source_ref',
  "'creator_claimed',t.source_ref",
  'create policy grade1_math_english_authored_outcomes_read',
  'create policy grade1_math_english_guidance_read',
  'security invoker',
  "v_scheme:=public.commit_custom_scheme_item(",
  "where id=v_scheme.id and teacher_id=auth.uid()",
  'insert into public.scheme_lesson_outcomes',
  'GRADE1_READER_PERSISTED_MAPPING_INCOMPLETE',
  'GRADE1_READER_EXISTING_SOURCE_CONFLICT',
  'KICD reconciliation pending',
]) assert.ok(sql.includes(term),'Missing canonical safety guard '+term)
assert.ok(!/delete from public\.cbc_strands|truncate public\.cbc_strands|update public\.cbc_strands/i.test(sql),
  'Never overwrite or destroy legacy Grade 1 hierarchy')
assert.ok(!/insert into public\.curriculum\s*\(/i.test(sql),'Do not invent term/week/pacing')
assert.ok(!/insert into public\.scheme_of_work\s*\(/i.test(sql),'School Scheme must be teacher authorized')
assert.ok(scheme.includes("supabase.from('grade1_curriculum_reader_bindings')"),
  'Reader must load canonical ID bindings, not fuzzy names')
assert.ok(scheme.includes("supabase.rpc('commit_mapped_scheme_lesson'"),
  'Teacher must use existing atomic scheme commit')
assert.ok(scheme.includes('p_sub_strand_id:mappedDraftRecord.id'),
  'Use actual persisted sub-strand ID')
assert.ok(scheme.includes("(mappedDraftRecord?.outcomes||[]).map"),
  'Use actual persisted outcome IDs')
assert.ok(scheme.includes('grade1ReaderCatalogError')&&scheme.includes('grade1ReaderCatalogLoading'),
  'Mapping errors must fail closed')
assert.ok(math.includes('linkedUnit.outcomes.map')&&math.includes('onPlanUnit(unit.id)'))
assert.ok(english.includes('linkedUnit.outcomes.map')&&english.includes('onPlanUnit(unit.id)'))
console.log('Grade 1 Mathematics + English canonical curriculum binding and Scheme authority: PASS')
