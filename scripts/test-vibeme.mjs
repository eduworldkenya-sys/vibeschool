import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseCharacter,characterChoices,characterCode,CHARACTER_OPTIONS } from '../lib/vibeme-character.ts'
import { codeFromAvatar,defaultCharacter, defaultVibeMe, renderVibeMe, parseVibeMe, vibeMeCode, vibeMePath, VIBEME_OPTIONS } from '../lib/vibeme.ts'
test('VibeMe validates bounds and round-trips all settings', () => {
  assert.equal(VIBEME_OPTIONS.reduce((n,o)=>n*o.values.length,1),46656)
  for(const code of ['v1-0000000','v1-5522355','v1-2000000']) {
    const parsed=parseVibeMe(code); assert.ok(parsed)
    assert.equal(vibeMeCode(parsed),code)
    assert.equal(codeFromAvatar(vibeMePath(code)),code)
    assert.match(renderVibeMe(code),/^<svg /)
  }
  for(const code of ['v1-9999999','v1-00000000','<script>','v2-0000000']) {
    assert.equal(parseVibeMe(code),null); assert.equal(renderVibeMe(code),null)
  }
  assert.equal(codeFromAvatar('https://evil.example/api/vibeme/v1-0000000.svg'),null)
  assert.equal(defaultVibeMe('account-a'),defaultVibeMe('account-a'))
  assert.ok(parseVibeMe(defaultVibeMe('account-b')))
})

test('v2 is backward compatible and provides independent, finite appearance choices',()=>{
  const adult=defaultCharacter('id')
  const student=defaultCharacter('id',true)
  assert.equal(parseCharacter(adult)[8],0);assert.equal(parseCharacter(student)[8],1)
  assert.equal(codeFromAvatar(vibeMePath(adult)),adult)
  assert.equal(codeFromAvatar(vibeMePath(student)),student)
  const choices=characterChoices([2,0,0,0,0,0,0])
  const baseline=renderVibeMe(characterCode(choices))
  CHARACTER_OPTIONS.forEach((option,index)=>{
    option.values.forEach((_,value)=>{
      const changed=[...choices]; changed[index]=value
      const code=characterCode(changed); assert.deepEqual(parseVibeMe(code),changed)
      const svg=renderVibeMe(code);assert.match(svg,/^<svg /);assert.ok(!svg.includes('undefined'))
      if(value!==choices[index])assert.notEqual(svg,baseline,option.label)
    })
  })
  assert.equal(parseVibeMe('v2-9999999999999999'),null)
  assert.equal(codeFromAvatar('https://evil.example/api/vibeme/'+adult+'.svg'),null)
})

test('educational characters use authored static assets only',async()=>{
  const {adaptCanonicalLearnSections}=await import('../lib/learn/learningBlockContract.ts')
  const code=defaultCharacter('fictional-student',true)
  const [section]=adaptCanonicalLearnSections([{id:'demo',title:'Demo',blocks:[{kind:'character',code,altText:'Fictional student'},{kind:'character',code:'https://evil.example',altText:'Not permitted'},{kind:'character',code:code.slice(0,-1)+'2',altText:'Moving illustration'}]}])
  assert.equal(section.blocks.length,1)
  assert.equal(section.blocks[0].code,code)
})
