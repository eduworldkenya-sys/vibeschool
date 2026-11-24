import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = readFileSync(new URL('../lib/learn/schoolCatalog.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { SCHOOL_LEVELS, fallbackSubjectGroups, groupsForAvailableSubjects, groupsForTextbookShells,
  levelForGrade, readersForSubject, recogniseLearnerGrade, subjectKey } =
  await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8')
const ui = read('components/learn/SchoolLearnLibrary.tsx')
const css = read('components/learn/SchoolLearnLibrary.module.css')
const publicPage = read('app/learn/page.tsx')
const studentPage = read('app/student/vibelearn/reading/page.tsx')
const courses = read('app/learn/courses/page.tsx')
const catalog = read('lib/learn/schoolCatalog.ts')

assert.equal(SCHOOL_LEVELS.length, 5, 'Early Years, Primary, Junior, Senior, legacy must be separate')
assert.equal(new Set(SCHOOL_LEVELS.flatMap(group => group.grades)).size, 19, 'All levels need unique grade identities')
for (const grade of ['PP1','PP2']) assert.equal(fallbackSubjectGroups(grade)[0].subjects.length, 4)
for (let n = 1; n <= 9; n++) {
  const groups = fallbackSubjectGroups('Grade ' + n)
  const core = groups[0].subjects
  assert.equal(core.length, n <= 3 ? 7 : n <= 6 ? 8 : 9, 'Exact national main learning areas per grade band')
  assert.ok(core.includes('Mathematics') && core.includes('English') && core.includes('Kiswahili'))
}
assert.equal(fallbackSubjectGroups('Grade 10').length, 4, 'Senior School needs pathway grouping')
assert.equal(fallbackSubjectGroups('Playgroup').length, 0, 'Playgroup has no invented KICD subject list')
assert.equal(fallbackSubjectGroups('Form 4').length, 0, 'Legacy Forms cannot receive invented full subject lists')
assert.equal(levelForGrade('Grade 9'), 'junior')
assert.equal(levelForGrade('Grade 10'), 'senior')
assert.equal(recogniseLearnerGrade('Grade 4 Kilimanjaro'), 'Grade 4')
assert.equal(recogniseLearnerGrade('Form 4'), 'Form 4')
assert.equal(subjectKey('Science and Technology'), subjectKey('Science & Technology'))
assert.equal(subjectKey('Creative Arts and Sports'), subjectKey('Creative Arts'))
assert.equal(subjectKey('Agriculture and Nutrition'), subjectKey('Agriculture'))
assert.deepEqual(groupsForAvailableSubjects('Grade 4', ['Mathematics', 'Extra Subject']).flatMap(group => group.subjects), ['Mathematics', 'Extra Subject'],
  'Canonical registered subjects must not be silently dropped')
assert.equal(readersForSubject('Grade 4','Mathematics')[0]?.href, '/learn/grade-4/mathematics/place-value',
  'Published Grade 4 Maths Lesson 1 must be the first discoverable Learn reader')
assert.ok(readersForSubject('Grade 4','Mathematics').some(reader => reader.href === '/learn/grade-4/mathematics/time'),
  'Existing Grade 4 Time reader remains available')
assert.equal(readersForSubject('Grade 1','Creative Activities')[0]?.href, '/learn/grade-1/creative-activities')
assert.equal(readersForSubject('Grade 8','Mathematics').length, 0, 'No fictitious certified reader')
assert.match(ui, /\.eq\('status', 'published'\)/, 'Only published books')
assert.match(ui, /\.eq\('format', 'vibetextbook'\)/, 'Use canonical publication type')
assert.match(ui, /\.range\(/, 'Paginate rather than truncate the first 150 books')
assert.match(ui, /if \(!active\) return/, 'Cancel stale publication requests')
assert.match(ui, /setRegisteredSubjects\(null\)/, 'Reset stale grade registry on grade changes')
assert.match(ui, /\.eq\('grade', grade\)/, 'Use the canonical subject authority')
assert.match(ui, /role="tablist"/, 'Subject tabs must remain accessible')
assert.match(ui, /aria-label="Choose grade"/, 'Grade selector must have an accessible name')
assert.match(ui, /href=\{reader\.href\}/, 'Do not rebuild protected lesson routes')
assert.match(ui, /grade4MathsLesson && <section/, 'Learn Grade 4 landing must display Lesson 1')
assert.match(ui, /href=\{grade4MathsLesson\.href\}/, 'Grade 4 Learn landing opens the registered lesson')
assert.match(ui, /activeReaders\.map\(reader => <Link className=\{styles\.resource\}/,
  'Subject Learn shows lesson links before the collapsible textbook')
assert.match(ui, /aria-label="Available subject lessons"/)
assert.match(catalog, /title: 'Place Value and Total Value'/)
assert.match(ui, /encodeURIComponent\(book\.id\)/, 'Canonical textbook identity must be safely encoded')
assert.doesNotMatch(ui, /service_role|certified_at\s*=/, 'Browser library must not bypass release controls')
assert.match(css, /@media\(max-width:620px\)/, 'Mobile layout must be present')
assert.match(publicPage, /SchoolLearnLibrary mode="public"/)
assert.match(studentPage, /StudentLearnLegacyRedirect/, 'Old student reader must converge on canonical Learn')
assert.match(read('components/learn/StudentLearnLegacyRedirect.tsx'), /recogniseLearnerGrade\(identity\?\.className\)/, 'Preserve the learner grade when redirecting')
assert.match(courses, /redirect\('\/learn\?view=courses'\)/, 'Retire the competing college catalogue but preserve its route')
assert.match(catalog, /No invented Playgroup or legacy Form national subject lists/)
console.log('PASS: school Learn frontend, all grade bands, subject authority, publication gating, existing readers and responsive shared discovery')

await import('./test-universal-textbook-outline.mjs')

await import('./test-persistent-textbook-shell.mjs')

assert.ok(groupsForTextbookShells('Grade 5',[]).flatMap(g=>g.subjects).includes('Christian Religious Education'))
const shellNames=groupsForTextbookShells('Grade 4',['Mathematics','CRE','New registered subject']).flatMap(g=>g.subjects)
assert.ok(shellNames.includes('English')&&shellNames.includes('New registered subject'))
assert.equal(shellNames.filter(n=>subjectKey(n)===subjectKey('CRE')).length,1)
assert.equal(groupsForTextbookShells('CPA',['Accounting']).length,0)
assert.deepEqual(groupsForTextbookShells('Form 1',['Computer Studies']).flatMap(g=>g.subjects),['Computer Studies'])
assert.match(ui,/get_school_textbook_shell_metadata/)
assert.match(ui,/'View textbook'/)

const studentDesk = read('app/student/study/page.tsx')
const studentDeskCss = read('app/student/study/study.module.css')
assert.match(studentDesk, /fallbackSubjectGroups\(grade\)/, 'Learner subject tiles use existing KICD grade catalogue')
assert.match(studentDesk, /href=\{browseHref \+ '&subject=' \+ encodeURIComponent\(subject\)\}/,
  'Subject tiles retain grade and subject in canonical Learn')
assert.match(studentDesk, /!loading && savedReading\.length === 0 && subjectDesk/,
  'New learner must see subjects without a dummy empty progress card')
assert.match(studentDesk, /!loading && savedReading\.length > 0 && subjectDesk/,
  'Returning learner must retain subjects alongside saved reading')
assert.match(studentDesk, /safeInternalRoute\(item\.actionUrl\)/,
  'Saved reading must retain safe internal navigation')
assert.match(studentDeskCss, /\.subjectGrid\{display:grid;grid-template-columns:repeat\(4/,
  'Learn must have a responsive subject tile grid')
assert.match(ui, /\.in\('publication_id', ids\.slice\(offset, offset \+ 50\)\)/,
  'Chapter search only checks published book IDs within the selected grade')
assert.match(ui, /\.eq\('status', 'published'\)\s*\.ilike\('title'/,
  'Chapter search must not expose unpublished chapters')
assert.match(ui, /href=\{`\/read\/textbook\/\$\{encodeURIComponent\(chapter\.publication_id\)\}/,
  'Chapter search opens the existing textbook reader without a second authority')
assert.match(ui, /chapterSearchStatus === 'error'/, 'Chapter query errors must be visible and recoverable')
assert.match(ui, /chapterSearchStatus === 'loading'/, 'Chapter search must distinguish loading from empty')
assert.match(ui, /<SubjectTextbookOutline/, 'Existing curriculum-linked textbook contents remain authoritative')
assert.ok(ui.indexOf('<SubjectTextbookOutline') < ui.indexOf('More lesson links'),
  'Textbook contents must precede optional duplicate lesson links')
assert.match(css, /\.chapterSearchResults/, 'Chapter search has dedicated accessible presentation')
assert.doesNotMatch(studentDesk, /get_school_textbook_shell_metadata|service_role/,
  'Personal Learn must not introduce competing publication or privileged authorities')


// Exercise the actual matcher, not just source strings.
const searchSource=read('lib/learn/textbookSearch.ts')
const searchCode=ts.transpileModule(searchSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText
const {searchReadableBook,rankSearchHits}=await import('data:text/javascript;base64,'+Buffer.from(searchCode).toString('base64'))
const payload={ok:true,publication:{id:'p1',status:'published',title:'Maths'},chapters:[
 {id:'c1',title:'Numbers',status:'published',can_read:true,blocks:[
  {id:'a',type:'paragraph',content:'<p>The place value of a digit depends on its position.</p>'},
  {id:'b',type:'definition',content:'Place value is the value of a digit in a number.'},
  {id:'c',type:'workedExample',content:'Place value of 3 in 345 is 300.'},
  {id:'d',type:'question',content:'Place value? Answer: 300'},
  {id:'e',type:'paragraph',content:'Place value teacher notes',meta:{teacherOnly:true}},
  {id:'f',type:'paragraph',content:'Place value Answer: hidden key'},
  {id:'g',type:'heading2',content:'Place value'},
 ]},
 {id:'c2',status:'published',can_read:false,blocks:[{id:'hidden',type:'definition',content:'Place value'}]},
 {id:'c3',status:'draft',can_read:true,blocks:[{id:'draft',type:'definition',content:'Place value'}]},
]}
const hits=rankSearchHits(searchReadableBook(payload,'p1','place value'))
assert.deepEqual(hits.map(h=>h.blockId),['b','c','a'])
assert.ok(hits.every(h=>!h.snippet.includes('<p>')))
assert.equal(searchReadableBook(payload,'wrong','place value').length,0)
assert.equal(searchReadableBook({...payload,publication:{...payload.publication,status:'draft'}},'p1','place value').length,0)
assert.equal(searchReadableBook(payload,'p1','value position').length,1)
assert.equal(searchReadableBook(payload,'p1','nonexistent concept').length,0)
assert.equal(rankSearchHits([...hits,...hits]).length,3)
assert.match(ui,/get_public_vibetextbook_reader/)
assert.match(ui,/get_vibetextbook_reader/)
assert.match(ui,/Math.min\(4,ids.length\)/)
assert.match(ui,/controller.abort\(\)/)
assert.match(ui,/new URLSearchParams\(\{block:hit.blockId\}\)/)
assert.match(ui,/sameLearnSubject\(grade,book.cbc_subject,selectedSubject\)/)
const continuity=read('components/read/ReaderContinuityCoordinator.tsx')
assert.match(continuity,/findBlockById\(explicitBlock\)\?\.scrollIntoView/)
assert.match(continuity,/if \(searchJump\) return;/)
assert.match(continuity,/if \(searchJump \|\| !authenticatedRef.current\) return;/)
assert.match(read('app/read/textbook/[publicationId]/[chapterId]/page.tsx'),/initialBlockId=\{initialBlockId\}/)
console.log('PASS: readable textbook content search, ranked results and explicit navigation boundary')
