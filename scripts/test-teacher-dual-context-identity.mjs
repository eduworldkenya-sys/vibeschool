import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const source = fs.readFileSync('lib/teacher/teachingIdentity.ts','utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText
const { resolveTeacherTeachingIdentity: resolve, selectTeacherTeachingScope: select } =
  await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

const standalone = resolve('teacher-a', { state: 'needs_school', active_school_id: null, schools: [] })
assert.equal(standalone.teacherId, 'teacher-a')
assert.deepEqual(standalone.availableScopes.map(s => s.key), ['independent'])
assert.equal(standalone.defaultScope.kind, 'independent')
assert.equal(standalone.defaultScope.schoolId, null)

const linked = resolve('teacher-a', {
  state: 'ready',
  active_school_id: 'school-b',
  schools: [{ id: 'school-a', name: 'School A' }, { id: 'school-b', name: 'School B' }],
})
assert.deepEqual(linked.availableScopes.map(s => s.key), ['school:school-a','school:school-b','independent'])
assert.equal(linked.defaultScope.schoolId, 'school-b', 'server-selected active school takes precedence')
assert.equal(linked.defaultScope.teacherId, 'teacher-a', 'school-scoped teacher retains one auth ID')
assert.equal(select(linked, 'independent').teacherId, 'teacher-a')
assert.equal(select(linked, 'independent').schoolId, null)
assert.equal(select(linked, 'school:school-a').schoolId, 'school-a')
assert.throws(() => select(linked, 'school:unlinked'), /not available/)
assert.throws(() => select(linked, 'school:school-a;drop'), /not available/)
assert.throws(() => resolve('teacher-a', { active_school_id: 'other', schools: [{id:'school-a',name:'School A'}] }), /authorised school/)
assert.throws(() => resolve('teacher-a', { active_school_id: 'school-a' }), /could not be verified/)
assert.throws(() => resolve('teacher-a', null), /could not be verified/)
assert.throws(() => resolve('', {schools:[]}), /Authenticated teacher identity/)
assert.throws(() => resolve('teacher-a', {schools: [{id:'',name:'bad'}]}), /Malformed/)
assert.throws(() => resolve('teacher-a', {schools: [{id:'school-a',name:null}]}), /Malformed/)
assert.throws(() => resolve('teacher-a', {active_school_id: 42, schools: []}), /Invalid active/)
const duplicate = resolve('teacher-a', {schools:[{id:'school-a',name:'A'},{id:'school-a',name:'Duplicated'}]})
assert.equal(duplicate.availableScopes.length, 2, 'duplicate memberships cannot produce duplicate contexts')
assert.equal(duplicate.defaultScope.kind, 'school', 'linked teachers default to verified school')
assert.equal(resolve('teacher-b', {schools:[{id:'school-x',name:'X'}]}).defaultScope.teacherId, 'teacher-b')
assert.ok(linked.availableScopes.every(scope => scope.teacherId === 'teacher-a'))

// Static integration guards: the existing membership RPC and auth ID remain
// authoritative and no independent context switches an operational timetable yet.
const layout = fs.readFileSync('app/teacher/layout.tsx','utf8')
const ui = fs.readFileSync('components/teacher/TeacherUiContext.tsx','utf8')
assert.match(layout, /supabase\.auth\.getUser\(\)/)
assert.match(layout, /get_my_teacher_school_context/)
assert.match(layout, /profileRes\.data\?\.role !== "teacher"/, 'non-teacher cannot be classified as independent')
assert.match(layout, /resolveTeacherTeachingIdentity\(user\.id, schoolContextRes\.data\)/)
assert.match(layout, /TeachingIdentityContext\.Provider/)
assert.match(ui, /useTeachingIdentity/)
assert.doesNotMatch(source, /from ['"]@\/lib\/supabase|supabase\.rpc\(|localStorage|INSERT|UPDATE|CREATE TABLE/)
console.log('PASS: one authenticated teacher, school-first and independent contexts, negative membership controls')
