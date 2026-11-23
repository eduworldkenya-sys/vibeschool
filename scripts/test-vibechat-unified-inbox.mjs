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

test('VibeChat shows existing account avatars instead of inventing a second profile', () => {
  const chat = read('components/vibechat/VibeChat.tsx')
  const contacts = read('components/vibechat/VibeChatContacts.tsx')
  const avatar = read('components/vibechat/VibeChatAvatar.tsx')
  const sql = read('supabase/migrations/20261123071500_vibechat_contact_discovery_typing.sql')
  assert.match(chat, /vibechat_my_chat_peers/)
  assert.match(chat, /vibechat_my_tuition_peers/)
  assert.match(chat, /<VibeChatAvatar name=\{chat\.title\} avatarUrl=\{chat\.avatarUrl\}/)
  assert.match(chat, /<VibeChatAvatar name=\{selected\.title\} avatarUrl=\{selected\.avatarUrl\}/)
  assert.match(contacts, /<VibeChatAvatar name=\{found\.display_name\} avatarUrl=\{found\.avatar_url\}/)
  assert.match(contacts, /<VibeChatAvatar name=\{c\.name\} avatarUrl=\{c\.avatar_url\}/)
  assert.match(avatar, /NEXT_PUBLIC_SUPABASE_URL/)
  assert.match(avatar, /storage\/v1\/object\/public\/avatars/)
  assert.match(avatar, /onError=\{\(\) => setBroken\(true\)\}/)
  assert.match(sql, /public\.vibechat_my_chat_peers\(\)/)
  assert.match(sql, /mine\.profile_id = auth\.uid\(\) and mine\.left_at is null/)
  assert.match(sql, /public\.vibetutor_private_access\(i\.id\)/)
})

test('Parent teacher contact creation leads to VibeChat, not another message composer', () => {
  const parent = read('app/parent/child/[id]/messages/page.tsx')
  const shell = read('app/parent/layout.tsx')
  assert.match(parent, /parent_start_child_thread/)
  assert.match(parent, /router\.push\('\/vibechat\?thread=vc:'/)
  assert.doesNotMatch(parent, /vc_messages'\)\.insert|function sendMessage|messageBody/)
  assert.match(shell, /label: "VibeChat"/)
  assert.match(shell, /href: "\/vibechat"/)
})

test('teacher school outreach and all old teacher chats live under VibeChat', () => {
  const legacy = read('app/teacher/vibeconnect/page.tsx')
  const school = read('components/vibechat/VibeChatSchool.tsx')
  const chat = read('components/vibechat/VibeChat.tsx')
  const sql = read('supabase/migrations/20261123071500_vibechat_contact_discovery_typing.sql')
  assert.match(legacy, /redirect\('\/vibechat\?tab=school'\)/)
  assert.doesNotMatch(legacy, /vc_messages.*insert|findOrCreateThread/)
  assert.match(chat, /tab==='school'/)
  assert.match(school, /vibechat_my_school_families/)
  assert.match(school, /vibechat_start_teacher_parent_thread/)
  assert.match(sql,/create or replace function public\.vibechat_my_school_families\(/)
  assert.match(sql,/assignment\.teacher_id=auth\.uid\(\)/)
  assert.match(sql,/guardian_link\.parent_id=p_parent_id/)
  assert.match(sql,/join public\.teacher_classes assignment/)
  assert.match(sql,/guardian\.account_status::text='active'/)
  assert.match(sql,/teacher\.account_status::text='active'/)
  assert.match(sql,/create or replace function public\.vibechat_start_teacher_parent_thread\(/)
})
