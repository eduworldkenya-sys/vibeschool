import { NextRequest, NextResponse } from 'next/server'
import { claimLocalTestWish, readClaimedLocalTestWish, removeLocalTestSession } from '@/lib/success-wishes/local-test-store'
import { localTestGuard, noStoreJson, TEST_SESSION_COOKIE } from '@/lib/success-wishes/local-test-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const blocked = localTestGuard(request)
  if (blocked) return blocked
  try {
    const body = await request.json()
    const result = typeof body.token === 'string' ? await claimLocalTestWish(body.token) : null
    if (!result) return noStoreJson({ error: 'This invitation is invalid, expired, or revoked.' }, 404)
    const response = noStoreJson({ wish: result.wish })
    response.cookies.set(TEST_SESSION_COOKIE, result.session, {
      httpOnly: true, sameSite: 'strict', secure: false, path: '/api/success-wishes',
      expires: new Date(Date.now() + 7 * 86400000),
    })
    return response
  } catch {
    return noStoreJson({ error: 'The invitation could not be opened.' }, 400)
  }
}

export async function GET(request: NextRequest) {
  const blocked = localTestGuard(request)
  if (blocked) return blocked
  const session = request.cookies.get(TEST_SESSION_COOKIE)?.value || ''
  const wish = await readClaimedLocalTestWish(session)
  return wish ? noStoreJson({ wish }) : noStoreJson({ error: 'No active wish session. Use the private invitation to open it.' }, 401)
}

export async function DELETE(request: NextRequest) {
  const blocked = localTestGuard(request)
  if (blocked) return blocked
  const session = request.cookies.get(TEST_SESSION_COOKIE)?.value || ''
  await removeLocalTestSession(session)
  const response = noStoreJson({ signedOut: true })
  response.cookies.set(TEST_SESSION_COOKIE, '', { httpOnly: true, sameSite: 'strict', secure: false, path: '/api/success-wishes', expires: new Date(0) })
  return response
}
