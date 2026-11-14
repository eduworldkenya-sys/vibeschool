import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const page=fs.readFileSync('app/spin-studio/page.tsx','utf8')
const css=fs.readFileSync('app/spin-studio/spin-studio.module.css','utf8')

test('political broadcast uses a dedicated responsive stage instead of generic landscape grid',()=>{
  assert.match(page,/electionMode\?styles\.politicalStage/)
  assert.match(css,/\.politicalStage\.landscape \.electionArena\{display:grid/)
  assert.match(css,/\.politicalStage \.stageContent\{\s*display:flex/)
  assert.match(css,/\.stage:fullscreen\.politicalStage\.landscape \.stageContent/)
})
test('wheel position and size controls do not change spin results or tally math',()=>{
  for(const field of ['electionWheelSize','electionWheelOffsetX','electionWheelOffsetY']){
    assert.match(page,new RegExp(field+'\\?'))
    assert.match(page,new RegExp(field+':'))
  }
  assert.match(page,/politicalWheelPointerDown/)
  assert.match(page,/politicalWheelPointerMove/)
  assert.match(page,/politicalWheelPointerUp/)
  assert.match(page,/electionVotes\.filter\(id=>id===entry\.id\)\.length\*electionPoints/)
  assert.match(page,/electionWinners\.length===1/)
})
test('political stage includes one short disclaimer and does not duplicate selected round name',()=>{
  assert.match(page,/!electionMode&&<strong className=\{styles\.resultLabel\}>/)
  assert.match(page,/Random draw · Not an election forecast/)
  assert.match(css,/\.wheelPositionHandle/)
})
