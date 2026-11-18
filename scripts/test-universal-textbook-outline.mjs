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

const combined = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText
const {connectReadingEntries} = await import('data:text/javascript;base64,' + Buffer.from(combined).toString('base64'))
const routes = [{id:'published',title:'Lesson',href:'/read/textbook/p/c',subStrandId:'c'},{id:'legacy',title:'Subtraction',href:'/existing',legacy:true},{id:'other',title:'Other edition',href:'/read/textbook/o',subStrandId:'wrong'}]
const connected = connectReadingEntries(rows,routes)
assert.equal(connected.groups[0].topics[0].entries[0].id,'published','paced duplicate IDs are matched only via their canonical row')
assert.equal(connected.groups[0].topics[1].entries[0].id,'legacy')
assert.deepEqual(connected.unmatched,[routes[2]],'Never attach a mismatched stable ID by title')
assert.equal(connectReadingEntries([],routes).unmatched.length,3,'Published content survives missing maps')
assert.equal(connectReadingEntries(rows,[routes[0],routes[0]]).groups[0].topics[0].entries.length,1)
assert.equal(connectReadingEntries([...rows,{id:'f',name:'Other',sub_strand:'Subtraction'}],[routes[1]]).unmatched.length,1,'No ambiguous legacy match')
assert.match(outline,/\.eq\('status','published'\)/)
assert.match(outline,/\.eq\('viewer_id',user\.id\)/)
assert.doesNotMatch(outline,/\.select\([^\n]*blocks/)
assert.match(outline,/resumed \? 'Continue reading' : 'Start reading'/)
assert.doesNotMatch(library,/>Topics and lessons<|>Published textbooks<|>Existing lesson readers</)
console.log('PASS: single book landing, existing reader destinations, owner-only resume, no draft leakage or fabricated linkage')
