import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { GRADE4_MATHEMATICS_UNITS } from '../lib/teaching/grade4MathematicsCatalog.mjs'
import { GRADE4_ENGLISH_UNITS } from '../lib/teaching/grade4EnglishCatalog.mjs'
import { GRADE4_INDIGENOUS_UNITS } from '../lib/teaching/grade4IndigenousCatalog.mjs'
import { GRADE6_MATHEMATICS_UNITS } from '../lib/teaching/grade6MathematicsCatalog.mjs'
import { GRADE6_ENGLISH_UNITS } from '../lib/teaching/grade6EnglishCatalog.mjs'
import { GRADE6_KISWAHILI_UNITS } from '../lib/teaching/grade6KiswahiliCatalog.mjs'
import { GRADE8_MATHEMATICS_UNITS } from '../lib/teaching/grade8MathematicsCatalog.mjs'
import { GRADE8_ENGLISH_UNITS } from '../lib/teaching/grade8EnglishCatalog.mjs'

const read=path=>readFileSync(new URL('../'+path, import.meta.url),'utf8')
const manifest=JSON.parse(read('content/curriculum/kicd-remaining-maps-audit.json'))
const grade9=JSON.parse(read('content/curriculum/grade9-english-2024-index.json'))
const packetFiles=[
  'content/curriculum/production/grade4-original-first-lessons.v1.json',
  'content/curriculum/production/grade6-original-first-lessons.v1.json',
  'content/curriculum/production/grade8-grade9-original-first-lessons.v1.json',
]
const packets=packetFiles.flatMap(file=>{
 const doc=JSON.parse(read(file))
 assert.equal(doc.schema,'vibeschool.originals.editorial-learning-packets.v1')
 assert.equal(doc.status,'editorial_draft_not_published','Manuscripts are never auto-published')
 assert.match(doc.scope,/not (?:the )?(?:complete|full)/i,'All documents clearly limit their scope')
 return doc.packets
})
const catalogs={
 'Grade 4|Mathematics':GRADE4_MATHEMATICS_UNITS,
 'Grade 4|English':GRADE4_ENGLISH_UNITS,
 'Grade 4|Indigenous Languages':GRADE4_INDIGENOUS_UNITS,
 'Grade 6|Mathematics':GRADE6_MATHEMATICS_UNITS,
 'Grade 6|English':GRADE6_ENGLISH_UNITS,
 'Grade 6|Kiswahili':GRADE6_KISWAHILI_UNITS,
 'Grade 8|Mathematics':GRADE8_MATHEMATICS_UNITS,
 'Grade 8|English':GRADE8_ENGLISH_UNITS,
}
function tsArray(path,name){
 const s=read(path)
 const m=s.match(new RegExp('export const '+name+' = (\\[[\\s\\S]*?\\]) as const'))
 assert.ok(m,'Missing reference: '+name)
 return JSON.parse(m[1])
}
const g4Sw=tsArray('lib/curriculum/grade4KiswahiliReference.ts','GRADE4_KISWAHILI_UNITS')
const g8Sw=tsArray('lib/curriculum/grade8KiswahiliReference.ts','GRADE8_KISWAHILI_THEMES')
assert.equal(packets.length,11)
assert.equal(new Set(packets.map(p=>p.id)).size,11)
assert.equal(new Set(packets.map(p=>p.grade+'|'+p.subject)).size,11)
assert.equal(manifest.subjects.length,11)
for(const p of packets){
 const key=p.grade+'|'+p.subject
 const entry=manifest.subjects.find(x=>x.grade+'|'+x.subject===key)
 assert.ok(entry,'Unknown subject '+key)
 assert.equal(p.provenance.kicdAuthorityUrl,entry.sourceUrl,key+' official design URL')
 assert.equal(p.provenance.specificOutcomeCrosswalk,'pending',
   'Do not claim exact KICD outcome reconciliation from a source-index topic')
 assert.equal(p.provenance.author,'VibeSchool-original')
 assert.equal(p.releaseStatus,'editorial_draft_not_imported_into_canonical_learning_resources')
 const catalog=catalogs[key]
 if(catalog){
  const unit=catalog.find(x=>x.id===p.unit)
  assert.ok(unit,key+' lost source identity '+p.unit)
  assert.equal(p.subStrand,unit.title,key+' KICD-derived title must not be renamed')
  assert.equal(p.sourceRef,entry.subject==='Indigenous Languages'?'VS-CUR-G04-IL-2026#'+p.unit:
    (p.grade==='Grade 4'?'VS-CUR-G04-':p.grade==='Grade 6'?'VS-CUR-G06-':'VS-CUR-G08-')+
    (p.subject==='Mathematics'?'MA':p.subject==='English'?'EN':'SW')+'-2026#'+p.unit,
  key+' source binding must use a real catalog key')
 }else {
  assert.equal(p.sourceRef,null,'Unmapped source index must not invent a canonical binding')
  if(key==='Grade 4|Kiswahili'){
   assert.ok(g4Sw.some(u=>u.id===p.unit&&u.title===p.subStrand))
  }else if(key==='Grade 8|Kiswahili'){
   assert.ok(g8Sw.some(t=>t.title===p.theme&&t.topics.includes(p.subStrand)))
  }else if(key==='Grade 9|English'){
   assert.ok(grade9.themes.some(t=>t.title===p.theme && t.units.some(u=>u.code===p.unit&&u.title===p.subStrand)))
  }else throw new Error('Unsupported unmapped source '+key)
 }
 for(const field of ['id','grade','subject','subStrand','focus','goal','notes','teacher','misconception','remedial','enrichment','accessibility']){
  assert.ok(typeof p[field]==='string'&&p[field].length>=14 || ['id','grade','subject','subStrand'].includes(field)&&typeof p[field]==='string'&&p[field].length>=4,
    p.id+' missing useful '+field)
 }
 assert.ok(Array.isArray(p.vocabulary)&&p.vocabulary.length>=3,p.id+' vocabulary')
 assert.ok(p.model.prompt?.length>=20&&p.model.answer?.length>=12&&p.model.check?.length>=20,p.id+' model')
 assert.ok(p.model.steps?.length>=3,p.id+' shown steps')
 assert.ok(p.model.steps.every(s=>s.action?.length>=12&&s.why?.length>=25),
   p.id+' every step requires an explanation of why')
 assert.ok(p.activity.materials.length&&p.activity.steps.length>=3&&p.activity.evidence.length>=20,
   p.id+' practical activity and evidence')
 for(const group of ['guided','independent','check']){
  assert.ok(Array.isArray(p[group])&&p[group].length>=1,p.id+' '+group)
  for(const item of p[group])assert.ok(item.id&&item.prompt?.length>=15&&item.answer?.length>=1&&item.reason?.length>=15,
   p.id+' '+group+' needs answer and feedback')
 }
 assert.ok(p.visual?.kind&&p.visual?.description?.length>=24,p.id+' usable illustrative brief')
}
const allItemIds=packets.flatMap(p=>['guided','independent','check'].flatMap(k=>p[k].map(i=>i.id)))
assert.equal(new Set(allItemIds).size,allItemIds.length,'All practice items need stable unique IDs')
for(const p of packets.filter(p=>p.subject==='Mathematics')){
 assert.match(p.model.answer,/\d/,p.id+' model must show calculation result')
 assert.ok(p.model.steps.every(s=>s.why),p.id+' no unexplained mathematical steps')
}
const g4Il=packets.find(p=>p.subject==='Indigenous Languages')
assert.equal(g4Il.releaseGate,'native_speaker_and_rights_review_required')
assert.match(g4Il.teacher,/language is specified/i)
assert.match(packets.find(p=>p.id==='VS-G06-SW-1.1.1-L01').teacher,/VibeSchool/)
const sourceCount={
 'Grade 4|Mathematics':19,'Grade 4|English':52,'Grade 4|Kiswahili':52,'Grade 4|Indigenous Languages':28,
 'Grade 6|Mathematics':16,'Grade 6|English':10,'Grade 6|Kiswahili':53,
 'Grade 8|Mathematics':16,'Grade 8|English':75,'Grade 8|Kiswahili':60,'Grade 9|English':75,
}
for(const [key,count] of Object.entries(sourceCount)){
 assert.equal(manifest.subjects.find(m=>m.grade+'|'+m.subject===key)?.units,count)
}
console.log('PASS: 11 independently authored outcome-level starter manuscripts; real catalog references, exact headings, worked steps, answer feedback, access, and draft-only release.')
