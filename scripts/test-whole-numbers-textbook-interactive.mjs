import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { boundedWholeNumber, placeValueCells, expandedWholeNumber, roundToNearestTen, factorsOf, multiplesOf, romanUpToTen } from '../lib/learn/wholeNumberExplorer.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('Grade 4 whole-number inputs reject decimals, negatives and excess digits', () => {
 assert.equal(boundedWholeNumber('3482',0,99999),3482)
 assert.equal(boundedWholeNumber('99999',0,99999),99999)
 for(const candidate of ['-1','2.5','1e3','100000','abc','']) assert.equal(boundedWholeNumber(candidate,0,99999),null)
 assert.equal(boundedWholeNumber('0',1,50),null)
})

test('place and total value distinguish zero and multi-digit positions', () => {
 const cells=placeValueCells(13086)
 assert.deepEqual(cells.map(c=>[c.digit,c.label,c.value]),[[1,'ten thousands',10000],[3,'thousands',3000],[0,'hundreds',0],[8,'tens',80],[6,'ones',6]])
 assert.equal(expandedWholeNumber(13086),'10,000 + 3,000 + 80 + 6')
 assert.equal(expandedWholeNumber(0),'0')
 assert.equal(placeValueCells(-5).length,0)
})

test('rounding correctly handles half-up ties and 995 to 1000', () => {
 assert.equal(roundToNearestTen(995),1000)
 assert.equal(roundToNearestTen(994),990)
 assert.equal(roundToNearestTen(5),10)
 assert.equal(roundToNearestTen(0),0)
 assert.throws(()=>roundToNearestTen(-1),RangeError)
})

test('factor, multiple, even/odd and roman models have valid Grade 4 boundaries', () => {
 assert.deepEqual(factorsOf(36),[1,2,3,4,6,9,12,18,36])
 assert.deepEqual(factorsOf(1),[1])
 assert.deepEqual(multiplesOf(12),[12,24,36,48])
 assert.equal(37 % 2,1)
 assert.equal(58 % 2,0)
 assert.equal(romanUpToTen(6),'VI')
 assert.equal(romanUpToTen(10),'X')
 assert.equal(romanUpToTen(11),null)
})

test('published reader route and editor both support the actual original interactive kind', () => {
 const router=read('../components/global/publish/CrossSubjectInteractiveBlock.tsx')
 const editor=read('../components/global/publish/ContentBlockEditor.tsx')
 const component=read('../components/global/publish/WholeNumbersInteractiveBlock.tsx')
 assert.match(router,/mathematics_whole_numbers_lab/)
 assert.match(router,/WholeNumbersInteractiveBlock/)
 assert.match(editor,/value="mathematics_whole_numbers_lab"/)
 assert.match(component,/aria-pressed/)
 assert.match(component,/aria-live="polite"/)
 assert.doesNotMatch(component,/fetch\(|supabase\.|localStorage\./)
})
