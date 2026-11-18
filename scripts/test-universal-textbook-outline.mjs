import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const source = read('lib/learn/textbookOutline.ts')
const compiled = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText
const {buildTextbookOutline} = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))
assert.deepEqual(buildTextbookOutline([]),[])
const rows = [{id:'a',name:'Numbers',sub_strand:'Addition'},{id:'b',name:'Numbers',sub_strand:'Subtraction'},{id:'c',name:' numbers ',sub_strand:' addition '},{id:'d',name:'Geometry',sub_strand:null},{id:'e',name:'',sub_strand:'Ignored'}]
assert.deepEqual(buildTextbookOutline(rows),[{id:'a',title:'Numbers',topics:[{id:'a',title:'Addition'},{id:'b',title:'Subtraction'}]},{id:'d',title:'Geometry',topics:[]}])
const library=read('components/learn/SchoolLearnLibrary.tsx')
const outline=read('components/learn/SubjectTextbookOutline.tsx')
assert.match(library, /<SubjectTextbookOutline grade=\{grade\} subject=\{activeName\}/)
assert.match(outline, /\.eq\('grade', grade\)\.eq\('subject_id', matches\[0\]\.id\)/)
assert.match(outline, /matches\.length !== 1/)
assert.match(outline, /state\.scope === scope/)
assert.doesNotMatch(outline,/\.insert\(|\.update\(|\.upsert\(|service_role/)
assert.match(library,/\.eq\('status', 'published'\)/)
console.log('PASS: variable textbook shells, canonical hierarchy, empty and duplicate handling, scope isolation, publication boundary')
