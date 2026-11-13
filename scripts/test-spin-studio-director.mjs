import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
const page=readFileSync('app/spin-studio/page.tsx','utf8')
const css=readFileSync('app/spin-studio/spin-studio.module.css','utf8')
const layout=readFileSync('app/spin-studio/layout.tsx','utf8')
test('unlisted no-login standalone route stays out of search',()=>{
  assert.match(layout,/index:\s*false/)
  assert.match(page,/STORAGE = 'vibeschool\.spin-studio\.v1'/)
  assert.doesNotMatch(page,/redirect\(.*login/)
})
test('show phase machine has staged popup and automatic answer',()=>{
  for(const state of ["'spinning'","'question'","'countdown'","'reveal'"])assert.ok(page.includes(state),state)
  assert.match(page,/showPhase!=='countdown'\|\|seconds!==0\|\|!wheel\?\.automatic/)
  assert.match(page,/setReveal\(true\);setShowPhase\('reveal'\)/)
  assert.match(page,/showOverlay&&selected/)
  assert.match(css,/\.challengePopup\{/)
})
test('independent creator settings and recording remain available',()=>{
  for(const feature of ["'wheels'","'content'","'appearance'","'effects'","'settings'","startCapture","stopCapture","MediaRecorder","getDisplayMedia","undoEdit","redoEdit","exportSession","uploadBackground","batchMode","stageThemes","templates","spinRef"])assert.ok(page.includes(feature),feature)
  assert.match(page,/recording\?styles\.recordLayout:styles\.layout/)
  assert.match(page,/Math\.max\(0,Math\.min\(9999/)
})
test('accessibility, asset and mobile guardrails remain',()=>{
  assert.match(page,/prefers-reduced-motion/)
  assert.match(css,/@media\(max-width:640px\)/)
  assert.match(page,/220000/)
  assert.match(page,/aria-label="Spin Studio setup"/)
})

test('recording mode advances by tapping and keeps wheel visible',()=>{
  assert.match(page,/onClick=\{advanceStage\}/)
  assert.match(page,/role=\{recording\?'button':undefined\}/)
  assert.match(page,/if\(spinning\)return/)
  assert.match(page,/if\(showPhase==='reveal'\)/)
  assert.match(css,/\.stage \.challengePopup\{/)
  assert.match(css,/max-height:33%/)
})
test('background audio is opt-in and configurable',()=>{
  assert.match(page,/musicEnabled\?: boolean/)
  assert.match(page,/musicVolume\?: number/)
  assert.match(page,/const playMusic=/)
  assert.match(page,/const stopMusic=/)
  assert.match(page,/new AudioContext\(\)/)
  assert.match(page,/stopMusic\(\).*Back to editor/)
})
