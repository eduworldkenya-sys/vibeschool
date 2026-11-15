import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read=path=>readFileSync(path,'utf8')
const control=read('app/schools/components/SchoolFollowButton.tsx')
const directory=read('app/schools/components/DirectorySchool.tsx')
const canonical=read('app/schools/components/SchoolProfile.tsx')
const css=read('app/schools/components/SchoolFollowButton.module.css')

function verify(code) {
  const required=[
    ".from('school_follows')",
    ".select('school_slug')",
    ".eq('follower_id', user.id)",
    ".delete().eq('school_slug', slug)",
    ".insert({ school_slug: slug, follower_id: user.id })",
    'await supabase.auth.getUser()',
    "window.location.assign('/login?redirect='",
    "disabled={status === 'loading' || busy}",
    'aria-pressed={following}',
    'setStatus(following',
  ]
  return required.filter(fragment=>!code.includes(fragment))
}
assert.deepEqual(verify(control),[],'Follow control must use authenticated user-scoped reads and writes')
assert.ok(verify(control.replaceAll(".eq('follower_id', user.id)",'')).length>0,'Cross-user isolation negative control failed')
assert.ok(verify(control.replace(".insert({ school_slug: slug, follower_id: user.id })",'.insert({ school_slug: slug })')).length>0,'Follower ownership negative control failed')
assert.match(directory, /<SchoolFollowButton slug=\{school\.slug\}\/>/)
assert.match(canonical, /<SchoolFollowButton slug=\{decodeURIComponent\(schoolBase\.slice\('\/school\/'.length\)\)\}\/>/)
assert.match(css,/min-height:\s*44px/)
assert.doesNotMatch(control, /from\('school_members'\)|from\('students'\)|from\('vc_circulars'\)/)
console.log('PASS: follow and unfollow wired to canonical school identities on both school page types; auth ownership, mobile action and negative controls')
