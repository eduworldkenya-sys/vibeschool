import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const page = readFileSync(new URL('../app/institutions/page.tsx', import.meta.url), 'utf8')
const role = readFileSync(new URL('../app/institutions/InstitutionsRolePreview.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../app/institutions/Institutions.module.css', import.meta.url), 'utf8')
const contact = readFileSync(new URL('../app/contact/page.tsx', import.meta.url), 'utf8')

test('institutions retains public header, footer, canonical and distinct school directory', () => {
  assert.match(page, /canonical: '\/institutions'/)
  assert.match(page, /<PublicHeader product="For Schools" \/>/)
  assert.match(page, /<PublicFooter \/>/)
  assert.match(page, /href="\/schools"/)
  assert.doesNotMatch(page, /supabase|from\(['"]|\.rpc\(/i)
})

test('school setup action opens the matching public contact choice', () => {
  assert.match(page, /href="\/contact\?support=school"/)
  assert.match(contact, /requestedTopic === 'school'/)
  assert.match(contact, /setTopic\('school'\)/)
  assert.match(contact, /whatsappLink\('school'\)/)
})

test('workspace preview is interactive, role-specific and explicitly illustrative', () => {
  for (const roleName of ['leadership', 'teacher', 'learner', 'parent']) {
    assert.match(role, new RegExp(roleName + ': \\{'))
  }
  assert.match(role, /useState<RoleKey>\('leadership'\)/)
  assert.match(role, /aria-pressed=\{key === activeRole\}/)
  assert.match(role, /setActiveRole\(key\)/)
  assert.match(role, /No private school or learner records/)
  assert.match(role, /Conceptual workspace preview/)
})

test('responsive and reduced-motion styles are present', () => {
  assert.match(css, /@media\(max-width:560px\)/)
  assert.match(css, /@media\(prefers-color-scheme:dark\)/)
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/)
})

test('public institutions page does not claim fake school statistics or expose learner identities', () => {
  assert.doesNotMatch(page, /480 learners|18 teachers|12 classes|live enrolment/i)
  assert.match(page, /No real school or learner data displayed/)
})

test('school adoption disclosures remain visible in the concise experience', () => {
  for (const label of [
    'WHAT A SCHOOL CAN BRING TOGETHER',
    'IMPLEMENTATION PRINCIPLE',
    'BEFORE ADOPTION',
    'QUESTIONS A SCHOOL SHOULD ASK BEFORE BUYING',
    'does not publish an invented support or uptime guarantee',
  ]) {
    assert.ok(page.toLowerCase().includes(label.toLowerCase()), label)
  }
})

test('shared public skip link retains native keyboard navigation before hydration', () => {
  const skipLink = readFileSync(new URL('../components/public/PublicSkipLink.tsx', import.meta.url), 'utf8')
  assert.match(skipLink, /href="#main-content"/)
  assert.doesNotMatch(skipLink, /'use client'|onClick=|preventDefault\(|history\.pushState\(/)
  assert.match(skipLink, /<a href="#main-content" className=\{className\}>/)
})
