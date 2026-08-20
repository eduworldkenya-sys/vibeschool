import fs from 'node:fs'

const page = fs.readFileSync('app/hq/page.tsx','utf8')
const shell = fs.readFileSync('components/hq/HQShell.tsx','utf8')
const layout = fs.readFileSync('app/hq/layout.tsx','utf8')
const mobile = fs.readFileSync('app/hq/founder-mobile-convergence.css','utf8')
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
for (const mobileDestination of ['[\"Home\"','[\"Decisions\"','[\"Alerts\"','[\"Operations\"']) requireText(shell, mobileDestination, `Mobile HQ destination missing: ${mobileDestination}`)
if (!shell.includes('[\"More\"') && !shell.includes('<span>Menu</span>')) failures.push('Mobile HQ must expose the full navigation entry point')
if (shell.includes('<span>Menu</span>')) {
  requireText(shell, 'hq-drawer', 'Mobile Menu must open the full HQ navigation drawer')
  requireText(shell, 'Search everything in HQ', 'Mobile navigation drawer must expose HQ search')
}

requireText(layout, 'HQGlobalSearch', 'Canonical HQ layout must retain global search')
requireText(layout, '@media(max-width:900px), (pointer:coarse)', 'Global search must follow the same coarse-pointer mobile boundary as the HQ shell')
requireText(layout, '.hq-global-search-desktop { display:none !important; }', 'Desktop search bridge must be suppressed in mobile/touch mode')
requireText(mobile, '.hq-page-actions', 'Founder mobile convergence must govern the action toolbar')
requireText(mobile, 'grid-template-columns: repeat(2, minmax(0, 1fr))', 'Founder actions must reflow inside the phone viewport')
requireText(mobile, 'overflow-x: clip', 'Founder mobile page must prevent page-level horizontal overflow')
requireText(mobile, '.fc-attention dl > div:last-child', 'Technical owner identifiers must be progressively disclosed on mobile')
requireText(mobile, '.hq-mobile-topbar', 'Founder convergence must protect the mobile HQ header from overflow')

const hrefs = [...shell.matchAll(/\[\"[^\"]+\",\"(\/hq[^\"]*)\"/g)].map(match=>match[1])
const duplicatePrimary = ['/hq/analytics','/hq/workforce','/hq/security'].filter(href => hrefs.filter(item=>item===href).length > 1)
if (duplicatePrimary.length) failures.push(`Duplicate desktop navigation destinations remain: ${duplicatePrimary.join(', ')}`)

if (failures.length) {
  console.error('HQ control-room UI contract FAILED')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log('HQ control-room UI contract PASS')
