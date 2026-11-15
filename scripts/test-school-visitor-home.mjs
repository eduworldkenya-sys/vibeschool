import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const component=readFileSync('components/schools/SchoolVisitorHome.tsx','utf8')
const styles=readFileSync('components/schools/SchoolVisitorHome.module.css','utf8')
const client=readFileSync('lib/supabase.ts','utf8')

function contracts(source) {
  for(const label of ['Follow School','Following','Updates','Information','School fees','Uniforms','Admissions','Calendar']){
    assert(source.includes(label), 'missing visitor-facing action: '+label)
  }
  assert(source.includes("db.from('school_follows')"), 'follows must use canonical existing table')
  assert(source.includes(".eq('follower_id', auth.user.id)"), 'reads and deletes must be account-scoped')
  assert(source.includes('follower_id: auth.user.id'), 'inserts must use signed-in identity')
  assert(source.includes("window.location.assign('/login/global?redirect='"), 'unauthenticated users must sign in before following')
  assert(source.includes('isAuthSessionMissingError'), 'a missing session must enter login, not a permanent auth error')
  assert(source.includes("role=\"status\""), 'changes and errors require accessible status feedback')
  assert(!/window\.localStorage|document\.cookie/.test(source), 'follow relationships must not be client-only')
  assert(!/KSh\s*\d+|official school notice:[^\n]*/i.test(source), 'do not invent fees or announcements')
}
contracts(component)
assert(styles.includes('@media(max-width:600px)'), 'mobile layout must be explicit')
assert(client.includes('school_follows: LiveSchoolFollows'), 'browser database contract must be typed')

// Negative control: an implementation that omits account isolation must be rejected.
assert.throws(()=>contracts(component.replaceAll(".eq('follower_id', auth.user.id)",'')),/account-scoped/)
console.log('School Home UI contract PASS: school-follow identity, auth, visible actions, no invented content, mobile design, negative control')
