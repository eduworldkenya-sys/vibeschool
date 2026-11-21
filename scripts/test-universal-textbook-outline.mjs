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

const {buildPresentationOutline}=await import('data:text/javascript;base64,'+Buffer.from(combined).toString('base64'))
// Synthetic fixture follows the mapped Grade 4 English source-locator contract.
const themes=Array.from({length:13},(_,i)=>i===1?'Safety: At Home':'Theme '+(i+1))
const strands=['Listening and Speaking','Reading','Grammar in Use','Writing']
const themedRows=themes.flatMap((theme,i)=>strands.map((strand,j)=>({id:i+'-'+j,name:strand,sub_strand:theme+': Skill '+j,strand_order:j+1,sub_strand_order:i+1,source_ref:'VS-CUR-FIXTURE#'+String(i+1).padStart(2,'0')+'-'+['LS','RD','GR','WR'][j]})))
const themed=buildPresentationOutline([...themedRows.reverse(),{id:'old',name:'Grammar',sub_strand:'Legacy'}])
assert.equal(themed.themed,true)
assert.equal(themed.chapters.length,13)
assert.equal(themed.chapters[1].title,'Safety: At Home')
assert.deepEqual(themed.chapters[0].topics.map(t=>t.strand),strands)
assert.equal(themed.chapters.flatMap(c=>c.topics).length,52)
const released={id:'release',title:'Released',href:'/read/textbook/a/b',subStrandId:'1-2'}
assert.equal(connectReadingEntries(themedRows,[released]).groups[1].topics[2].entries[0].id,'release')
const incomplete=themedRows.filter(row=>row.id!=='1-2')
assert.equal(buildPresentationOutline(incomplete).themed,false,'Do not guess a theme from incomplete metadata')
assert.equal(buildPresentationOutline(rows).themed,false)
assert.match(outline,/source_ref,strand_order,sub_strand_order/)
console.log('PASS: theme-first and strand-first presentation, compound theme labels, stable linked sections and fail-safe fallback')

// Grade 4 Maths: authenticated mapped index, 19 stable IDs and no legacy
// Algebra/Integers leakage or fabricated released chapter paths.
const {projectGrade4MathOutline}=await import('data:text/javascript;base64,'+Buffer.from(combined).toString('base64'))
const mappedFixture=[8,7,3,1].flatMap((count,major)=>Array.from({length:count},(_,minor)=>({
 id:'mapped-'+(major+1)+'-'+(minor+1),
 name:['Numbers','Measurement','Geometry','Data Handling'][major],
 sub_strand:'Sub-strand '+(major+1)+'.'+(minor+1),
 strand_order:null,sub_strand_order:null
})))
const mappedBindings=mappedFixture.map((row)=>({
 sub_strand_id:row.id,
 source_ref:'VS-CUR-G04-MA-2026#'+row.sub_strand.slice('Sub-strand '.length)
}))
const legacyRows=[
 {id:'legacy-integers',name:'Numbers',sub_strand:'Integers'},
 {id:'legacy-algebra',name:'Algebra',sub_strand:'Expressions'},
 {id:'legacy-operations',name:'Operations',sub_strand:'Addition'}
]
const projected=projectGrade4MathOutline([...legacyRows,...mappedFixture].reverse(),mappedBindings.reverse())
assert.equal(projected.length,19)
assert.deepEqual(projected.slice(0,3).map(r=>r.sub_strand),['Sub-strand 1.1','Sub-strand 1.2','Sub-strand 1.3'])
assert.deepEqual(buildPresentationOutline(projected).chapters.map(c=>c.title),['Numbers','Measurement','Geometry','Data Handling'])
assert.equal(buildPresentationOutline(projected).chapters[0].topics.length,8)
assert.equal(buildPresentationOutline(projected).chapters[1].topics.length,7)
assert.ok(!projected.some(r=>r.id.startsWith('legacy-')))
const actualPublished={id:'published-section',title:'Chapter',href:'/read/textbook/pub/chapter',subStrandId:'mapped-1-1'}
assert.equal(connectReadingEntries(projected,[actualPublished]).groups[0].topics[0].entries[0].href,actualPublished.href)
assert.equal(projectGrade4MathOutline(mappedFixture,mappedBindings.slice(1)),null,'Partial authority cannot rewrite the public shell')
assert.equal(projectGrade4MathOutline(mappedFixture,[...mappedBindings.slice(0,-1),mappedBindings[0]]),null,'Duplicate code/ID must fail closed')
assert.equal(projectGrade4MathOutline(mappedFixture,[...mappedBindings.slice(0,-1),{source_ref:'VS-CUR-G04-MA-2026#9.9',sub_strand_id:'mapped-4-1'}]),null)
assert.equal(projectGrade4MathOutline(mappedFixture,[...mappedBindings.slice(0,-1),{source_ref:'VS-CUR-G04-MA-2026#4.1',sub_strand_id:'not-a-real-id'}]),null)
assert.match(outline,/grade !== 'Grade 4'/)
assert.match(outline,/auth\.getUser\(\)/)
assert.match(outline,/grade4_mathematics_reader_bindings/)
assert.match(outline,/source_type','creator_claimed'/)
assert.match(outline,/\.eq\('status','active'\)/)
assert.match(outline,/View all \{goals\.length\} objectives/)
assert.match(outline,/What you'll learn/)
assert.match(outline,/VibeSchool curriculum guidance/)
assert.match(outline,/\.in\('sub_strand_id', ids\)/)
assert.doesNotMatch(outline,/service_role|\.select\('.*(?:payload|marking_key|teacher_guide)/)
console.log('PASS: authenticated Grade 4 Maths objective previews, canonical 19-row ordering, legacy isolation, fail-closed mapping and unchanged release links')

assert.match(outline,/get_school_textbook_shell_metadata/)
const publicShellSql=read('supabase/migrations/20261119053000_public_school_textbook_shell_metadata.sql')
assert.match(publicShellSql,/s\.school_id is null/)
assert.match(publicShellSql,/p_grade in \('Playgroup'/)
assert.match(publicShellSql,/grant execute on function public\.get_school_textbook_shell_metadata\(text,text\) to anon,authenticated/)
assert.doesNotMatch(publicShellSql,/grant select|vibe_publications|vibe_chapters|learning_outcomes|suggested_experiences|profiles|school_members/)
