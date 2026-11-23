import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8')
const identity=read('lib/studioPublisherIdentity.ts')
const entry=read('app/teacher/studio/editor/page.tsx')
const page=read('app/teacher/studio/publishing/page.tsx')
const editor=read('components/global/publish/PublicationEditor.tsx')
const hook=read('hooks/usePublicationDraft.ts')
const lifecycle=read('lib/content-engine/publications.ts')
test('Mumbi2 role and immutable ID are required, not a display name',()=>{
  assert.match(identity,/userId === MUMBI2_PUBLISHER_ID && role === 'teacher'/)
  assert.match(entry,/sb\.auth\.getUser\(\)/)
  assert.match(entry,/isMumbi2Publisher\(user\.id, profile\.role\)/)
  assert.match(page,/setCanPublish\(isMumbi2Publisher\(user\.id, profile\.role\)\)/)
  assert.match(editor,/publishingEnabled && publication\?\.author_id === authorId/)
})
test('checked reading content uses existing textbook publication lifecycle',()=>{
  assert.match(editor,/confirmedReadingOnlyTextbook: materialsConfirmed/)
  assert.match(hook,/authData\.user\.id !== originalPub\.author_id/)
  assert.match(hook,/await publishTextbook\(sb, preparedPub\.id\)/)
  assert.match(lifecycle,/\.rpc\('publish_textbook', \{ p_publication_id: id \}\)/)
  assert.match(hook,/else await publishPublicationLifecycle\(sb, preparedPub\.id\)/)
})
test('owner activation not required, but authenticated author still required',()=>{
  assert.match(page,/No separate owner activation/)
  assert.doesNotMatch(page,/Awaiting Duncan activation|The replacement publishing service is not activated/)
  assert.match(editor,/key: 'learn'.*ok: false/)
  assert.match(page,/disabled=\{!canPublish \|\| !selected \|\| selected\.status === "published"\}/)
})