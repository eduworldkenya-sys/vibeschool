import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { questionId, type, reason } = await req.json()
    if (!questionId || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    console.warn(`[VIBEEXAM FLAG] type=${type} | id=${questionId} | reason=${reason ?? 'none'}`)
    return NextResponse.json({ success: true, message: 'Feedback received. Our team will review within 24 hours.' })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
