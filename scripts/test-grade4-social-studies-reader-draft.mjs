import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
const dir=new URL('../docs/content/grade4-social-studies-textbook/',import.meta.url)
const read=name=>JSON.parse(readFileSync(new URL(name,dir),'utf8'))
const draft=read('reader-draft.json')
const manifest=read('manifest.json')
const media=read('visuals/manifest.json')
test('one draft book, nineteen scoped sections and all 72 stable outcome mappings',()=>{
 assert.equal(draft.publication.status,'draft')
 assert.equal(draft.publication.cbc_aligned,false)
 assert.equal(draft.publication.format,'vibetextbook')
 assert.equal(draft.chapters.length,19)
 assert.equal(new Set(draft.chapters.map(c=>c.sub_strand_id)).size,19)
 const ids=draft.chapters.flatMap(c=>c.sourceOutcomeIds)
 assert.equal(new Set(ids).size,72)
 assert.equal(draft.chapters.flatMap(c=>c.learning_outcomes).length,72)
 for(const c of draft.chapters){
  const u=manifest.units.find(u=>u.code===c.sourceSection)
  assert.equal(c.sub_strand_id,u.unitId)
  assert.deepEqual(c.sourceOutcomeIds,u.outcomes.map(o=>o.id))
  assert.equal(c.status,'draft')
  assert.equal(c.alignment_status,'unclaimed')
  assert.equal(c.blocks.filter(b=>b.type==='question').length,5)
 }
})
test('native blocks keep teacher answers, source reference and private media out of reader payload',()=>{
 const blocks=draft.chapters.flatMap(c=>c.blocks)
 assert.equal(new Set(blocks.map(b=>b.id)).size,blocks.length)
 const allowed=new Set(['heading2','heading3','paragraph','bulletList','table','activity','question','project'])
 for(const b of blocks){assert.ok(allowed.has(b.type),b.type);assert.ok(b.content.trim());assert.doesNotMatch(b.content,/<script|vibepress-draft:\/\/|\*\*Answers:\*\*|sourceOutcomeIds|<iframe/i)}
 assert.equal(blocks.filter(b=>b.type==='question').length,95)
 assert.equal(blocks.filter(b=>b.type==='project').length,5)
})
test('six prepared instructional graphics include accessible titles and descriptions, not fake storage links',()=>{
 assert.equal(media.length,6)
 for(const a of media){
  const s=readFileSync(new URL(a.path,dir),'utf8')
  assert.match(s,/<svg\b/)
  assert.match(s,/<title id="title">/)
  assert.match(s,/<desc id="desc">/)
  assert.ok(a.alt.trim())
  assert.match(a.state,/not uploaded/)
  assert.doesNotMatch(s,/<script|<foreignObject|href=/i)
 }
})
