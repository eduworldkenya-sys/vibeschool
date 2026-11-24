import { NextResponse } from 'next/server'

const gone = () => NextResponse.json(
  {error:'Mini Lessons use open publishing with automatic safety checks; HQ content approval is retired.'},
  {status:410,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}}
)

/** Historical route is intentionally disabled; do not restore staff publication approval. */
export const GET = gone
export const PATCH = gone
