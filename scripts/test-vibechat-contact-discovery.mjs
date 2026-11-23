import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url),'utf8')
const sql = read('supabase/migrations/20261123071500_vibechat_contact_discovery_typing.sql')
const contacts = read('components/vibechat/VibeChatContacts.tsx')
const typing = read('components/vibechat/useVibeChatTyping.ts')
const ui = read('components/vibechat/VibeChat.tsx')

function checkSecurity(input) {
  assert.match(input,/alter table public\.vibechat_contact_requests enable row level security/i)
  assert.match(input,/revoke all on public\.vibechat_contact_requests from public, anon, authenticated/i)
  assert.match(input,/sender\.role in \('teacher','parent','admin'\)/i)
  assert.match(input,/target\.role in \('teacher','admin'\)/i)
  assert.match(input,/vt\.status = 'published'/i)
  assert.match(input,/first_member\.school_id/i)
  assert.match(input,/second_member\.school_id/i)
  assert.match(input,/if not private\.vibechat_contact_allowed\(v_sender, v_recipient\)/i)
  assert.match(input,/r\.recipient_id=v_user for update/i)
  assert.match(input,/auth\.uid\(\) is null/i)
  assert.match(input,/count\(\*\)[\s\S]*?interval '24 hours'\) >= 5/i)
  assert.match(input,/create policy vibechat_typing_receive on realtime\.messages for select to authenticated/i)
  assert.match(input,/create policy vibechat_typing_send on realtime\.messages for insert to authenticated/i)
  assert.match(input,/private\.vibechat_can_use_typing_topic\(realtime\.topic\(\)\)/i)
  assert.match(input,/public\.vibetutor_private_access\(v_id\)/i)
  assert.match(input,/p\.left_at is null/i)
}

test('contact discovery is a server-gated exact username lookup, never a child directory',()=>{
  checkSecurity(sql)
  assert.match(sql,/lower\(p\.vc_id\) = v_handle/)
  assert.match(sql,/v_handle !~ '\^@/)
  assert.doesNotMatch(sql,/grant select on public\.vibechat_contact_requests to authenticated/i)
})
test('the authorization contract actually fails if adult-only or membership gates are removed',()=>{
  assert.throws(()=>checkSecurity(sql.replace("target.role in ('teacher','admin')","target.role in ('teacher','admin','student')")))
  assert.throws(()=>checkSecurity(sql.replace('p.left_at is null','p.left_at is not null')))
})
test('only an accepted request creates a new thread and both participants',()=>{
  assert.match(sql,/if not coalesce\(p_accept, false\) then/)
  assert.match(sql,/insert into public\.vc_threads/)
  assert.match(sql,/insert into public\.vc_participants/)
  assert.match(sql,/on conflict do nothing returning id into v_request/i)
  assert.match(sql,/vibechat_contact_pair_once/i)
})
test('typing broadcasts are ephemeral, private, throttled, and clear on stop',()=>{
  assert.match(typing,/private: true/)
  assert.match(typing,/event: 'typing'/)
  assert.match(typing,/now - lastActiveRef\.current >= 1800/)
  assert.match(typing,/setTimeout\(\(\) => \{ if \(alive\) setOtherTyping\(false\) \}, 3800\)/)
  assert.match(typing,/publish\(false\)/)
  assert.doesNotMatch(typing,/body:|messageText:|text:/)
  assert.match(ui,/otherTyping \? 'Typing…'/)
  assert.match(ui,/aria-live="polite"/)
  assert.match(ui,/onBlur=\{\(\)=>sendTyping\(false\)\}/)
})
test('VibeChat contacts use only scoped RPCs and never expose phone numbers',()=>{
  assert.match(contacts,/vibechat_lookup_handle/)
  assert.match(contacts,/vibechat_request_contact/)
  assert.match(contacts,/vibechat_respond_contact/)
  assert.match(contacts,/vibechat_my_handle/)
  assert.match(contacts,/\['teacher', 'parent', 'admin'\]\.includes\(role\)/)
  assert.doesNotMatch(contacts,/select\('\*'\)|\.from\('profiles'\)|phone|email/i)
  assert.match(ui,/tab==='contacts'/)
})
