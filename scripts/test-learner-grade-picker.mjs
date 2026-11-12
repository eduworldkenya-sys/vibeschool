import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const grades = [
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
  'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
  'Form 1', 'Form 2', 'Form 3', 'Form 4',
]
const src = readFileSync('components/learner/LearnerGradePicker.tsx', 'utf8')
const code = ts.transpileModule(src, { compilerOptions: {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.ReactJSX,
} }).outputText

const jsx = (type, props) => ({ type, props })
const exports = {}
runInNewContext(code, {
  exports,
  require: name => {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (name === '@/lib/learner/independent-grade') return { LEARNER_GRADES: grades }
    if (name === './LearnerGradePicker.module.css') return { default: { fieldset: 'fieldset', legend: 'legend', grid: 'grid', option: 'option' } }
    throw Error('Unexpected import: ' + name)
  },
})
let picked = null
const root = exports.default({ value: 'Grade 4', onChange: value => { picked = value } })
const nodes = []
function visit(node) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) { node.forEach(visit); return }
  nodes.push(node)
  visit(node.props?.children)
}
visit(root)

assert.equal(root.type, 'fieldset')
assert.equal(nodes.find(x => x.type === 'legend')?.props.children, 'Your grade or form')
const buttons = nodes.filter(x => x.type === 'button')
assert.equal(buttons.length, grades.length, 'All 16 grade and form choices must be displayed at once')
assert.deepEqual(buttons.map(x => x.props.children), grades)
assert(buttons.every(x => x.props.type === 'button'), 'Grade choices must not submit the form')
assert.equal(buttons.filter(x => x.props['aria-pressed']).length, 1)
assert.equal(buttons.find(x => x.props['aria-pressed']).props.children, 'Grade 4')
buttons.find(x => x.props.children === 'Grade 7').props.onClick()
assert.equal(picked, 'Grade 7', 'Selecting a grade must update the parent-controlled value')
assert.equal(nodes.filter(x => x.type === 'select').length, 0, 'Never fall back to unreadable native dropdown')

for (const filename of [
  'app/signup/student/independent/page.tsx',
  'app/signup/student/email/EmailSignupForm.tsx',
]) {
  const page = readFileSync(filename, 'utf8')
  assert.match(page, /<LearnerGradePicker value=\{grade\} onChange=\{setGrade\}/)
  assert.doesNotMatch(page, /<select/, filename + ' must use the accessible visible picker')
}
const css = readFileSync('components/learner/LearnerGradePicker.module.css', 'utf8')
assert.match(css, /min-height:\s*46px/)
assert.match(css, /\.option\[aria-pressed="true"\]/)
assert.match(css, /\.option:focus-visible/)

console.log('Independent learner grade picker visibility, selection, and integration passed.')
