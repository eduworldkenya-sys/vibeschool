import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const globals = read('app/globals.css')
const teacherUi = read('components/teacher/ui.tsx')
const portalState = read('components/shared/PortalState.tsx')
const teacherLoading = read('app/teacher/loading.tsx')
const teacherError = read('app/teacher/error.tsx')
const adminLoading = read('app/admin/loading.tsx')
const adminError = read('app/admin/error.tsx')

const checks = [
  ['global focus-visible ring', globals.includes(':focus-visible') && globals.includes('outline: 3px solid')],
  ['reduced-motion support', globals.includes('prefers-reduced-motion: reduce')],
  ['teacher primary 44px target', teacherUi.includes('minHeight: small ? 36 : 44')],
  ['native disabled buttons', teacherUi.includes('disabled={disabled}')],
  ['semantic clickable avatar', teacherUi.includes('<button type="button" aria-label={ariaLabel}')],
  ['semantic modal dialog', teacherUi.includes('role="dialog"') && teacherUi.includes('aria-modal="true"')],
  ['modal close target', teacherUi.includes('width: 44, height: 44')],
  ['shared loading state', portalState.includes('PortalLoading') && teacherLoading.includes('PortalLoading') && adminLoading.includes('PortalLoading')],
  ['shared recoverable error state', portalState.includes('PortalError') && teacherError.includes('PortalError') && adminError.includes('PortalError')],
  ['error state has three recovery paths', portalState.includes('Retry') && portalState.includes('Return to workspace') && portalState.includes('Sign in again')],
]

const failed = checks.filter(([, ok]) => !ok)
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
if (failed.length) {
  console.error(`Portal UX contract failed: ${failed.map(([name]) => name).join(', ')}`)
  process.exit(1)
}
console.log(`Portal UX contract passed (${checks.length}/${checks.length}).`)
