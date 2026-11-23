import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8')

test('VibeTutor navigation exposes one VibeChat, not a second Inbox', () => {
  const nav = read('components/vibetutor/Nav.tsx')
  assert.match(nav, /label: 'VibeChat'/)
  assert.doesNotMatch(nav, /label: 'Inbox'/)
  assert.doesNotMatch(nav, /href: '\/vibetutor\/inquiries'/)
  assert.match(read('app/vibetutor/inquiries/page.tsx'), /redirect\('\/vibechat\?tab=enquiries'\)/)
})

test('VibeChat reuses authorized school and tuition messages', () => {
  const chat = read('components/vibechat/VibeChat.tsx')
  assert.match(chat, /vc_messages/)
  assert.match(chat, /vc_participants/)
  assert.match(chat, /vibetutor_my_lesson_messages/)
  assert.match(chat, /vibetutor_send_lesson_message/)
  assert.match(chat, /item\.status === 'accepted'/)
  assert.match(chat, /vibetutor_my_student_invites/)
  assert.match(chat, /vibetutor_student_inbox/)
  assert.doesNotMatch(chat, /service_role|SUPABASE_SERVICE/)
})

test('tuition details no longer contain a competing message composer', () => {
  const tools = read('components/vibetutor/PrivateTuitionTools.tsx')
  assert.match(tools, /\/vibechat\?thread=tuition:/)
  assert.doesNotMatch(tools, /vibetutor_send_lesson_message/)
  assert.doesNotMatch(tools, /Write a message/)
})

test('enquiry acceptance, rejection and privacy controls are preserved', () => {
  const enquiries = read('components/vibechat/Enquiries.tsx')
  assert.match(enquiries, /vibetutor_request_interest_reply/)
  assert.match(enquiries, /Stop public sharing/)
  assert.match(enquiries, /Reply and accept/)
  assert.match(enquiries, /Decline/)
})

test('unavailable calls are not presented as working', () => {
  const chat = read('components/vibechat/VibeChat.tsx')
  assert.match(chat, /Calls · Soon/)
  assert.match(chat, /disabled title="Calls will be added/)
})
