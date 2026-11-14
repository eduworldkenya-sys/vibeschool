import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createSpinPlan,normalizeSpinAngle,uniformSpinIndex} from '../app/spin-studio/spin-brain.ts'

test('every eligible segment is selectable without modulo bias',()=>{
  for(let size=2;size<=24;size++){
    const observed=new Set()
    for(let i=0;i<size;i++) observed.add(uniformSpinIndex(size,()=>i))
    assert.equal(observed.size,size)
  }
  assert.throws(()=>uniformSpinIndex(0))
  assert.throws(()=>uniformSpinIndex(2,()=>-1))
  assert.equal(uniformSpinIndex(3,(()=>{let n=0;return ()=>n++===0?0xffffffff:7})()),1)
})
test('wheel plan stops at exact center of selected segment for 2–100 segments',()=>{
  for(const count of [2,3,4,6,8,9,16,24,100]){
    for(const index of [0,Math.floor(count/2),count-1]){
      for(const start of [-720,0,21,180,360,3600,1000000]){
        for(const direction of ['clockwise','counterclockwise','alternate','random']){
          const plan=createSpinPlan({selectedId:'id-'+index,selectedIndex:index,segmentCount:count,currentAngle:start,round:1,durationSeconds:6,direction,nextUint32:()=>0})
          const landed=normalizeSpinAngle(plan.endAngle+(index+.5)*360/count)
          assert.ok(Math.min(landed,360-landed)<1e-8,JSON.stringify({count,index,start,direction,landed}))
          assert.equal(normalizeSpinAngle(plan.endAngle),plan.settledAngle)
          assert.ok(Object.isFrozen(plan))
          assert.ok(Math.abs(plan.endAngle)<7200)
        }
      }
    }
  }
})
test('alternate direction and duration bounds do not affect selected identity',()=>{
  const base={selectedId:'candidate-a',selectedIndex:2,segmentCount:6,currentAngle:270,durationSeconds:6,direction:'alternate'}
  assert.equal(createSpinPlan({...base,round:0}).direction,1)
  assert.equal(createSpinPlan({...base,round:1}).direction,-1)
  assert.equal(createSpinPlan({...base,round:2}).direction,1)
  const short=createSpinPlan({...base,round:0,durationSeconds:.1})
  const long=createSpinPlan({...base,round:0,durationSeconds:500})
  assert.equal(short.durationMs,2000)
  assert.equal(long.durationMs,15000)
  assert.equal(short.selectedId,long.selectedId)
  assert.equal(short.settledAngle,long.settledAngle)
})
test('random index is approximately uniform with deterministic random source',()=>{
  let state=0x12345678
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state}
  const counts=new Array(6).fill(0)
  for(let i=0;i<60000;i++)counts[uniformSpinIndex(6,random)]++
  for(const count of counts)assert.ok(Math.abs(count-10000)<350,String(count))
})
