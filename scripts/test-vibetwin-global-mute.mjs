import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

// Owner-directed pause: UI and first-party routes must stay closed until reauthorized.
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
assert.match(read('lib/vibetwin-availability.ts'), /VIBETWIN_ENABLED:\s*boolean\s*=\s*false/)
const middleware = read('middleware.ts')
assert.match(middleware, /!VIBETWIN_ENABLED/)
assert.match(middleware, /student\|teacher\|parent\|admin\|hq/)
assert.match(middleware, /status: 404/)
const edge = read('supabase/functions/twin-chat/index.ts')
assert.match(edge, /const VIBETWIN_CHAT_ENABLED = false/)
assert.match(edge, /if \(!VIBETWIN_CHAT_ENABLED\) return json\(/)
assert.match(middleware, /request\.nextUrl\.searchParams\.has\('twin'\)/)
const entrypoints = [
  'app/teacher/layout.tsx',
  'app/teacher/pulse/page.tsx',
  'components/teacher/navigation.ts',
  'app/teacher/help/page.tsx',
  'components/teacher/ToolsGrid.tsx',
  'app/teacher/academics/page.tsx',
  'app/parent/page.tsx',
  'app/parent/vibe-learn/page.tsx',
  'app/hq/page.tsx',
  'components/student/VibeLearnShellWrapper.tsx',
  'app/student/layout.tsx',
  'components/student/LearnYourWayReaderBridge.tsx',
  'components/read/ReaderCalmSurface.tsx',
  'app/global/dashboard/page.tsx',
]
for (const file of entrypoints) {
  assert.match(read(file), /VIBETWIN_ENABLED/, file + ' must use the global mute')
}
assert.doesNotMatch(read('app/admin/academics/page.tsx'), /Student Twin private conversations/)
assert.doesNotMatch(read('app/student/vibelearn/practice/page.tsx'), /VibeTwin/)
assert.doesNotMatch(read('app/student/vibelearn/topic/page.tsx'), /VibeTwin/)
console.log('VibeTwin global mute contract: PASS')
