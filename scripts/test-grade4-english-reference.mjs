import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Source regression checks: explicitly distinguish reference content from
// canonical database publication and verification.
const source=readFileSync(new URL('../lib/curriculum/grade4EnglishReference.ts',import.meta.url),'utf8')
const ui=readFileSync(new URL('../app/teacher/scheme/AuthoritySchemePage.jsx',import.meta.url),'utf8')
const themeSection=source.split('export const GRADE4_ENGLISH_THEMES = [')[1]?.split('] as const')[0]||''
const themeCodes=[...themeSection.matchAll(/"number": (\d+)/g)].map(m=>Number(m[1]))
assert.deepEqual(themeCodes,[1,2,3,4,5,6,7,8,9,10,11,12,13])
const allocations=[35,39,39,37]
for(const amount of allocations)assert.match(source,new RegExp(': '+amount+'[\\s,]'))
assert.equal(allocations.reduce((a,b)=>a+b,0),150)
const subSection=source.split('export const GRADE4_ENGLISH_SUBSTRANDS:')[1]
assert.ok(subSection)
const ids=[...subSection.matchAll(/^  "(\d+)": \[/gm)].map(m=>Number(m[1]))
assert.deepEqual(ids,themeCodes)
const outcomesSection=source.split('export const GRADE4_ENGLISH_THEME1_OUTCOME_REFERENCE =')[1]||''
assert.equal([...outcomesSection.matchAll(/code: '1\.[1-4]\.1'/g)].length,4)
assert.match(ui,/GRADE4_ENGLISH_THEME1_OUTCOME_REFERENCE/)
assert.match(ui,/not yet imported or certified as canonical outcomes/)
assert.match(ui,/Official theme not yet mapped to canonical rows/)
console.log('Grade 4 English reference integrity checks passed.')
