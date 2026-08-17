import { NextResponse } from 'next/server'

const ALLOWED_EVENTS = new Set([
  'public_home_start_learning','public_home_pathways','public_home_teacher','public_pathways_start_check',
  'public_pathways_school_discovery','public_pathways_careers','public_contact_whatsapp','public_contact_support_submit',
  'public_institution_contact','public_careers_interest','public_auth_signin',
])

const PUBLIC_PATH = /^\/(?:$|about(?:\/|$)|contact(?:\/|$)|careers(?:\/|$)|institutions(?:\/|$)|trust(?:\/|$)|legal(?:\/|$)|pathways(?:\/|$)|learn\/careers(?:\/|$)|global(?:\/|$))/
const MAX_BODY_BYTES = 1024

export async function POST(request: Request) {
  try {
    const declaredLength = Number(request.headers.get('content-length') ?? '0')
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) return new NextResponse(null,{status:413})
    const raw = await request.text()
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return new NextResponse(null,{status:413})
    const body = JSON.parse(raw) as { event?: unknown; path?: unknown }
    if (typeof body.event !== 'string' || !ALLOWED_EVENTS.has(body.event)) return new NextResponse(null,{status:400})
    const path = typeof body.path === 'string' && PUBLIC_PATH.test(body.path) ? body.path.split('?')[0].split('#')[0].slice(0,160) : '/'

    // Deliberately anonymous: no cookies, auth identifiers, IP extraction, query strings,
    // free-text payloads, credentials or learner/school identifiers are recorded by this application event.
    console.info(JSON.stringify({ type:'public_conversion', event:body.event, path, occurred_at:new Date().toISOString() }))
    return new NextResponse(null,{status:204,headers:{'cache-control':'no-store'}})
  } catch {
    return new NextResponse(null,{status:400,headers:{'cache-control':'no-store'}})
  }
}
