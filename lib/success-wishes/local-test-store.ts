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

export type LocalTestCheckout = {
  id: string
  keyHash: string
  candidate: string
  sender: string
  message: string
  examYear: string
  school: string
  theme: string
  phoneLast4: string
  amountKes: 50
  state: 'awaiting_test_result' | 'settled_simulated' | 'failed_simulated'
  createdAt: string
  expiresAt: string
  wishId?: string
  providerMode?: 'daraja'
  hostedOrderId?: string
  hostedCheckoutRequestId?: string
  hostedState?: 'prepared' | 'submitting' | 'awaiting_customer' |
    'outcome_unknown' | 'reconciliation_required' | 'failed' | 'expired' | 'cancelled'
}
type Store = { wishes: LocalTestWish[]; checkouts?: LocalTestCheckout[] }
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
  if (retained.length !== store.wishes.length) await writeStore({ ...store, wishes: retained })
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
  if (changed) await writeStore({ ...store, wishes: retained })
  return { ...store, wishes: retained, checkouts: (store.checkouts || []).filter(item => Date.now() < Date.parse(item.expiresAt)) }
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

/**
 * Localhost-only test payments. These are not M-Pesa requests, provider
 * settlements, receipts or real entitlements. The invoking Next route MUST
 * call localTestGuard before using any of these functions.
 *
 * Finish and invitation minting share one atomic store write. A single-process
 * queue prevents concurrent test requests from granting twice.
 */
let checkoutQueue: Promise<void> = Promise.resolve()
async function serialCheckout<T>(fn: () => Promise<T>): Promise<T> {
  const pending = checkoutQueue.then(fn, fn)
  checkoutQueue = pending.then(() => undefined, () => undefined)
  return pending
}

type TestCheckoutInput = Pick<LocalTestCheckout,
  'candidate' | 'sender' | 'message' | 'examYear' | 'school' |
  'theme' | 'phoneLast4'>

export async function startLocalTestCheckout(input: TestCheckoutInput, mode: 'local' | 'daraja' = 'local') {
  return serialCheckout(async () => {
    const store = await readStore()
    const createdAt = new Date()
    const key = randomBytes(32).toString('base64url')
    const checkout: LocalTestCheckout = {
      ...input,
      providerMode: mode === 'daraja' ? 'daraja' : undefined,
      hostedState: mode === 'daraja' ? 'prepared' : undefined,
      id: randomUUID(),
      keyHash: hash(key),
      amountKes: 50,
      state: 'awaiting_test_result',
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + 30 * 60_000).toISOString(),
    }
    store.checkouts = [...(store.checkouts || []), checkout]
    await writeStore(store)
    return { orderId: checkout.id, key, amountKes: checkout.amountKes,
      state: checkout.state, expiresAt: checkout.expiresAt }
  })
}

function lookupCheckout(store: Store, orderId: string, key: string) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !/^[a-zA-Z0-9_-]{40,60}$/.test(key)) return null
  const found = store.checkouts?.find(item => item.id === orderId)
  return found && found.keyHash === hash(key) ? found : null
}

export async function readLocalTestCheckout(orderId: string, key: string) {
  const store = await readStore()
  const found = lookupCheckout(store, orderId, key)
  if (!found || Date.now() >= Date.parse(found.expiresAt)) return null
  return { orderId: found.id, amountKes: found.amountKes, state: found.state,
    simulated: true, realAccess: false, expiresAt: found.expiresAt,
    phoneLast4: found.phoneLast4, wishId: found.wishId || null,
    providerMode: found.providerMode || 'local',
    hostedOrderId: found.hostedOrderId || null,
    hostedState: found.hostedState || null }
}

export async function resolveLocalTestCheckout(orderId: string, key: string, outcome: 'success' | 'failure') {
  return serialCheckout(async () => {
    const store = await readStore()
    const found = lookupCheckout(store, orderId, key)
    if (!found || Date.now() >= Date.parse(found.expiresAt)) return null
    if (found.providerMode === 'daraja') {
      return { conflict: true, state: found.hostedState || 'prepared',
        simulated: true, realAccess: false }
    }
    if (found.state !== 'awaiting_test_result') {
      return { conflict: true, state: found.state, simulated: true, realAccess: false }
    }

    if (outcome === 'failure') {
      found.state = 'failed_simulated'
      await writeStore(store)
      return { state: found.state, simulated: true, realAccess: false, invitationToken: null }
    }

    // Simulated success only: mint one LOCAL TEST invitation, never a real grant.
    const now = new Date()
    const invitationToken = randomBytes(32).toString('base64url')
    const wish: LocalTestWish = {
      id: randomUUID(), candidate: found.candidate, sender: found.sender,
      message: found.message, examYear: found.examYear,
      school: found.school, theme: found.theme, version: 'text', priceKes: 50,
      createdAt: now.toISOString(), expiresAt: addDays(now, RETENTION_DAYS),
      invitationHash: hash(invitationToken),
    }
    store.wishes.push(wish)
    found.state = 'settled_simulated'
    found.wishId = wish.id
    await writeStore(store)
    return { state: found.state, simulated: true, realAccess: false,
      invitationToken, wishId: wish.id, expiresAt: wish.expiresAt }
  })
}

