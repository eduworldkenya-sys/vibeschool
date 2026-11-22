import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = file => readFileSync(new URL('../'+file, import.meta.url), 'utf8')
const identity = read('lib/studioPublisherIdentity.ts')
const entry = read('app/teacher/studio/editor/page.tsx')
const page = read('app/teacher/studio/publishing/page.tsx')
const editor = read('components/global/publish/PublicationEditor.tsx')
const hook = read('hooks/usePublicationDraft.ts')
const lifecycle = read('lib/content-engine/publications.ts')

test('publisher identity is fixed server-authenticated user ID and teacher role, not editable name', () => {
  assert.match(identity, /MUMBI2_PUBLISHER_ID = 'c49bf987-357f-46bc-98fb-9a326882e437'/)
  assert.match(identity, /userId === MUMBI2_PUBLISHER_ID && role === 'teacher'/)
  assert.doesNotMatch(identity, /full_name|user_metadata|email/)
  assert.match(entry, /sb\.auth\.getUser\(\)/)
  assert.match(entry, /\.from\('profiles'\)\.select\('role'\)/)
  assert.match(entry, /isMumbi2Publisher\(user\.id, profile\.role\)/)
  assert.match(entry, /publishingEnabled=\{canPublish\}/)
  assert.match(page, /setCanPublish\(isMumbi2Publisher\(user\.id, profile\.role\)\)/)
})

test('editor only invokes server publisher for enabled identity and owned draft', () => {
  assert.match(editor, /publishingEnabled && publication\?\.author_id === authorId/)
  assert.match(editor, /if \(!canPublish\)/)
  assert.match(editor, /disabled=\{publishing \|\| publishedReadOnly \|\| !canPublish\}/)
  assert.match(editor, /publishDisabled=\{!canPublish\}/)
  assert.match(editor, /await publishPublication\(\)/)
  assert.match(hook, /publishPublicationLifecycle\(sb, preparedPub\.id\)/)
  assert.match(lifecycle, /\.rpc\('publish_publication', \{ p_publication_id: id \}\)/)
})

test('Mumbi2 log-in removes extra activation, not server-side content verification', () => {
  assert.match(page, /No separate owner activation is required/)
  assert.match(page, /server will still check content, answers, rights and learner visibility/)
  assert.doesNotMatch(page, /Awaiting Duncan activation|The replacement publishing service is not activated/)
  assert.match(editor, /key: 'learn'.*ok: false/)
  assert.match(page, /release verification still required/)
  assert.match(page, /disabled=\{!canPublish \|\| !selected \|\| selected\.status === "published"\}/)
})
