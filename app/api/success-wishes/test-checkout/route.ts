import { NextRequest } from 'next/server'
import { localTestGuard, noStoreJson } from '@/lib/success-wishes/local-test-guard'
import {
  readLocalTestCheckout, resolveLocalTestCheckout, startLocalTestCheckout,
} from '@/lib/success-wishes/local-test-store'

/**
 * Explicit localhost QA simulator only. No Daraja credentials, payment APIs,
 * database entitlements, or production payment configuration are touched.
 * The canonical production route remains fail-closed.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const themes = new Set(['heritage', 'botanical', 'nightfall', 'sunrise'])
const clean = (value: unknown, limit: number) => typeof value === 'string' ? value.trim().slice(0, limit) : ''

function gate(request: NextRequest) {
  const blocked = localTestGuard(request)
  if (blocked) return blocked
  // Reject cross-origin browser requests even in local test mode.
  const origin = request.headers.get('origin')
  if (origin) {
    try {
      if (new URL(origin).host !== request.nextUrl.host)
        return noStoreJson({ error: 'Cross-origin test request denied.' }, 403)
    } catch {
      return noStoreJson({ error: 'Invalid test origin.' }, 403)
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  const blocked = gate(request)
  if (blocked) return blocked
  try {
    const raw = await request.text()
    if (raw.length > 4000) return noStoreJson({ error: 'Test request too large.' }, 413)
    const body: unknown = JSON.parse(raw)
    if (!body || typeof body !== 'object' || Array.isArray(body)) return noStoreJson({ error: 'Invalid test request.' }, 400)
    const data = body as Record<string, unknown>

    if (data.action === 'start') {
      const candidate = clean(data.candidate, 48)
      const sender = clean(data.sender, 48)
      const message = clean(data.message, 220)
      const examYear = clean(data.examYear, 4)
      const school = clean(data.school, 80)
      const theme = clean(data.theme, 20)
      const rawPhone = clean(data.phone, 20).replace(/[\s()-]/g, '')
      const phone = rawPhone.replace(/^\+254/, '254').replace(/^0/, '254')
      if (!candidate || !sender || !message || !/^20\d{2}$/.test(examYear)
        || !themes.has(theme) || data.version !== 'text'
        || !/^254[17]\d{8}$/.test(phone)
        || data.amount_kes !== undefined || data.price !== undefined)
        return noStoreJson({ error: 'Check the test card and phone details.' }, 400)

      const result = await startLocalTestCheckout({
        candidate, sender, message, examYear, school, theme,
        phoneLast4: phone.slice(-4),
      })
      return noStoreJson({ mode: 'local_simulation', simulated: true,
        realAccess: false, ...result }, 201)
    }
    if (data.action === 'resolve') {
      const orderId = clean(data.orderId, 60)
      const key = clean(data.key, 80)
      if (data.outcome !== 'success' && data.outcome !== 'failure')
        return noStoreJson({ error: 'Unsupported test outcome.' }, 400)
      const result = await resolveLocalTestCheckout(orderId, key, data.outcome)
      if (!result) return noStoreJson({ error: 'Test order not found or expired.' }, 404)
      if ('conflict' in result && result.conflict)
        return noStoreJson({ error: 'Test order already resolved.', ...result }, 409)
      return noStoreJson({ mode: 'local_simulation', ...result })
    }
    return noStoreJson({ error: 'Unsupported test action.' }, 400)
  } catch {
    return noStoreJson({ error: 'Local simulated checkout failed.' }, 400)
  }
}

export async function GET(request: NextRequest) {
  const blocked = gate(request)
  if (blocked) return blocked
  const orderId = request.nextUrl.searchParams.get('orderId') || ''
  const key = request.nextUrl.searchParams.get('key') || ''
  const status = await readLocalTestCheckout(orderId, key)
  return status ? noStoreJson({ mode: 'local_simulation', ...status })
    : noStoreJson({ error: 'Test order not found or expired.' }, 404)
}