/**
 * Hosted Daraja sandbox commissioning is separate from synthetic success.
 * An STK can be sent only after atomically claiming one prepared localhost
 * test order. Network uncertainty NEVER permits resending the STK.
 */
export async function claimHostedSandboxSend(orderId: string, key: string) {
  return serialCheckout(async () => {
    const store = await readStore()
    const found = lookupCheckout(store, orderId, key)
    if (!found || found.providerMode !== 'daraja' ||
      Date.now() >= Date.parse(found.expiresAt) ||
      found.hostedState !== 'prepared') return false
    found.hostedState = 'submitting'
    await writeStore(store)
    return true
  })
}

export async function attachHostedSandboxOrder(
  orderId: string, key: string, hostedOrderId: string, checkoutRequestId: string
) {
  return serialCheckout(async () => {
    const store = await readStore()
    const found = lookupCheckout(store, orderId, key)
    if (!found || found.providerMode !== 'daraja' || found.hostedState !== 'submitting' ||
      !/^[0-9a-f-]{36}$/i.test(hostedOrderId) ||
      !/^ws_CO_[A-Za-z0-9_:-]{12,}$/.test(checkoutRequestId)) return false
    found.hostedOrderId = hostedOrderId
    found.hostedCheckoutRequestId = checkoutRequestId
    found.hostedState = 'awaiting_customer'
    await writeStore(store)
    return true
  })
}

export async function markHostedSandboxUncertain(orderId: string, key: string) {
  return serialCheckout(async () => {
    const store = await readStore()
    const found = lookupCheckout(store, orderId, key)
    if (!found || found.providerMode !== 'daraja' ||
      found.hostedState !== 'submitting') return false
    found.hostedState = 'outcome_unknown'
    await writeStore(store)
    return true
  })
}

/** Only an authenticated, server-queried, matching provider verdict may call
 * this helper. The invitation is LOCAL TEST ONLY, never a real entitlement. */
export async function applyHostedSandboxVerdict(
  orderId: string, key: string, hostedOrderId: string,
  verdict: 'success' | 'failed' | 'cancelled' | 'expired' | 'pending'
) {
  return serialCheckout(async () => {
    const store = await readStore()
    const found = lookupCheckout(store, orderId, key)
    if (!found || found.providerMode !== 'daraja' ||
      found.hostedOrderId !== hostedOrderId ||
      Date.now() >= Date.parse(found.expiresAt)) return null
    if (found.state !== 'awaiting_test_result') {
      return { conflict: true, state: found.state, simulated: true, realAccess: false }
    }
    if (verdict === 'pending') return {
      state: found.hostedState || 'awaiting_customer', simulated: true, realAccess: false
    }
    if (verdict !== 'success') {
      found.hostedState = verdict
      found.state = 'failed_simulated'
      await writeStore(store)
      return { state: verdict, simulated: true, realAccess: false, invitationToken: null }
    }
    if (found.hostedState !== 'awaiting_customer' &&
        found.hostedState !== 'reconciliation_required') return null
    const now = new Date()
    const invitationToken = randomBytes(32).toString('base64url')
    const wish: LocalTestWish = {
      id: randomUUID(), candidate: found.candidate, sender: found.sender,
      message: found.message, examYear: found.examYear, school: found.school,
      theme: found.theme, version: 'text', priceKes: 50,
      createdAt: now.toISOString(), expiresAt: addDays(now, RETENTION_DAYS),
      invitationHash: hash(invitationToken),
    }
    store.wishes.push(wish)
    found.state = 'settled_simulated'
    found.wishId = wish.id
    await writeStore(store)
    return { state: found.state, simulated: true, realAccess: false,
      invitationToken, wishId: wish.id, expiresAt: wish.expiresAt }
  })
}
