import { NextRequest, NextResponse } from 'next/server'

export function localTestGuard(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0]?.replace(/^\[|\]$/g, '')
  if (process.env.NODE_ENV !== 'development' || process.env.VIBESCHOOL_SUCCESS_WISHES_TEST_MODE !== '1' || !host || !['localhost', '127.0.0.1', '::1'].includes(host)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }
  return null
}

export function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' } })
}

export const TEST_SESSION_COOKIE = 'vsw_test_claim'
