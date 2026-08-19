import fs from 'node:fs'

const page = fs.readFileSync('app/hq/page.tsx','utf8')
const shell = fs.readFileSync('components/hq/HQShell.tsx','utf8')
const presentation = fs.readFileSync('lib/hq/presentation.ts','utf8')

const failures = []
const requireText = (source, text, message) => { if (!source.includes(text)) failures.push(message) }
const forbid = (source, pattern, message) => { if (pattern.test(source)) failures.push(message) }

forbid(page, /Number\(v\?\?0\)/, 'HQ must not coerce missing metrics to zero')
forbid(page, /learners\s*\*\s*\.\d+/, 'HQ must not fabricate geography from learner proportions')
forbid(page, /Mathematics[^\n]*85|English[^\n]*78|Kiswahili[^\n]*72/, 'HQ must not ship synthetic subject mastery')
forbid(page, /Math\.round\(totalSchools\s*\*/, 'HQ must not fabricate school performance distributions')
requireText(page, 'Attention Required', 'Founder home must surface Attention Required')
requireText(page, 'Confirm and run once', 'Operating cycle must require explicit confirmation')
requireText(page, 'fallback policy evaluations', 'Fallback execution must be visible')
requireText(page, 'staleCerts', 'Certification freshness must be represented')
requireText(presentation, 'numberOrNull', 'Null-safe metric parsing is required')
requireText(presentation, 'deltaMeaning', 'Semantic delta evaluation is required')

for (const label of ['Home','Decisions','Operations','Product','Content','Revenue','System']) requireText(shell, `\"${label}\"`, `Primary HQ domain missing: ${label}`)
for (const mobile of ['[\"Home\"','[\"Decisions\"','[\"Alerts\"','[\"Operations\"','[\"More\"']) requireText(shell, mobile, `Mobile HQ destination missing: ${mobile}`)

const hrefs = [...shell.matchAll(/\[\"[^\"]+\",\"(\/hq[^\"]*)\"/g)].map(match=>match[1])
const duplicatePrimary = ['/hq/analytics','/hq/workforce','/hq/security'].filter(href => hrefs.filter(item=>item===href).length > 1)
if (duplicatePrimary.length) failures.push(`Duplicate desktop navigation destinations remain: ${duplicatePrimary.join(', ')}`)

if (failures.length) {
  console.error('HQ control-room UI contract FAILED')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log('HQ control-room UI contract PASS')
