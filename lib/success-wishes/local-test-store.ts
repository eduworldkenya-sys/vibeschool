import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export type LocalTestWish = {
  id: string
  candidate: string
  sender: string
  message: string
  examYear: string
  school: string
  theme: string
  version: 'text'
  priceKes: 50
  createdAt: string
  expiresAt: string
  revokedAt?: string
  invitationHash: string
  sessions?: Array<{ hash: string; expiresAt: string }>
}

type Store = { wishes: LocalTestWish[] }
const storePath = path.join(process.cwd(), '.success-wishes-test-data.json')
const RETENTION_DAYS = 30
const SESSION_DAYS = 7

function hash(value: string) { return createHash('sha256').update(value).digest('hex') }
function addDays(date: Date, days: number) { return new Date(date.getTime() + days * 86400000).toISOString() }

async function readUnprunedStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(storePath, 'utf8')
    const parsed = JSON.parse(raw) as Store
    if (!parsed || !Array.isArray(parsed.wishes)) throw new Error('Invalid local test store')
    return parsed
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { wishes: [] }
    throw error
  }
}

async function writeStore(store: Store) {
  const temporaryPath = storePath + '.tmp'
  await fs.writeFile(temporaryPath, JSON.stringify(store, null, 2), { mode: 0o600 })
  await fs.rename(temporaryPath, storePath)
}

async function pruneExpiredWishes() {
  const store = await readUnprunedStore()
  const retained = store.wishes.filter(wish => !wish.revokedAt && Date.now() < Date.parse(wish.expiresAt))
  if (retained.length !== store.wishes.length) await writeStore({ wishes: retained })
}

async function readStore(): Promise<Store> {
  const store = await readUnprunedStore()
  const retained = store.wishes.filter(wish => !wish.revokedAt && Date.now() < Date.parse(wish.expiresAt))
  let changed = retained.length !== store.wishes.length
  for (const wish of retained) {
    const sessions = wish.sessions || []
    const liveSessions = sessions.filter(session => Date.now() < Date.parse(session.expiresAt))
    if (liveSessions.length !== sessions.length) changed = true
    wish.sessions = liveSessions
  }
  if (changed) await writeStore({ wishes: retained })
  return { wishes: retained }
}

export async function createLocalTestWish(input: Omit<LocalTestWish, 'id' | 'createdAt' | 'expiresAt' | 'invitationHash' | 'sessions' | 'revokedAt'>) {
  const store = await readStore()
  const now = new Date()
  const token = randomBytes(32).toString('base64url')
  const wish: LocalTestWish = {
    ...input,
    id: randomUUID(),
    createdAt: now.toISOString(),
    expiresAt: addDays(now, RETENTION_DAYS),
    invitationHash: hash(token),
  }
  store.wishes.push(wish)
  await writeStore(store)
  return { wish, token }
}

export async function claimLocalTestWish(token: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null
  const store = await readStore()
  const wish = store.wishes.find(item => item.invitationHash === hash(token))
  if (!wish || wish.revokedAt || Date.now() >= Date.parse(wish.expiresAt)) return null
  const session = randomBytes(32).toString('base64url')
  wish.sessions = (wish.sessions || []).filter(item => Date.now() < Date.parse(item.expiresAt))
  wish.sessions.push({ hash: hash(session), expiresAt: addDays(new Date(), SESSION_DAYS) })
  await writeStore(store)
  const { invitationHash: _invitationHash, sessions: _sessions, ...publicWish } = wish
  return { wish: publicWish, session }
}

export async function readClaimedLocalTestWish(session: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(session)) return null
  const store = await readStore()
  const wish = store.wishes.find(item => item.sessions?.some(itemSession => itemSession.hash === hash(session) && Date.now() < Date.parse(itemSession.expiresAt)))
  if (!wish || wish.revokedAt || Date.now() >= Date.parse(wish.expiresAt)) return null
  const { invitationHash: _invitationHash, sessions: _sessions, ...publicWish } = wish
  return publicWish
}

export async function revokeLocalTestWish(id: string, expire = false) {
  const store = await readStore()
  const wish = store.wishes.find(item => item.id === id)
  if (!wish) return false
  if (expire) wish.expiresAt = new Date(Date.now() - 1000).toISOString()
  else wish.revokedAt = new Date().toISOString()
  await writeStore(store)
  return true
}

export async function removeLocalTestSession(session: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(session)) return
  const store = await readStore()
  const sessionHash = hash(session)
  const wish = store.wishes.find(item => item.sessions?.some(itemSession => itemSession.hash === sessionHash))
  if (wish) {
    wish.sessions = wish.sessions?.filter(itemSession => itemSession.hash !== sessionHash)
    await writeStore(store)
  }
}

const processState = globalThis as typeof globalThis & { __vswTestPruneTimer?: NodeJS.Timeout }
if (process.env.NODE_ENV === 'development' && process.env.VIBESCHOOL_SUCCESS_WISHES_TEST_MODE === '1' && !processState.__vswTestPruneTimer) {
  void pruneExpiredWishes().catch(() => undefined)
  processState.__vswTestPruneTimer = setInterval(() => { void pruneExpiredWishes().catch(() => undefined) }, 60_000)
  processState.__vswTestPruneTimer.unref()
}
