import { NextRequest } from 'next/server'
import { createLocalTestWish } from '@/lib/success-wishes/local-test-store'
import { localTestGuard, noStoreJson } from '@/lib/success-wishes/local-test-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const themes = new Set(['heritage', 'botanical', 'nightfall', 'sunrise'])
function clean(value: unknown, max: number) { return typeof value === 'string' ? value.trim().slice(0, max) : '' }

export async function POST(request: NextRequest) {
  const blocked = localTestGuard(request)
  if (blocked) return blocked
  try {
    const body = await request.json()
    const candidate = clean(body.candidate, 48)
    const sender = clean(body.sender, 48)
    const message = clean(body.message, 220)
    const examYear = clean(body.examYear, 4)
    const school = clean(body.school, 80)
    const theme = clean(body.theme, 20)
    if (!candidate || !sender || !message || !/^20\d{2}$/.test(examYear) || !themes.has(theme) || body.version !== 'text') {
      return noStoreJson({ error: 'Check the wish details and try again.' }, 400)
    }
    const { wish, token } = await createLocalTestWish({ candidate, sender, message, examYear, school, theme, version: 'text', priceKes: 50 })
    return noStoreJson({ id: wish.id, invitationToken: token, expiresAt: wish.expiresAt }, 201)
  } catch {
    return noStoreJson({ error: 'The local test wish could not be saved.' }, 500)
  }
}
