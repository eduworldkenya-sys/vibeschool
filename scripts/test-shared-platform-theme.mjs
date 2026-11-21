import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = path => readFileSync(path, 'utf8')

test('shared system/light/dark preference mounts for guests before sign-in', () => {
  const root = source('app/layout.tsx')
  const provider = source('components/theme/VibeSchoolThemeProvider.tsx')
  const control = source('components/theme/ThemeControl.tsx')
  assert.match(root, /<VibeSchoolThemeProvider>/)
  assert.match(root, /<PublicThemeControl\/>/)
  assert.match(provider, /defaultTheme="system"/)
  assert.match(provider, /enableSystem/)
  assert.match(provider, /storageKey=\{VIBESCHOOL_THEME_KEY\}/)
  assert.match(control, /<option value="system">System<\/option>/)
  assert.match(control, /<option value="light">Light<\/option>/)
  assert.match(control, /<option value="dark">Dark<\/option>/)
  assert.doesNotMatch(control, /supabase|auth\.getUser|session|getSession/i)
})

test('VibeTutor uses the shared preference but retains its complete local visual palette', () => {
  const nav = source('components/vibetutor/Nav.tsx')
  const css = source('components/vibetutor/VibeTutor.module.css')
  assert.match(nav, /useTheme\(\)/)
  assert.match(nav, /setTheme\(value\)/)
  assert.match(nav, /dataset\.vtTheme = resolved/)
  assert.doesNotMatch(nav, /localStorage\.setItem\('vibetutor-theme'/)
  assert.match(css, /data-vt-theme='dark'/)
  assert.match(source('app/vibetutor/layout.tsx'), /<Nav \/>/)
})

test('existing VibeTutor and learner preferences migrate without needing a login', () => {
  const provider = source('components/theme/VibeSchoolThemeProvider.tsx')
  assert.match(provider, /localStorage\.getItem\('vibetutor-theme'\)/)
  assert.match(provider, /localStorage\.getItem\('vs_student_theme_v1'\)/)
  assert.match(provider, /localStorage\.getItem\(VIBESCHOOL_THEME_KEY\)/)
  assert.match(provider, /vibeschool:learner-appearance-changed/)
})

test('learner workspace and auth read shared preference, and learner settings can change it', () => {
  const legacy = source('lib/student-theme.ts')
  const appearance = source('lib/student-appearance.ts')
  const layout = source('app/student/layout.tsx')
  const settings = source('app/student/settings/page.tsx')
  assert.match(legacy, /localStorage\.getItem\('vibeschool-theme'\)/)
  assert.match(appearance, /localStorage\.getItem\('vibeschool-theme'\)/)
  assert.match(layout, /useSiteTheme\(\)/)
  assert.match(settings, /setSiteTheme\(patch\.displayMode/)
  assert.match(source('app/auth/useAuthAppearance.ts'), /vibeschool:theme-changed/)
})

test('theme is a visual preference only and has no effect on school, grade or user authority', () => {
  const provider = source('components/theme/VibeSchoolThemeProvider.tsx')
  const control = source('components/theme/ThemeControl.tsx')
  for (const text of [provider,control]) {
    assert.doesNotMatch(text,/service_role|security_definer|adminUser|isTeacher|userRole|schoolId|teacherId|studentId/)
  }
})

test('canonical public and teacher headers own the switcher; fallback remains elsewhere', () => {
  const publicHeader = source('components/public/PublicHeader.tsx')
  const teacherLayout = source('app/teacher/layout.tsx')
  const control = source('components/theme/ThemeControl.tsx')
  const css = source('components/theme/ThemeControl.module.css')
  assert.match(publicHeader, /<ThemeControl native className=\{styles\.appearanceControl\} \/>/)
  assert.match(teacherLayout, /<ThemeControl native compact \/>/)
  assert.match(control, /native \? 'true' : undefined/)
  assert.match(css, /body:has\(\[data-site-theme-host\]\)/)
  assert.match(control, /<aside className=\{styles\.floating\}/)
})
