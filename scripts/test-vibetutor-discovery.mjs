import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { compatibility, rankDiscovery, matchesDiscoveryText } from '../components/vibetutor/discovery.ts'
const need = {subjects:['Mathematics'],levels:['Grade 4–6'],days:['Tue'],mode:'physical',area:'Nairobi',amount:500}
const tutor = {...need,amount:400}
test('matches real compatible preferences; missing price not affordable; online location neutral', () => {
  assert.equal(compatibility(need,tutor),90)
  assert.ok(compatibility(need,tutor)>compatibility(need,{...tutor,area:'Nakuru',amount:800,days:['Mon'],subjects:['English']}))
  assert.equal(compatibility(need,{...tutor,amount:0}),75)
  assert.equal(compatibility({...need,mode:'online'},{...tutor,mode:'online',area:'Nakuru'}),90)
  assert.equal(compatibility({...need,days:[]},tutor),70)
})
test('rank first, stable rotating ties; no mutation', () => {
  const rows=[{id:'a',score:0},{id:'b',score:10},{id:'c',score:10}]
  assert.deepEqual(rankDiscovery(rows,0,r=>r.score).map(r=>r.id), ['b','c','a'])
  assert.deepEqual(rankDiscovery(rows,2,r=>r.score).map(r=>r.id), ['c','b','a'])
  assert.deepEqual(rows.map(r=>r.id),['a','b','c'])
  assert.deepEqual(rankDiscovery([],0,()=>0),[])
})
test('multiword search and direct filter changes', () => {
  assert.equal(matchesDiscoveryText(['Mathematics','Nairobi'],'math nairobi'),true)
  assert.equal(matchesDiscoveryText(['Mathematics','Nairobi'],'math Nakuru'),false)
  const bar=readFileSync('components/vibetutor/FilterBar.tsx','utf8')
  assert.match(bar,/onChange=\{e => onChange\(e.target.value\)\}/)
  assert.doesNotMatch(bar,/Show \{p.resultCount\}|setExpanded/)
  const browse=readFileSync('app/vibetutor/browse/BrowseClient.tsx','utf8')
  assert.match(browse,/live\?\.learnerPreference/)
  assert.match(browse,/live\?\.tutorPreference/)
  assert.doesNotMatch(browse,/setTimeout\(/)
})
