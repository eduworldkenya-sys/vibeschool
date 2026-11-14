import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const page=fs.readFileSync('app/spin-studio/page.tsx','utf8')
const css=fs.readFileSync('app/spin-studio/spin-studio.module.css','utf8')
test('political Tally Director controls are persisted on the canonical wheel',()=>{
  for(const field of ['electionTallyColor','electionTallyBackground','electionTallyFontSize','electionTallyBarHeight','electionTallyWidth','electionTallyOpacity','electionTallyAnimation','electionTallyShowNames','electionTallyOffsetX','electionTallyOffsetY']){
    assert.match(page,new RegExp(field+'\\?'))
    assert.match(page,new RegExp('update\\(\\{'+field+':'))
  }
  assert.match(page,/Tally Director/)
  assert.match(page,/tallyPointerDown/)
  assert.match(page,/tallyPointerMove/)
  assert.match(page,/tallyPointerUp/)
})
test('tally styling is independent of random selection, result and score logic',()=>{
  assert.match(page,/electionVotes\.filter\(id=>id===entry\.id\)\.length\*electionPoints/)
  assert.match(page,/electionVotes\(old=>\[\.\.\.old,plan\.selectedId\]\)/)
  assert.match(page,/candidate\.score\/electionTop\*100/)
  assert.match(css,/--tally-color/)
  assert.match(css,/--tally-background/)
  assert.match(css,/--tally-bar-height/)
  assert.match(css,/--tally-width/)
  assert.match(css,/prefers-reduced-motion:reduce/)
})
