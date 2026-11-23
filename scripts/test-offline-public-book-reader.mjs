import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const read = path => fs.readFileSync(path, 'utf8')
test('defective offline books are fully removed from public routes and reader navigation', () => {
  for (const path of [
    'components/read/OfflineBookSaveButton.tsx',
    'components/read/OfflineBooksLibrary.tsx',
    'components/read/OfflineStorageStatus.tsx',
    'lib/read/offlinePublicBooks.ts',
    'app/offline/books/page.tsx',
  ]) assert.equal(fs.existsSync(path), false, path + ' must be deleted')
  assert.doesNotMatch(read('app/read/textbook/[publicationId]/ReaderClient.tsx'), /OfflineBookSaveButton|saveOfflineBook/)
  assert.doesNotMatch(read('components/student/BottomNav.tsx'), /Offline Books|\/offline\/books/)
  assert.doesNotMatch(read('public/offline.html'), /My Offline Books|\/offline\/books/)
})
test('service worker does not prepare or cache public-book shell, but offline games continue', () => {
  const sw = read('public/sw.js')
  assert.doesNotMatch(sw, /PREPARE_OFFLINE_BOOK_READER|OFFLINE_BOOK_READER_READY|OFFLINE_BOOK_ROUTE|\/offline\/books/)
  assert.match(sw, /OFFLINE_GAME_ROUTES/)
  assert.match(sw, /PREPARE_OFFLINE_GAMES/)
  assert.match(sw, /OFFLINE_GAMES_READY/)
  assert.match(sw, /indexedDB\.deleteDatabase\('vibeschool-public-books-v1'\)/)
  assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/)
  assert.match(sw, /url\.pathname\.startsWith\('\/auth\/'\)/)
})
