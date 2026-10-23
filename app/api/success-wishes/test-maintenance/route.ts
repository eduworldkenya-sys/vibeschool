import { NextRequest } from 'next/server'
import { revokeLocalTestWish } from '@/lib/success-wishes/local-test-store'
import { localTestGuard, noStoreJson } from '@/lib/success-wishes/local-test-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const blocked = localTestGuard(request)
  if (blocked) return blocked
  try {
    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id || !['revoke', 'expire'].includes(body.action)) return noStoreJson({ error: 'Invalid local test action.' }, 400)
    const updated = await revokeLocalTestWish(id, body.action === 'expire')
    return updated ? noStoreJson({ updated: true }) : noStoreJson({ error: 'Test wish not found.' }, 404)
  } catch {
    return noStoreJson({ error: 'The local test action failed.' }, 400)
  }
}
