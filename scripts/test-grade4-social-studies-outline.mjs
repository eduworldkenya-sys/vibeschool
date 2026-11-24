import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const source=readFileSync(new URL('../lib/learn/grade4SocialStudiesOutline.ts',import.meta.url),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const {projectGrade4SocialStudiesOutline}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'))
const m=JSON.parse(readFileSync(new URL('../docs/content/grade4-social-studies-textbook/manifest.json',import.meta.url),'utf8'))
const canonical=m.units.map(u=>({id:u.unitId,name:'Strand '+u.code.split('.')[0],sub_strand:u.code+' Source unit'}))
const old=Array.from({length:39},(_,i)=>({id:'historic-'+i,name:'Old',sub_strand:'Old '+i}))
test('58 mixed rows become exactly 19 source-linked rows without deleting any history',()=>{
 const all=[...old,...canonical].reverse()
 const result=projectGrade4SocialStudiesOutline(all)
 assert.equal(all.length,58)
 assert.deepEqual(result.map(r=>r.id),canonical.map(r=>r.id))
 assert.equal(new Set(result.map(r=>r.strand_order)).size,5)
})
test('missing or duplicated source IDs fail closed rather than resurrecting old units',()=>{
 assert.equal(projectGrade4SocialStudiesOutline([...old,...canonical.slice(1)]),null)
 assert.equal(projectGrade4SocialStudiesOutline([...canonical,canonical[0]]),null)
})
