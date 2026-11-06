import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const helperSource = fs.readFileSync('lib/public/vacancyApplication.ts', 'utf8')
const helperCode = ts.transpileModule(helperSource, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText
const { vacancyApplication } = await import('data:text/javascript;base64,' + Buffer.from(helperCode).toString('base64'))

for (const [input, href, label] of [
  ['https://forms.gle/GFnWM75zDyHmxSti6', 'https://forms.gle/GFnWM75zDyHmxSti6', 'View application'],
  ['hr@happylandschools.com', 'mailto:hr@happylandschools.com', 'Apply by email'],
  ['mailto:merubrightmindsacademy@gmail.com', 'mailto:merubrightmindsacademy@gmail.com', 'Apply by email'],
  ['+254795872302', 'tel:+254795872302', 'Call school'],
  ['tel:+254795872302', 'tel:+254795872302', 'Call school'],
]) {
  const result = vacancyApplication(input)
  assert.equal(result?.href, href)
  assert.equal(result?.label, label)
  assert.equal(result?.external, input.startsWith('https://'))
}
for (const input of [null, '', 'javascript:alert(1)', 'data:text/html,evil', '//evil.example', 'http://example.com', 'https://', 'https://user:pass@example.com', 'mailto:person@example.com?bcc=other@example.com', 'mailto:a@example.com\r\nBcc:other@example.com', 'tel:+254795872302;ext=1', 'tel:123', 'tel:1234567890123456']) {
  assert.equal(vacancyApplication(input), null, `Unsafe or malformed application contact accepted: ${input}`)
}
const page = fs.readFileSync('app/teacher/TeachingJobs.tsx', 'utf8')
assert(page.includes('vacancyApplication(j.application_url)'))
assert(page.includes('Job details'))
assert(page.includes('j.description ??'))
const hq = fs.readFileSync('app/hq/teacher-vacancies/page.tsx', 'utf8')
assert(hq.includes('vacancyApplication(form.application_url)'))
assert(hq.includes('description: form.description'))
console.log('Vacancy contact tests PASS: website/email/phone actions, safe schemes, hostile inputs, details/search and HQ preservation')
