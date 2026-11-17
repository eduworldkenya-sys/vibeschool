import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const read = file => readFileSync(file, 'utf8')
const js = (file, jsx = false) => ts.transpileModule(read(file), { compilerOptions: {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
  jsx: jsx ? ts.JsxEmit.ReactJSX : undefined,
} }).outputText

const moduleExports = {}
runInNewContext(js('lib/learner/learning-levels.ts'), { exports:moduleExports })
const { LEARNING_LEVELS, PUBLIC_LEARNING_LEVELS, resolveLearningSelection, resolveRegistrationLearningSelection, POST_SECONDARY_PUBLIC_ENABLED } = moduleExports
assert.equal(LEARNING_LEVELS.length, 8)
assert.deepEqual(Array.from(LEARNING_LEVELS, group=>group.id), [
  'pre-primary','primary','junior','senior','secondary','college','university','professional',
])
for(const group of LEARNING_LEVELS) {
  assert.ok(group.choices.length > 0, group.id)
  for(const choice of group.choices) assert.ok(resolveLearningSelection(group.id, choice), group.id+':'+choice)
}
assert.equal(resolveLearningSelection('professional','CPA').gradeLabel, 'Professional Studies')
assert.equal(resolveLearningSelection('professional','CPA').pathway.qualification_code, 'CPA')
assert.equal(resolveLearningSelection('professional','CS').pathway.examining_body, 'KASNEB')
assert.equal(resolveLearningSelection('college','Diploma').pathway.programme_family, 'tvet')
assert.equal(resolveLearningSelection('university','Postgraduate').gradeLabel, 'University')
assert.equal(resolveLearningSelection('pre-primary','PP2').gradeLabel, 'PP2')
assert.equal(resolveLearningSelection('junior','Grade 8').gradeLabel, 'Grade 8')
for(const [level,choice] of [['senior','Grade 2'],['professional','Grade 12'],['college','CPA'],['teacher','admin'],['primary',''],['__proto__','CPA']]) {
  assert.equal(resolveLearningSelection(level,choice), null, 'reject mismatched or forged level')
}
const jsx = (type,props)=>({type,props})
const picker = {}
runInNewContext(js('components/learner/LearningLevelSelect.tsx',true),{
  exports:picker,
  require:name=>{
    if(name==='react/jsx-runtime')return {jsx,jsxs:jsx}
    if(name==='@/lib/learner/learning-levels')return {PUBLIC_LEARNING_LEVELS}
    throw Error('Unexpected import: '+name)
  },
})
function visit(node,output=[]) {
  if(Array.isArray(node)){node.forEach(child=>visit(child,output));return output}
  if(!node||typeof node!=='object')return output
  output.push(node)
  visit(node.props?.children,output)
  return output
}
let updatedLevel='',updatedChoice='not-reset'
const root=picker.default({level:'primary',choice:'Grade 4',
  onLevelChange:value=>updatedLevel=value,onChoiceChange:value=>updatedChoice=value})
const nodes=visit(root)
const selects=nodes.filter(node=>node.type==='select')
assert.equal(selects.length,2,'compact design has exactly two dropdowns')
const levelOptions=visit(selects[0]).filter(node=>node.type==='option')
assert.equal(POST_SECONDARY_PUBLIC_ENABLED,false)
assert.deepEqual(Array.from(PUBLIC_LEARNING_LEVELS,group=>group.id),['pre-primary','primary','junior','senior','secondary'])
assert.equal(levelOptions.length,6,'five school levels plus placeholder')
assert.ok(!levelOptions.some(option=>['college','university','professional'].includes(option.props.value)))
for(const group of LEARNING_LEVELS) for(const choice of group.choices) {
  const legacy=resolveLearningSelection(group.id,choice)
  if(legacy.pathway) assert.equal(resolveRegistrationLearningSelection(group.id,choice),null)
  else assert.ok(resolveRegistrationLearningSelection(group.id,choice))
  assert.ok(resolveRegistrationLearningSelection(group.id,choice,true),'reviewed unmute preserves all choices')
}
const choices=Array.from(visit(selects[1]).filter(node=>node.type==='option'),node=>node.props.children)
assert.deepEqual(choices,['Choose','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6'])
const stale=visit(picker.default({level:'professional',choice:'CPA',onLevelChange:()=>{},onChoiceChange:()=>{}})).filter(node=>node.type==='select')
assert.equal(stale[0].props.value,'')
assert.equal(stale[1].props.disabled,true)
assert.equal(stale[1].props.value,'')
selects[0].props.onChange({target:{value:'primary'}})
assert.equal(updatedLevel,'primary')
assert.equal(updatedChoice,'','changing level clears stale choice')
for(const page of [
  'app/signup/student/independent/page.tsx',
  'app/signup/student/email/EmailSignupForm.tsx',
]) {
  assert.match(read(page),/<LearningLevelSelect/)
  assert.doesNotMatch(read(page),/<LearnerGradePicker/)
  assert.match(read(page),/data-auth-theme=\{appearance\}/)
}
const route=read('app/api/learner/independent/grade/route.ts')
assert.match(route,/resolveRegistrationLearningSelection/)
assert.match(route,/learner_email_verified_at/)
assert.match(route,/getUser\(/)
assert.match(route,/ensure_independent_learner_student/)
assert.match(route,/learner_education_paths/)
assert.match(route,/existingPath/)
assert.match(route,/restoreGrade/)
assert.doesNotMatch(route,/claim_my_initial_role|school_members|student_classes.*insert/)
const emailActions=read('app/signup/student/email/actions.ts')
assert.match(emailActions,/resolveRegistrationLearningSelection/)
assert.match(emailActions,/ensure_independent_learner_student/)
assert.match(emailActions,/learner_education_paths/)
const migration=read('supabase/migrations/20261115151020_independent_learning_level_paths.sql')
for(const grade of ['PP1','PP2','College','University','Professional Studies','Grade 12','Form 4']) {
  assert.ok(migration.includes("'"+grade+"'"),'missing DB grade label '+grade)
}
assert.doesNotMatch(migration,/grant|role|school_id|create table/i)
for(const page of ['app/login/[role]/page.tsx','app/signup/student/SchoolSignupForm.tsx','app/join/JoinForm.tsx']) {
  assert.match(read(page),/useAuthAppearance/)
  assert.match(read(page),/data-auth-theme=\{appearance\}/)
}
assert.match(read('app/auth/useAuthAppearance.ts'),/readTheme\(\)/)
assert.match(read('app/student/college/page.tsx'),/otherPath/)
assert.match(read('app/student/college/page.tsx'),/qualification_code !== 'CPA'/)
assert.match(read('app/student/college/profile/page.tsx'),/study\.qualification_code/)
console.log('PASS: school-only public choices and preserved eight-level catalogue, two-dropdown UX, invalid paths, theme and verified account routing')
