import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const root='docs/content/grade4-social-studies-textbook/'
const prior=JSON.parse(read(root+'reader-draft.json'))
const candidate=JSON.parse(read(root+'revision-2/reader-candidate.json'))
const teacher=JSON.parse(read(root+'revision-2/teacher-addendum.json'))
const assets=JSON.parse(read(root+'revision-2/visual-assets.json'))
test('revision extends existing book instead of replacing live IDs or omitting original content',()=>{
 assert.equal(candidate.revisionOf,'71a76cd8-f209-4f99-a1d0-7e5b66f42e43')
 assert.equal(candidate.publication.status,'draft')
 assert.equal(candidate.chapters.length,19)
 for(const [i,chapter] of candidate.chapters.entries()){
  assert.equal(chapter.sub_strand_id,prior.chapters[i].sub_strand_id)
  assert.deepEqual(chapter.sourceOutcomeIds,prior.chapters[i].sourceOutcomeIds)
  assert.deepEqual(chapter.blocks.filter(b=>!b.id.startsWith('vsg4sst-v2-')),prior.chapters[i].blocks)
  assert.equal(chapter.blocks.filter(b=>b.type==='question').length,[4,6,8,11,18].includes(i)?14:10)
  assert.equal(chapter.blocks.filter(b=>b.type==='interactive').length,1)
 }
})
test('ungraded checks, private formal answers, alt-described visual source and text fallback',()=>{
 const blocks=candidate.chapters.flatMap(c=>c.blocks)
 assert.equal(new Set(blocks.map(b=>b.id)).size,blocks.length)
 assert.equal(teacher.sections.flatMap(s=>s.questions).length,95)
 assert.equal(teacher.chapterRevisionTests.flatMap(s=>s.questions).length,20)
 assert.equal(blocks.filter(b=>b.type==='question').length,210)
 assert.equal(assets.length,38)
 for(const asset of assets){
  assert.ok(asset.alt)
  assert.match(asset.svg,/<title id="t">/)
  assert.match(asset.svg,/<desc id="d">/)
  assert.doesNotMatch(asset.svg,/<script|<foreignObject|href=/i)
  assert.equal(blocks.filter(b=>b.meta?.revisionVisualId===asset.id).length,1)
 }
 for(const b of blocks.filter(b=>b.type==='interactive')){
  assert.equal(b.meta.kind,'textbook-self-check-v1')
  assert.equal(b.meta.ungraded,true)
  assert.ok(b.meta.options.includes(b.meta.revealChoice))
  assert.ok(b.meta.explanation)
 }
 for(const b of blocks.filter(b=>b.type==='question'))assert.doesNotMatch(JSON.stringify(b),/"(?:correctAnswer|answer|revealChoice)"\s*:/)
 assert.match(read('components/learn/PublishedTextbookLearnReader.tsx'),/TextbookSelfCheck/)
 assert.match(read('components/learn/TextbookSelfCheck.tsx'),/meta.ungraded!==true/)
})
